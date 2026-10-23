'use strict';
// Runs the Vetro dock (dock/) on the TV and keeps it running while it is switched on.
//
// The dock is a .NET process that the TV's own `dotnet` runs from this package. It is not a
// Tizen app, so nothing restarts it: the service starts it as root through the agent, checks on
// it now and then, and stops it when the switch goes off. The dock closes Samsung's Home
// (com.samsung.tv.csfs) itself after each Home press, so a dead dock hands the Home key
// straight back to Samsung: the worst case of a crash is the TV as it was before.
//
// State lives in one small file next to the other Vetro settings. Nothing else on the TV is
// changed: no package is disabled and the default Home is untouched.

var fs = require('fs');
var path = require('path');
var catalog = require('./dock-catalog.js');

var SHARE = '/opt/usr/home/owner/share';
var STATE_FILE = SHARE + '/vetro-dock.json';
var APPS_FILE = SHARE + '/vetro-dock-apps.tsv';
var RUN_DIR = '/home/owner';                          // the dock's own pid, fifo and log
var PID_FILE = RUN_DIR + '/tvlauncher.pid';
var FIFO = RUN_DIR + '/tvlauncher.fifo';
var LOG_FILE = RUN_DIR + '/tvlauncher.log';
var DLL = 'tvlauncher-dotnet.dll';
var HOME_APP = 'com.samsung.tv.csfs';
var HOME_CODE = 63;                                   // Home on the forwarded remote Vetro creates
var START_WAIT_MS = 15000;
var MAX_FAILURES = 4;

function wrap(s) { return 'echo ' + Buffer.from(s).toString('base64') + ' | base64 -d | sh'; }
function q(s) { return "'" + String(s).replace(/'/g, "'\\''") + "'"; }

function Dock(options) {
    options = options || {};
    this.execute = options.execute;
    this.dir = options.dir || path.join(__dirname, '..', 'native', 'dock');
    this.stateFile = options.stateFile || STATE_FILE;
    this.appsFile = options.appsFile || APPS_FILE;
    this.sleep = options.sleep || function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
    this.now = options.now || Date.now;
    this.busy = false;
    this.failures = 0;
    this.nextTry = 0;
    this.lastError = null;
    this.lastCatalog = null;
}

Dock.prototype.installed = function () {
    try { return fs.existsSync(path.join(this.dir, DLL)) && fs.existsSync(path.join(this.dir, 'res', 'glass_tile.png')); }
    catch (e) { return false; }
};

Dock.prototype.readState = function () {
    try {
        var s = JSON.parse(fs.readFileSync(this.stateFile, 'utf8'));
        return {enabled: s && s.enabled === true, since: typeof s.since === 'number' ? s.since : null};
    } catch (e) { return {enabled: false, since: null}; }
};

Dock.prototype.writeState = function (state) {
    try { fs.writeFileSync(this.stateFile, JSON.stringify(state)); }
    catch (e) { throw new Error('The dock setting could not be saved: ' + e.message); }
};

function check(r, what) {
    if (!r || r.exit_code || r.timed_out) throw new Error((r && (r.stderr || r.stdout)) || what + ' failed');
    return r.stdout || '';
}

// What is running right now. Only the dock's own pid counts, and only if that pid is our dll.
Dock.prototype.probe = function () {
    var script = [
        'p=$(cat ' + PID_FILE + ' 2>/dev/null)',
        'if [ -n "$p" ] && tr "\\0" " " < /proc/$p/cmdline 2>/dev/null | grep -q ' + DLL + '; then echo "dock=$p"; else echo "dock="; fi',
        'if pidof ' + HOME_APP + ' >/dev/null 2>&1 || ps | grep -q "[c]sfs"; then echo "home=1"; else echo "home=0"; fi',
        'echo "log:"; tail -n 6 ' + LOG_FILE + ' 2>/dev/null'
    ].join('\n');
    return this.execute(wrap(script), 8000).then(function (r) {
        var out = check(r, 'Status');
        var pid = /^dock=(\d+)$/m.exec(out), home = /^home=(\d)$/m.exec(out);
        return {running: !!pid, pid: pid ? +pid[1] : null, samsungHome: home ? home[1] === '1' : null,
            log: out.split('log:\n')[1] ? out.split('log:\n')[1].trim() : ''};
    });
};

Dock.prototype.status = function () {
    var self = this, state = this.readState();
    var base = {installed: this.installed(), enabled: state.enabled, since: state.since, busy: this.busy,
        error: this.lastError, failures: this.failures, apps: this.lastCatalog};
    return this.probe().then(function (p) {
        return Object.assign(base, {running: p.running, pid: p.pid, samsungHome: p.samsungHome, log: p.log});
    }).catch(function (e) {
        return Object.assign(base, {running: null, pid: null, samsungHome: null, log: '', probeError: e.message});
    });
};

// The launch line. Paths are fixed constants or come from this package's own folder, and are quoted.
Dock.prototype.startScript = function () {
    return [
        this.stopLines(),
        'rm -f ' + FIFO,
        'cd ' + q(this.dir),
        'HOME=/home/owner XDG_RUNTIME_DIR=/run WAYLAND_DISPLAY=wayland-0 TVLAUNCHER_ENGINE=egl TVLAUNCHER_DIR=' + RUN_DIR +
            ' setsid nohup /usr/bin/dotnet ' + DLL + ' --apps ' + q(this.appsFile) + ' --inputs ' + q(path.join(this.dir, 'res', 'inputs.tsv')) +
            ' --hidden --home-code ' + HOME_CODE + ' --kill-on-home ' + HOME_APP + ' </dev/null >/dev/null 2>&1 &',
        'echo started'
    ].join('\n');
};

// The dock ignores SIGTERM, so it takes kill -9; only a pid that is really our dll is touched.
Dock.prototype.stopLines = function () {
    return 'p=$(cat ' + PID_FILE + ' 2>/dev/null); if [ -n "$p" ] && tr "\\0" " " < /proc/$p/cmdline 2>/dev/null | grep -q ' + DLL +
        '; then kill -9 $p; sleep 0.3; fi; rm -f ' + PID_FILE;
};

Dock.prototype.writeCatalog = function () {
    var self = this;
    return catalog.load(this.execute).then(function (c) {
        try { fs.writeFileSync(self.appsFile, c.tsv); }
        catch (e) { throw new Error('The app list could not be saved: ' + e.message); }
        self.lastCatalog = {count: c.count, skipped: c.skipped, at: self.now()};
        return c;
    });
};

Dock.prototype.waitRunning = function () {
    var self = this, deadline = this.now() + START_WAIT_MS;
    function poll() {
        return self.probe().then(function (p) {
            if (p.running) return p;
            if (self.now() > deadline) throw new Error('The dock did not start. ' + (p.log ? 'Last log lines: ' + p.log.split('\n').slice(-2).join(' | ') : 'It wrote no log.'));
            return self.sleep(1000).then(poll);
        });
    }
    return this.sleep(1500).then(poll);
};

Dock.prototype.launch = function () {
    var self = this;
    return this.writeCatalog().then(function () {
        return self.execute(wrap(self.startScript()), 10000);
    }).then(function (r) { check(r, 'Start'); return self.waitRunning(); });
};

// Turn the dock on: build the app list from Samsung's Home, start the dock, and only then
// remember that it is on. If anything fails nothing has changed.
Dock.prototype.enable = function () {
    var self = this;
    if (this.busy) return Promise.reject(new Error('Another dock change is in progress'));
    if (!this.installed()) return Promise.reject(new Error('The dock files are not in this Vetro package'));
    this.busy = true; this.lastError = null;
    return this.launch().then(function () {
        self.writeState({enabled: true, since: self.now()});
        self.failures = 0; self.nextTry = 0;
        // Samsung's Home is idle in the background; closing it frees its memory, and Settings or
        // Source opened from the dock start it again on demand.
        return self.execute('app_launcher -k ' + HOME_APP, 8000).catch(function () {});
    }).then(function () { return self.status(); }).catch(function (e) {
        self.lastError = e.message;
        return self.stopDock().catch(function () {}).then(function () { throw e; });
    }).finally(function () { self.busy = false; });
};

Dock.prototype.stopDock = function () {
    return this.execute(wrap(this.stopLines()), 8000).then(function (r) { check(r, 'Stop'); });
};

// Turn the dock off. The setting goes first, so a failed stop cannot bring it back by itself.
Dock.prototype.disable = function () {
    var self = this;
    if (this.busy) return Promise.reject(new Error('Another dock change is in progress'));
    this.busy = true; this.lastError = null;
    var state = this.readState();
    try { this.writeState({enabled: false, since: state.since}); }
    catch (e) { this.busy = false; return Promise.reject(e); }
    return this.stopDock().then(function () { return self.status(); })
        .finally(function () { self.busy = false; });
};

// Rebuild the app list and restart: after installing or removing an app.
Dock.prototype.refresh = function () {
    var self = this;
    if (this.busy) return Promise.reject(new Error('Another dock change is in progress'));
    if (!this.readState().enabled) return Promise.reject(new Error('The dock is off'));
    this.busy = true; this.lastError = null;
    return this.launch().then(function () { return self.status(); }).catch(function (e) {
        self.lastError = e.message; throw e;
    }).finally(function () { self.busy = false; });
};

// Called every few seconds by the service. Starts the dock after a boot or a crash while it is
// switched on, backing off after failures and giving up (switching it off) after a few.
Dock.prototype.supervise = function (agentConnected) {
    var self = this, state = this.readState();
    if (!state.enabled || this.busy || !agentConnected || this.now() < this.nextTry) return Promise.resolve(null);
    if (!this.installed()) return Promise.resolve(null);
    this.busy = true;
    return this.probe().then(function (p) {
        if (p.running) { self.failures = 0; return 'running'; }
        return self.launch().then(function () { self.failures = 0; self.lastError = null; return 'started'; });
    }).catch(function (e) {
        self.failures++;
        self.lastError = e.message;
        self.nextTry = self.now() + Math.min(300000, 30000 * Math.pow(2, self.failures - 1));
        if (self.failures >= MAX_FAILURES) {
            // Stop trying: Samsung's Home answers the Home key again, and the page says why.
            try { self.writeState({enabled: false, since: state.since}); } catch (e2) {}
            self.lastError = 'The dock could not be kept running and was switched off. ' + e.message;
            self.failures = 0;
        }
        return 'failed';
    }).finally(function () { self.busy = false; });
};

module.exports = {Dock: Dock, STATE_FILE: STATE_FILE, APPS_FILE: APPS_FILE};
