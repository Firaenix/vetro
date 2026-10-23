'use strict';
const assert = require('assert').strict;
const fs = require('fs');
const os = require('os');
const path = require('path');
const {Dock} = require('../service/dock.js');

const hex = s => Buffer.from(s).toString('hex');
const HOME_DATA = [
    'O|d/webapp@aaa',
    'R|' + hex('aaa') + '|' + hex('Netflix') + '|' + hex('org.tizen.netflix-app') + '|0',
    'I|aaa|/opt/share/webappservice/apps_icon/all/aaa/224x224.png'
].join('\n');

function fixture(options) {
    options = options || {};
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vetro-dock-'));
    const dir = path.join(tmp, 'dock');
    if (options.installed !== false) {
        fs.mkdirSync(path.join(dir, 'res'), {recursive: true});
        fs.writeFileSync(path.join(dir, 'tvlauncher-dotnet.dll'), 'x');
        fs.writeFileSync(path.join(dir, 'res', 'glass_tile.png'), 'x');
    }
    const tv = {running: options.running === true, scripts: [], neverStarts: options.neverStarts === true, csfs: true, clock: 1000000,
        homeData: options.homeData == null ? HOME_DATA : options.homeData, log: options.log || ''};
    const execute = async function (cmd) {
        tv.scripts.push(cmd);
        if (/^app_launcher -k /.test(cmd)) { tv.csfs = false; return {exit_code: 0, stdout: ''}; }
        const script = Buffer.from(cmd.split(' ')[1], 'base64').toString();
        if (script.includes('.appLayerCache')) return {exit_code: 0, stdout: tv.homeData};
        if (script.includes('setsid nohup')) { tv.started = script; if (!tv.neverStarts) tv.running = true; return {exit_code: 0, stdout: 'started\n'}; }
        if (script.includes('kill -9') && !script.includes('echo "dock=')) { tv.running = false; tv.stopped = (tv.stopped || 0) + 1; return {exit_code: 0, stdout: ''}; }
        if (script.includes('echo "dock=')) return {exit_code: 0, stdout: (tv.running ? 'dock=4242' : 'dock=') + '\nhome=' + (tv.csfs ? 1 : 0) + '\nlog:\n' + tv.log + '\n'};
        throw new Error('unexpected command: ' + script);
    };
    const dock = new Dock({execute: execute, dir: dir, stateFile: path.join(tmp, 'state.json'), appsFile: path.join(tmp, 'apps.tsv'),
        sleep: async ms => { tv.clock += ms; }, now: () => tv.clock});
    return {dock, tv, tmp};
}

(async function () {
    // Not in the package: nothing to run, nothing touched.
    let f = fixture({installed: false});
    assert.equal((await f.dock.status()).installed, false);
    await assert.rejects(f.dock.enable(), /not in this Vetro package/);
    assert.equal(f.tv.scripts.length, 1, 'only the status probe ran');

    // Switching on: app list first, then the dock, then the setting, then Samsung's Home is closed.
    f = fixture();
    let s = await f.dock.status();
    assert.equal(s.enabled, false);
    assert.equal(s.running, false);
    s = await f.dock.enable();
    assert.equal(s.enabled, true);
    assert.equal(s.running, true);
    assert.equal(s.apps.count, 1);
    assert.equal(fs.readFileSync(path.join(f.tmp, 'apps.tsv'), 'utf8').split('\n')[1],
        'netflix\tNetflix\torg.tizen.netflix-app\t\t/opt/share/webappservice/apps_icon/all/aaa/224x224.png', 'the list the dock reads');
    assert.ok(/tvlauncher-dotnet\.dll --apps '[^']+apps\.tsv' --inputs '[^']+inputs\.tsv' --hidden --home-code 63 --kill-on-home com\.samsung\.tv\.csfs/.test(f.tv.started),
        'the verified dock command line: ' + f.tv.started);
    assert.ok(f.tv.started.includes('TVLAUNCHER_DIR=/home/owner') && f.tv.started.includes('WAYLAND_DISPLAY=wayland-0') && f.tv.started.includes('setsid nohup /usr/bin/dotnet'));
    assert.ok(f.tv.started.indexOf('kill -9') < f.tv.started.indexOf('setsid'), 'a previous dock is stopped before the new one starts');
    assert.ok(/tr "\\0" " " < \/proc\/\$p\/cmdline/.test(f.tv.started) && f.tv.started.includes('grep -q tvlauncher-dotnet.dll'), 'only a pid that is our dll is killed');
    assert.equal(f.tv.csfs, false, 'Samsung Home closed once the dock is up');
    assert.equal(JSON.parse(fs.readFileSync(path.join(f.tmp, 'state.json'), 'utf8')).enabled, true);
    assert.equal(f.tv.scripts[f.tv.scripts.length - 1].startsWith('echo '), true);
    assert.ok(f.tv.scripts.findIndex(c => /^app_launcher -k com\.samsung\.tv\.csfs$/.test(c)) > f.tv.scripts.findIndex(c => c.startsWith('echo') && Buffer.from(c.split(' ')[1], 'base64').toString().includes('setsid')),
        'Samsung Home is closed after the dock started, never before');

    // Switching on fails when the dock never appears: back to how it was, with the reason.
    f = fixture({neverStarts: true, log: 'fatal: no display'});
    await assert.rejects(f.dock.enable(), /did not start.*fatal: no display/);
    assert.equal(f.dock.readState().enabled, false, 'not remembered as on');
    assert.equal(f.tv.csfs, true, 'Samsung Home was never touched');
    assert.ok(f.tv.stopped >= 1, 'a half-started dock is stopped');
    assert.match((await f.dock.status()).error, /did not start/);
    assert.equal((await f.dock.status()).busy, false);

    // A Home row that cannot be read stops everything before the dock is started.
    f = fixture({homeData: ''});
    await assert.rejects(f.dock.enable(), /empty or unreadable/);
    assert.ok(!f.tv.started, 'the dock was not started');
    assert.equal(f.dock.readState().enabled, false);

    // Two changes at once: the second is refused.
    f = fixture();
    const first = f.dock.enable();
    await assert.rejects(f.dock.disable(), /in progress/);
    await first;

    // Switching off: the setting goes first, then the process; Samsung's Home is left to open on the next Home press.
    f = fixture();
    await f.dock.enable();
    s = await f.dock.disable();
    assert.equal(s.enabled, false);
    assert.equal(s.running, false);
    assert.ok(!f.tv.scripts.some(c => /^app_launcher -s /.test(c)), 'the screen is not switched under the viewer');

    // Supervision: only when on, installed, and the agent is up.
    f = fixture();
    assert.equal(await f.dock.supervise(true), null, 'off: nothing to do');
    await f.dock.enable();
    f.tv.running = false;
    assert.equal(await f.dock.supervise(false), null, 'agent not connected yet: wait');
    assert.equal(await f.dock.supervise(true), 'started', 'dock died: started again');
    assert.equal(f.tv.running, true);
    assert.equal(await f.dock.supervise(true), 'running', 'alive: left alone');

    // After a reboot the service sees the setting but no process, and starts it.
    const tmpState = f.dock.stateFile;
    const reborn = fixture();
    fs.writeFileSync(reborn.dock.stateFile, JSON.stringify({enabled: true, since: 5}));
    assert.equal(await reborn.dock.supervise(true), 'started');
    assert.equal(reborn.tv.running, true);

    // Failures back off, then give up and switch off so Samsung's Home answers the Home key again.
    const bad = fixture({neverStarts: true});
    fs.writeFileSync(bad.dock.stateFile, JSON.stringify({enabled: true, since: 5}));
    assert.equal(await bad.dock.supervise(true), 'failed');
    assert.equal(await bad.dock.supervise(true), null, 'backing off: not tried again at once');
    for (let i = 0; i < 3; i++) { bad.tv.clock += 301000; await bad.dock.supervise(true); }
    assert.equal(bad.dock.readState().enabled, false, 'given up after repeated failures');
    assert.match(bad.dock.lastError, /switched off/);

    // Refresh needs the dock to be on.
    f = fixture();
    await assert.rejects(f.dock.refresh(), /off/);
    await f.dock.enable();
    f.tv.homeData = HOME_DATA.replace(hex('Netflix'), hex('Netflix HD'));
    await f.dock.refresh();
    assert.ok(fs.readFileSync(path.join(f.tmp, 'apps.tsv'), 'utf8').includes('Netflix HD'));

    console.log('PASS dock service: on, off, boot start, crash restart, back-off and give-up');
})().catch(e => { console.error(e); process.exitCode = 1; });
