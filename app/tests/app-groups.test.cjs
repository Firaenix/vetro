'use strict';
const assert=require('assert').strict,groupApps=require('../service/app-groups.js'),apps=require('../service/apps.js');
const rows=[
 {appId:'alexa.client',packageId:'com.samsung.tv.alexa-client',name:'Alexa Client',show:true,component:'uiapp'},
 {appId:'alexa.starter',packageId:'com.samsung.tv.alexa-client',name:'Alexa Jump Starter',show:false},
 {appId:'wake.alexa',packageId:'com.samsung.tv.wakeup-engine-alexa',name:'Wakeup',show:false},
 {appId:'tube.ui',packageId:'tube',name:'TizenTube',show:true,component:'uiapp'},
 {appId:'tube.svc',packageId:'tube',name:'StandaloneService',show:false,onboot:true},
 {appId:'unrelated',packageId:'other',name:'Alexa Client',show:true}
];
const groups=groupApps(rows),alexa=groups.find(g=>g.name==='Alexa'),tube=groups.find(g=>g.key==='package:tube');
assert.equal(groups.length,3);assert.equal(alexa.members.length,3);assert.equal(alexa.packages.length,2);
assert.equal(tube.primary.appId,'tube.ui');assert.equal(tube.name,'TizenTube');assert.equal(tube.members.length,2);
assert.equal(groups.reduce((n,g)=>n+g.members.length,0),rows.length,'no components are discarded');
assert.equal(groups.find(g=>g.key==='package:other').members.length,1,'similar names never merge unrelated packages');
assert.equal(apps.category(rows[0]),'voice');
assert.equal(groupApps([]).length,0);
console.log('PASS app groups: package components, explicit Alexa family, unrelated names, primary app and retained members');
const families=groupApps([
 {appId:'bixby',packageId:'com.samsung.tv.mybixby',name:'VoiceDiscoveryMenu'},
 {appId:'wake',packageId:'com.samsung.tv.wakeup-engine-bixby',name:'Wakeup'},
 {appId:'shared',packageId:'org.tizen.voice-app',name:'Voice engine'},
 {appId:'st1',packageId:'com.samsung.tizen.smartthings-client',name:'Client'},
 {appId:'st2',packageId:'com.samsung.tv.coba.smartthings',name:'CompSmartThings'},
 {appId:'NRi6kdBYJ0.AirPlayWebApp',packageId:'NRi6kdBYJ0',name:'AppleAirPlay'},
 {appId:'airplay',packageId:'com.samsung.tv.airplay-app',name:'AirPlay service'}
]);
assert.equal(families.length,4);assert.equal(families.find(g=>g.name==='Bixby').members.length,2);assert.equal(families.find(g=>g.name==='AirPlay').members.length,2);assert.equal(families.find(g=>g.name==='SmartThings').members.length,2);
assert.equal(apps.classification({appId:'st1',packageId:'com.samsung.tv.coba.smartthings'}).categorySource,'catalog');assert.equal(apps.classification({appId:'unknown.voice',name:'Voice'}).categorySource,'heuristic');
console.log('PASS curated families exclude shared voice infrastructure; classification exposes evidence');
const airplayPackage=groupApps([
 {appId:'NRi6kdBYJ0.AirPlayWebApp',packageId:'NRi6kdBYJ0',name:'AirPlay',show:true},
 {appId:'NRi6kdBYJ0.service',packageId:'NRi6kdBYJ0',name:'Background service'},
 {appId:'other.airplay',packageId:'other',name:'AirPlay'}
]);
assert.equal(airplayPackage.length,2);
assert.equal(airplayPackage.find(g=>g.family==='AirPlay').members.length,2,'exact app ID must not split its package');
assert.equal(airplayPackage.find(g=>g.key==='package:other').members.length,1,'display name is not evidence of a family');
