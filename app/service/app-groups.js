'use strict';
// Presentation only: package boundaries are authoritative. Cross-package
// families are explicit mappings, never guessed from similar display names.
function groupApps(rows) {
    var families = {
        Alexa: ['com.samsung.tv.alexa-client', 'com.samsung.tv.wakeup-engine-alexa'],
        Bixby: ['com.samsung.tv.bixby-context-client', 'com.samsung.tv.bixby-prov', 'com.samsung.tv.bixbycapsuleviewer', 'com.samsung.tv.mybixby', 'com.samsung.tv.wakeup-engine-bixby'],
        SmartThings: ['com.samsung.tizen.smartthings-client', 'com.samsung.tizen.smartthings-thing', 'com.samsung.tv.coba.smartthings'],
        AirPlay: ['com.samsung.tv.airplay-app']
    };
    // Resolve families per package first: an exact app ID must not split
    // UI and service components declared in the same package.
    var packageFamilies = Object.create(null);
    (rows || []).forEach(function(a) {
        var pkg = a.packageId || a.appId;
        var family = Object.keys(families).filter(function(f){return families[f].indexOf(pkg)>=0;})[0];
        if (family) packageFamilies[pkg] = family;
        else if (a.appId === 'NRi6kdBYJ0.AirPlayWebApp') packageFamilies[pkg] = 'AirPlay';
    });
    var groups = Object.create(null);
    (rows || []).forEach(function(a) {
        var pkg = a.packageId || a.appId;
        var family = packageFamilies[pkg] || null;
        var key = family ? 'family:' + family : 'package:' + pkg;
        if (!groups[key]) groups[key] = {key:key, family:family, members:[], packages:[]};
        var g = groups[key];g.members.push(a);
        if (g.packages.indexOf(pkg) === -1) g.packages.push(pkg);
    });
    return Object.keys(groups).map(function(key) {
        var g=groups[key];
        g.members.sort(function(a,b) {
            var score=function(x){return (x.show?4:0)+(x.component==='uiapp'?2:0)+(x.name&&!/service|starter/i.test(x.name)?1:0)-(/^app$/i.test(x.name||'')?8:0);};
            return score(b)-score(a)||(a.name||a.appId).localeCompare(b.name||b.appId);
        });
        g.primary=g.members[0];g.name=g.family||(g.packages.length===1&&g.packages[0]==='com.samsung.tv.cobalt'?'Cobalt web apps':g.primary.name||g.primary.appId);g.basis=g.family?'Known app family; separate packages':'Package declared in the registry';
        return g;
    }).sort(function(a,b){return a.name.localeCompare(b.name);});
}
module.exports=groupApps;
