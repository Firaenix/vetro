'use strict';

// App inventory: normalizes the output of tizen.application.getAppsInfo and
// tizen.package.getPackagesInfo (collected by the widget UI, see index.html)
// into rows classified for the debloat view. Pure logic, no platform access.

var debloat = require('./debloat.js');
var catalog = require('./app-catalog.js');

// Domains commonly reported for Samsung TV ads/ACR telemetry. To be reviewed
// before use: served by GET /blocklist for an external DNS blocker (Pi-hole,
// router) and offered as suggestions by the local filter, which applies only
// the domains the owner saves (local-dns.js).
var BLOCKLIST_DOMAINS = [
    'samsungads.com',
    'config.samsungads.com',
    'ads.samsung.com',
    'samsungacr.com',
    'log-config.samsungacr.com',
    'log-ingestion.samsungacr.com',
    'samsungcloudsolution.com',
    'acr0.samsungcloudsolution.com'
];

function str(v, max) { return typeof v === 'string' ? v.slice(0, max || 200) : null; }
function num(v) { return typeof v === 'number' && isFinite(v) ? v : null; }

function kindOf(appId, pkg) {
    if (debloat.isAds(appId, pkg)) return 'ads';
    if (debloat.isPrivacy(appId, pkg)) return 'privacy';
    return 'other';
}

// apps: [{id, name, packageId, show}], packages: [{id, version, totalSize, author}]
function normalize(apps, packages) {
    var byPkg = {};
    (Array.isArray(packages) ? packages : []).forEach(function (p) {
        if (p && typeof p.id === 'string') byPkg[p.id] = p;
    });
    var rows = [];
    (Array.isArray(apps) ? apps : []).slice(0, 2000).forEach(function (a) {
        if (!a || typeof a.id !== 'string' || !/^[A-Za-z0-9_.-]+$/.test(a.id)) return;
        var pkgId = str(a.packageId, 120) || a.id.split('.')[0];
        var pkg = byPkg[pkgId] || {};
        rows.push({
            appId: a.id,
            packageId: pkgId,
            name: str(a.name),
            show: a.show !== false,
            version: str(pkg.version, 40),
            size: num(pkg.totalSize),
            kind: kindOf(a.id, pkgId),
            protected: debloat.isProtected(a.id) || debloat.isProtected(pkgId)
        });
        Object.assign(rows[rows.length - 1], describe(rows[rows.length - 1]));
    });
    rows.sort(function (x, y) { return x.appId < y.appId ? -1 : x.appId > y.appId ? 1 : 0; });
    return rows;
}

function classification(r) {
    function result(category,source,reason){return {category:category,categorySource:source,categoryReason:reason};}
    if(r.protected)return result('protected','policy','Protected by Vetro');
    if(r.kind==='ads'||r.kind==='privacy')return result(r.kind,'policy','Known advertising and privacy package IDs');
    var pkg=r.packageId||'',known={
        'com.samsung.tv.alexa-client':'voice','com.samsung.tv.wakeup-engine-alexa':'voice',
        'com.samsung.tv.bixby-context-client':'voice','com.samsung.tv.bixby-prov':'voice','com.samsung.tv.bixbycapsuleviewer':'voice','com.samsung.tv.mybixby':'voice','com.samsung.tv.wakeup-engine-bixby':'voice',
        'com.samsung.tizen.smartthings-client':'connectivity','com.samsung.tizen.smartthings-thing':'connectivity','com.samsung.tv.coba.smartthings':'connectivity','com.samsung.tv.airplay-app':'connectivity'
    };
    if(known[pkg]||r.appId==='NRi6kdBYJ0.AirPlayWebApp')return result(known[pkg]||'connectivity','catalog','Known package ID');
    var id=(r.appId+' '+pkg+' '+(r.name||'')).toLowerCase(),category=null;
    if(/hotel|retail|demo-player|agingapp/.test(id))category='hotel';
    else if(/netflix|youtube|cobalt|tizentube|stremio|primevideo|disney|spotify|media-player|photo-player/.test(id))category='media';
    else if(/alexa|bixby|voice|tts|assistant|speech/.test(id))category='voice';
    else if(/allshare|bluetooth|airplay|screenmirror|multiscreen|connectivity|network/.test(id))category='connectivity';
    if(category)return result(category,'heuristic','Inferred from name or ID; function not verified');
    if(r.origin==='installed'&&r.show)return result('user','registry','Installed and menu-visible in the TV registry');
    return result(r.system?'system':'other','registry',r.system?'System package in the TV registry':'Function not classified');
}
function category(r){return classification(r).category;}
// Area, role, purpose and firmware facts for the Debloater (app-catalog.js).
function describe(r) {
    var c = catalog.describe(r);
    return {area: c.area, role: c.role, purpose: c.purpose, referencedBy: c.referencedBy, startsOn: c.startsOn, access: c.access, catalogSource: c.source};
}

function summarize(rows) {
    var out = {total: rows.length, ads: 0, privacy: 0, other: 0, protected: 0};
    rows.forEach(function (r) { out[r.kind]++; if (r.protected) out.protected++; });
    return out;
}

function blocklist(format) {
    if (format === 'hosts') {
        return BLOCKLIST_DOMAINS.map(function (d) { return '0.0.0.0 ' + d; }).join('\n') + '\n';
    }
    if (format === 'domains') return BLOCKLIST_DOMAINS.join('\n') + '\n';
    return null;
}

module.exports = {
    BLOCKLIST_DOMAINS: BLOCKLIST_DOMAINS,
    normalize: normalize,
    category: category,
    classification: classification,
    describe: describe,
    summarize: summarize,
    blocklist: blocklist
};
