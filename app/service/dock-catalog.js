'use strict';
// The dock's app list, built from what Samsung's own Home reads, so the two start out the same:
//   - the Home row order       .../apps_rw/com.samsung.tv.csfs/data/.appLayerCache.1 (or .2)
//   - the web app registry     /opt/dbspace/.webappservice.db     (title and Tizen app id)
//   - the registry's icons     /opt/share/webappservice/apps_icon/all/<id>/
//   - the package icons        /opt/dbspace/.pkgmgr_parser.db     (sideloaded apps, TV Plus)
// Everything is read in one shell call. The result is a tab-separated list for the dock
// (dock/src/Core/Catalog.cs): slug, label, app id, fallback, icon file. The dock rounds the
// icons itself; this module never touches an image.

var ORDER_DIR = '/opt/usr/home/owner/apps_rw/com.samsung.tv.csfs/data';
var ICON_ROOT = '/opt/share/webappservice/apps_icon/all/';
var MAX_ENTRIES = 40;          // the dock refuses more
var APP_ID = /^[A-Za-z0-9_.-]{1,120}$/;
var ICON_FILE = /^(?:\/opt\/share\/webappservice\/apps_icon|\/opt\/usr\/apps|\/usr\/apps)\/[A-Za-z0-9_.\/-]{1,160}\.png$/;
var VIEWER = 'org.tizen.tv-viewer';
// The dock repeats this check, but the file is written here, so refuse a bad path here as well.
function iconOk(p) { return ICON_FILE.test(p) && p.indexOf('..') < 0 && p.indexOf('//') < 0; }

// Live TV entries in the Home row are not web apps. The icon comes from the package of the same
// name when the TV has one; the dock draws its own generic one otherwise.
var LIVE = {
    TVPLUS: {slug: 'tvplus', label: 'Samsung TV Plus', iconPackage: 'com.samsung.tv.tvplus'},
    RF: {slug: 'livetv', label: 'Live TV', iconPackage: null}
};

// Source and Settings close the row, as they do in Samsung's Home.
var SYSTEM_ROWS = [
    'source\tSource\tpanel:inputs',
    'settings\tSettings\tsys:com.samsung.tv.csfs'
];

function script() {
    var sizes = '224x224 304x304 152x152 104x104 icon';
    return [
        'B=' + ORDER_DIR,
        '{ cat "$B/.appLayerCache.1" 2>/dev/null || cat "$B/.appLayerCache.2" 2>/dev/null; } | sed "s/^/O|/"',
        'sqlite3 -readonly /opt/dbspace/.webappservice.db "SELECT \'R|\'||hex(id)||\'|\'||hex(title)||\'|\'||hex(tizen_id)||\'|\'||is_hidden FROM widgetinfo;" 2>/dev/null',
        'for d in ' + ICON_ROOT + '*/; do id=$(basename "$d"); for s in ' + sizes + '; do',
        '  if [ -f "$d$s.png" ]; then echo "I|$id|$d$s.png"; break; fi; done; done',
        'sqlite3 -readonly /opt/dbspace/.pkgmgr_parser.db "SELECT \'P|\'||hex(a.app_id)||\'|\'||hex(l.app_icon) FROM package_app_info a JOIN package_app_localized_info l ON l.app_id=a.app_id WHERE l.app_icon != \'\';" 2>/dev/null',
        'true'
    ].join('\n');
}

function wrap(s) { return 'echo ' + Buffer.from(s).toString('base64') + ' | base64 -d | sh'; }
function unhex(v) {
    if (!/^(?:[a-fA-F0-9]{2})*$/.test(v)) throw new Error('invalid registry field');
    return Buffer.from(v, 'hex').toString('utf8');
}

// Splits the script's output into what each source said. Lines that do not parse are skipped:
// one odd registry row must not leave the TV without a dock.
function parse(text) {
    var out = {order: [], registry: {}, icons: {}, packageIcons: {}};
    String(text || '').split('\n').forEach(function (line) {
        line = line.replace(/\r$/, '');
        var f = line.split('|');
        try {
            if (f[0] === 'O') {
                var entry = f.slice(1).join('|').trim();
                if (/^[sd]\/[A-Za-z0-9_]+@\S+$/.test(entry)) out.order.push(entry);
            } else if (f[0] === 'R' && f.length === 5) {
                out.registry[unhex(f[1])] = {title: unhex(f[2]), appId: unhex(f[3]), hidden: f[4] === '1'};
            } else if (f[0] === 'I' && f.length === 3) {
                if (iconOk(f[2])) out.icons[f[1]] = f[2];
            } else if (f[0] === 'P' && f.length === 3) {
                var icon = unhex(f[2]), id = unhex(f[1]);
                if (iconOk(icon) && !out.packageIcons[id]) out.packageIcons[id] = icon;
            }
        } catch (e) { /* skip the line */ }
    });
    return out;
}

function slugify(text) {
    var s = String(text).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 36);
    return s || 'app';
}

function cleanLabel(text, fallback) {
    var s = String(text || '').replace(/[\u0000-\u001f\u007f|]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 40).trim();
    return s || fallback;
}

// Same order as Samsung's row. Apps the registry does not know, hidden ones and anything with an
// unusable id are left out and listed in `skipped`, so the page can say why a row is missing.
function build(parsed) {
    var entries = [], skipped = [], slugs = {};
    function add(slug, label, appId, icon) {
        var base = slug, n = 2;
        while (slugs[slug] || slug === 'source' || slug === 'settings') slug = base.slice(0, 36) + '-' + n++;
        slugs[slug] = true;
        entries.push({slug: slug, label: label, appId: appId, icon: icon || null});
    }
    parsed.order.forEach(function (item) {
        if (entries.length >= MAX_ENTRIES - SYSTEM_ROWS.length) { skipped.push({item: item, reason: 'The dock holds ' + MAX_ENTRIES + ' entries'}); return; }
        var kind = item.slice(0, item.indexOf('@')), ident = item.slice(item.indexOf('@') + 1);
        if (kind === 's/livetv') {
            var live = LIVE[ident];
            if (!live) { skipped.push({item: item, reason: 'Unknown live source'}); return; }
            add(live.slug, live.label, VIEWER, live.iconPackage && parsed.packageIcons[live.iconPackage]);
            return;
        }
        if (kind !== 'd/webapp') { skipped.push({item: item, reason: 'Unsupported entry'}); return; }
        var reg = parsed.registry[ident];
        if (!reg) { skipped.push({item: item, reason: 'Not installed'}); return; }
        if (reg.hidden) { skipped.push({item: item, reason: 'Hidden in the registry'}); return; }
        if (!APP_ID.test(reg.appId)) { skipped.push({item: item, reason: 'Unusable app id'}); return; }
        add(slugify(reg.title), cleanLabel(reg.title, reg.appId), reg.appId, parsed.icons[ident] || parsed.packageIcons[reg.appId]);
    });
    return {entries: entries, skipped: skipped};
}

function tsv(built) {
    var lines = ['# written by Vetro from the TV\'s own Home row; do not edit, it is rebuilt every time the dock starts'];
    built.entries.forEach(function (e) {
        lines.push([e.slug, e.label, e.appId, '', e.icon || ''].join('\t').replace(/\t+$/, ''));
    });
    return lines.concat(SYSTEM_ROWS).join('\n') + '\n';
}

// Reads the TV and returns {tsv, count, skipped}. Throws when the Home row cannot be read at all,
// because a dock with no apps is worse than none.
function load(execute) {
    return execute(wrap(script()), 20000).then(function (r) {
        if (r.exit_code || r.timed_out) throw new Error(r.stderr || 'Home data unavailable');
        var parsed = parse(r.stdout);
        if (!parsed.order.length) throw new Error('The Home row is empty or unreadable');
        var built = build(parsed);
        if (!built.entries.length) throw new Error('None of the Home row apps could be matched in the registry');
        return {tsv: tsv(built), count: built.entries.length, skipped: built.skipped};
    });
}

module.exports = {load: load, parse: parse, build: build, tsv: tsv, script: script, slugify: slugify, cleanLabel: cleanLabel};
