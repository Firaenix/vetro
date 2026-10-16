'use strict';
const assert=require('assert').strict;
const quick=require('../service/quick-settings.js');
const alexa=quick.find('alexa').ids;
function rows(disabled){return alexa.map(id=>({appId:id,disabled:disabled.includes(id)}));}
assert.equal(quick.state(quick.find('alexa'),rows(alexa)).status,'off');
assert.equal(quick.state(quick.find('alexa'),rows([])).status,'on');
const partial=quick.state(quick.find('alexa'),rows([alexa[3]]));assert.equal(partial.status,'partial');assert.deepEqual(partial.enabled,alexa.slice(0,3));
assert.equal(quick.state(quick.find('alexa'),[]).status,'unavailable');
assert.equal(quick.state(quick.find('alexa'),[{appId:alexa[0]}]).status,'unknown');
assert.equal(quick.state(quick.find('alexa'),rows(alexa).slice(1)).status,'off','missing members are skipped');
assert.throws(()=>quick.command(['bad id'],true),/Invalid app ID/);
assert.deepEqual(quick.exitCodes('a.b 0\nc.d 1\n'),{'a.b':0,'c.d':1});
assert.deepEqual(quick.running('\tcom.samsung.tv.alexa-client (812)\n other (9)\n'),['com.samsung.tv.alexa-client','other']);
assert.ok(quick.ALLOWED_IDS.indexOf('org.tizen.multi-assistant-service')<0&&!quick.ALLOWED_IDS.some(id=>/tts-engine/.test(id)),'system assistant hub and Voice Guide TTS are excluded');
function decode(cmd){const m=/^echo (\S+) \| base64 -d \| sh$/.exec(cmd);return m?Buffer.from(m[1],'base64').toString():cmd;}
function harness(opts){
 let disabled=new Set(opts.disabled||[]),calls=[],registryCalls=0;
 return {calls,disabled,deps:{invalidate(){},inventory(){registryCalls++;if(opts.registryError&&registryCalls>1)return Promise.resolve({apps:[],registryError:'x'});return Promise.resolve({apps:alexa.map(id=>({appId:id,disabled:disabled.has(id)}))});},
  execute(cmd){const s=decode(cmd);calls.push(s);
   if(s==='app_launcher -S')return Promise.resolve({exit_code:0,stdout:(opts.running||[]).map((id,i)=>'\t'+id+' ('+(100+i)+')').join('\n')});
   const m=/for id in (.*); do (pkgcmd (-D|-A)|app_launcher -k)/.exec(s);const ids=m[1].split(' ');
   if(m[2]==='app_launcher -k')return Promise.resolve({exit_code:0,stdout:ids.map(id=>id+' 0').join('\n')});
   ids.forEach(id=>{if(opts.stuck&&opts.stuck===id&&m[3]==='-D')return;m[3]==='-D'?disabled.add(id):disabled.delete(id);});
   return Promise.resolve({exit_code:0,stdout:ids.map(id=>id+' 0').join('\n')});}}};}
(async()=>{
 let h=harness({disabled:[alexa[3]],running:[alexa[0]]});
 let r=await quick.apply('alexa',true,h.deps);
 assert.deepEqual(r.changed,alexa.slice(0,3),'only enabled members are changed');assert.equal(r.state.status,'off');assert.deepEqual(r.stopped,[alexa[0]],'running members are stopped');
 assert.equal(h.calls.filter(c=>/pkgcmd/.test(c)).length,1,'one script for the whole group');
 h=harness({disabled:alexa});r=await quick.apply('alexa',false,h.deps);assert.equal(r.state.status,'on');assert.ok(!h.calls.includes('app_launcher -S'),'enabling stops nothing');
 h=harness({disabled:[],stuck:alexa[1]});
 await assert.rejects(quick.apply('alexa',true,h.deps),/Not confirmed for com.samsung.tv.alexa-fullscreen-app · previous state restored/);
 assert.equal(h.disabled.size,0,'rollback re-enables every changed member');
 h=harness({disabled:alexa});r=await quick.apply('alexa',true,h.deps);assert.deepEqual(r.changed,[]);assert.ok(!h.calls.some(c=>/pkgcmd/.test(c)),'no command when already off');
 await assert.rejects(quick.apply('nope',true,h.deps),/Unknown quick setting/);
 await assert.rejects(quick.apply('alexa','yes',h.deps),/Invalid state/);
 h=harness({disabled:[],registryError:true});await assert.rejects(quick.apply('alexa',true,h.deps),/App registry unavailable/);
 console.log('PASS quick settings: group state, one-script apply, verified readback, rollback, stop of running members, exclusions');
})().catch(e=>{console.error(e);process.exitCode=1});
