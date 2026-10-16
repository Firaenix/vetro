'use strict';
// Install leftovers, ported from Apps2Samsung's TV Toolbox (MIT, see
// THIRD_PARTY_NOTICES.md): the platform pushes every package to the staging
// folder before installing it and never removes it. Only files directly in the
// two folders are considered; subfolders are never touched. Clear deletes only
// package files (.wgt/.tpk/.rpm), one at a time; other files stay.
var DIRS = ['/home/owner/share/tmp/sdk_tools', '/home/owner/share/tmp/sdk_tools/tmp'];
var STORAGE = '/home/owner/share/tmp';

function wrap(s) { return 'echo ' + Buffer.from(s).toString('base64') + ' | base64 -d | sh'; }

function script(clear, dirs, storagePath) {
    dirs = dirs || DIRS;
    var storage = 'df -kP ' + (storagePath || STORAGE) + ' 2>/dev/null | awk \'NR==2{print $2" "$4}\'';
    return 'echo "S before $(' + storage + ')"\ni=0\nfor d in ' + dirs.join(' ') + '; do\n' +
        ' if [ ! -d "$d" ]; then echo "E $i missing"; i=$((i+1)); continue; fi\n' +
        ' if [ ! -r "$d" ] || [ ! -x "$d" ]; then echo "E $i unreadable"; i=$((i+1)); continue; fi\n' +
        // Include dotfiles; a plain * glob would miss them.
        ' for f in "$d"/* "$d"/.[!.]* "$d"/..?*; do\n' +
        '  [ -e "$f" ] || [ -L "$f" ] || continue\n' +
        '  [ -d "$f" ] && continue\n' +
        '  n=${f##*/}; s=$(stat -c %s "$f" 2>/dev/null || echo 0)\n' +
        '  b=$(printf %s "$n" | base64 | tr -d "\\n")\n' +
        // The name must be longer than the extension, as in Apps2Samsung.
        '  p=0; case "$n" in ?*.[wW][gG][tT]|?*.[tT][pP][kK]|?*.[rR][pP][mM]) p=1;; esac\n' +
        (clear
            ? '  if [ "$p" = 1 ]; then rm -f -- "$f"; if [ -e "$f" ] || [ -L "$f" ]; then echo "X $i $s $b"; else echo "D $i $s $b"; fi; else echo "F $i $s 0 $b"; fi\n'
            : '  echo "F $i $s $p $b"\n') +
        ' done\n i=$((i+1))\ndone\necho "S after $(' + storage + ')"\n';
}

function name(b64) { try { return Buffer.from(b64, 'base64').toString('utf8'); } catch (e) { return null; } }
function storage(line) {
    var f = String(line || '').trim().split(/\s+/);
    return f.length === 2 && /^\d+$/.test(f[0]) && /^\d+$/.test(f[1]) ? {totalBytes: +f[0] * 1024, availableBytes: +f[1] * 1024} : null;
}

function parse(text, dirs) {
    dirs = dirs || DIRS;
    var out = {dirs: dirs.slice(), files: [], deleted: [], failed: [], errors: [], storageBefore: null, storageAfter: null};
    String(text || '').split('\n').forEach(function (l) {
        var m;
        if ((m = /^S (before|after) ?(.*)$/.exec(l))) out[m[1] === 'before' ? 'storageBefore' : 'storageAfter'] = storage(m[2]);
        else if ((m = /^E (\d) (\w+)$/.exec(l))) {
            // A missing tmp/ subfolder is normal; anything else is reported.
            if (!(m[2] === 'missing' && m[1] !== '0')) out.errors.push({path: dirs[+m[1]], error: m[2]});
        } else if ((m = /^F (\d) (\d+) ([01]) ([A-Za-z0-9+/=]+)$/.exec(l))) {
            out.files.push({name: name(m[4]), path: dirs[+m[1]] + '/' + name(m[4]), size: +m[2], isPackage: m[3] === '1'});
        } else if ((m = /^([DX]) (\d) (\d+) ([A-Za-z0-9+/=]+)$/.exec(l))) {
            (m[1] === 'D' ? out.deleted : out.failed).push({name: name(m[4]), path: dirs[+m[2]] + '/' + name(m[4]), size: +m[3]});
        }
    });
    var packages = out.files.filter(function (f) { return f.isPackage; });
    out.packageCount = packages.length;
    out.packageBytes = packages.reduce(function (n, f) { return n + f.size; }, 0);
    out.freedBytes = out.deleted.reduce(function (n, f) { return n + f.size; }, 0);
    return out;
}

function Leftovers(execute) { this.execute = execute; this.busy = false; }
Leftovers.prototype.list = function () {
    return this.execute(wrap(script(false)), 15000).then(function (r) {
        if (r.exit_code || r.timed_out) throw new Error('Staging folder unreadable');
        return parse(r.stdout);
    });
};
Leftovers.prototype.clear = function () {
    var self = this;
    if (this.busy) return Promise.reject(new Error('Cleanup already in progress'));
    this.busy = true;
    return this.execute(wrap(script(true)), 60000).then(function (r) {
        if (r.timed_out) throw new Error('Cleanup did not finish in time; refresh to see what remains');
        var result = parse(r.stdout);
        // Files that were not packages stay; list them as the current contents.
        return Object.assign(result, {ok: !result.failed.length && !result.errors.length});
    }).finally(function () { self.busy = false; });
};

module.exports = {Leftovers: Leftovers, DIRS: DIRS, script: script, parse: parse};
