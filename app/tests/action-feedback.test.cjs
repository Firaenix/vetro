'use strict';
const assert=require('assert').strict,vm=require('vm');
const html=require('../service/dashboard.js')();
const nodes={},el=id=>nodes[id]||(nodes[id]={value:'',hidden:true,textContent:'',innerHTML:'',disabled:false,focus(){}});
let apps=[{appId:'example.app',packageId:'example.pkg',name:'Example <TV>',disabled:false,onboot:true,autorestart:true,category:'other'}];
let mutation=()=>Promise.resolve({ok:true,verified:true}),inventoryError=null,monitorError=null;
const calls=[],timers=[];
const sandbox={document:{getElementById:el,querySelectorAll:()=>[],addEventListener(){}},console,confirm:()=>true,
 setTimeout(fn){timers.push(fn);return timers.length},clearTimeout(){},setInterval(){},
 fetch:async(url,opts)=>{calls.push({url,body:opts&&opts.body?JSON.parse(opts.body):null});
 let data;
 if(url==='/debloat'||url==='/components/action')data=await mutation();
 else if(url.startsWith('/apps')){if(inventoryError)throw Error(inventoryError);data={apps,summary:{total:apps.length},source:'package registry + public probe'};}
 else if(url.startsWith('/monitor')){if(monitorError)throw Error(monitorError);data={ts:Date.now(),memory:{totalBytes:1000,availableBytes:null},cpu:{percent:null,cores:[]},processes:[],network:[]};}
 else if(url==='/input')data={devices:[],status:{events:[]}};else if(url==='/remap')data={rules:[]};else data={};
 return {ok:true,json:async()=>data};}
};
vm.runInNewContext(html.match(/<script>([\s\S]*?)<\/script>/)[1],sandbox);
const tick=()=>new Promise(r=>setImmediate(r));
(async()=>{
 await tick();
 const app=apps[0];
 let resolve;mutation=()=>new Promise(r=>resolve=r);
 const first=sandbox.runComponentAction(app,{action:'disable',appId:app.appId});
 assert.equal(el('toggleApp').disabled,true);assert.match(el('operationItems').innerHTML,/In progress/);
 await sandbox.runComponentAction(app,{action:'uninstall',appId:app.appId});
 assert.equal(calls.filter(c=>c.url==='/debloat'||c.url==='/components/action').length,1,'double click sends a single mutation');
 apps=[{...app,disabled:true}];resolve({ok:true,verified:true,changed:true});assert.equal(await first,true);
 assert.equal(el('toggleApp').disabled,false);assert.match(el('operationItems').innerHTML,/Example &lt;TV&gt;/);assert.match(el('operationItems').innerHTML,/Existing processes/);
 assert.match(el('appGrid').innerHTML,/disabled-row/,'verified inventory renders grey');
 assert.equal(el('actionToast').hidden,false,'last action is confirmed with a toast');assert.match(el('actionToast').textContent,/^Disable app · Example <TV> · Confirmed$/);assert.equal(el('actionToast').className,'success');
 timers.forEach(fn=>fn());assert.equal(el('actionToast').hidden,true,'toast disappears by itself');assert.equal(el('operationLog').hidden,false,'action history does not disappear with toast timeout');
 assert.equal(el('impactResult').textContent,'','no invented savings from null metrics');
 mutation=async()=>({ok:true,verified:true,changed:false});await sandbox.runComponentAction(app,{action:'enable',appId:app.appId});assert.match(sandbox.operationEntries[0].message,/Already in the requested state/);
 mutation=async()=>({ok:true});assert.equal(await sandbox.runComponentAction(app,{action:'stop',appId:app.appId}),false);assert.equal(sandbox.operationEntries[0].state,'warning');assert.match(sandbox.operationEntries[0].message,/did not confirm/);
 mutation=async()=>({ok:false,error:'previous flag restored'});await sandbox.runComponentAction(app,{action:'disable',appId:app.appId});assert.match(sandbox.operationEntries[0].message,/restored/);
 mutation=async()=>({ok:true,verified:true});inventoryError='Inventario offline';await sandbox.runComponentAction(app,{action:'uninstall',appId:app.appId});assert.match(sandbox.operationEntries[0].message,/Package removed/);assert.match(sandbox.operationEntries[0].message,/view could not refresh/);assert.match(sandbox.operationEntries[0].message,/do not repeat/);assert.equal(sandbox.operationEntries[0].state,'warning');
 inventoryError=null;monitorError='Processes offline';await sandbox.runComponentAction(app,{action:'stop',appId:app.appId});assert.match(sandbox.operationEntries[0].message,/Processes offline/);assert.equal(sandbox.operationEntries[0].state,'warning');
 monitorError=null;sandbox.bootData={apps:[app],services:[]};apps=[{...app,onboot:false}];await sandbox.runComponentAction(app,{action:'flags',flag:'onboot',enabled:false,appId:app.appId});assert.equal(sandbox.bootData.apps[0].onboot,false);assert.match(sandbox.operationEntries[0].message,/Start at boot: off/);
 for(let i=0;i<12;i++)await sandbox.runComponentAction(app,{action:'enable',appId:app.appId});assert.equal(sandbox.operationEntries.length,10);
 console.log('PASS action feedback: pending lock, explicit verification, no-op, grey state, refresh failures, persistent bounded history, startup sync');
})().catch(e=>{console.error(e);process.exitCode=1});
