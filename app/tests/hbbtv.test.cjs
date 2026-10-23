'use strict';
const assert=require('assert').strict,{Control,FLAG}=require('../service/hbbtv.js');
// A small TV: the menu value, the relaunch flag in /tmp and whether hbbtv_app runs. Scripts are read, not run.
function tv(start){
 const s=Object.assign({value:20,flag:false,running:true,fail:null,starts:0},start),scripts=[];
 const execute=async cmd=>{const sh=Buffer.from(cmd.split(' ')[1],'base64').toString();scripts.push(sh);
  if(sh.includes('__FLAG__'))return {exit_code:0,stdout:'value = '+s.value+' (Int32)\n__FLAG__\n'+(s.flag?1:0)+'\n__RUN__\n'+(s.running?1:0)+'\n'};
  if(s.fail&&s.fail(sh))return {exit_code:1,stdout:'',stderr:'boom'};
  const set=/vconftool set -f -t int \S+ (-?\d+)/.exec(sh);if(set)s.value=Number(set[1]);
  if(sh.includes('touch '+FLAG))s.flag=true;if(sh.includes('rm -f '+FLAG))s.flag=false;
  if(/app_launcher -t/.test(sh))s.running=false;if(/app_launcher -s/.test(sh)){s.running=true;s.starts++;}
  return {exit_code:0,stdout:''};};
 return {s,scripts,execute};
}
(async()=>{
 let backup=null;const io={readFileSync(){if(!backup)throw Error('absent');return backup},writeFileSync(f,t){backup=t},renameSync(){}};
 // Samsung's menu value Off is not enough: the app still runs and nothing blocks its relaunch.
 let t=tv({value:19,flag:false,running:true}),c=new Control(t.execute,io);
 let r=await c.read();assert.equal(r.valueOff,true);assert.equal(r.off,false,'value 19 with the app running is not off');assert.equal(r.running,true);
 await assert.rejects(c.change(false,19),/not saved/);
 await assert.rejects(c.change(true,20),/Value changed/);
 r=await c.change(true,19);assert.equal(r.changed,true);assert.equal(r.off,true);assert.equal(t.s.flag,true);assert.equal(t.s.running,false);assert.equal(t.s.starts,0,'off never starts the app');
 assert.ok(t.scripts.every(s=>!/app_launcher -s/.test(s)),'no script on the way off starts HbbTV');
 assert.equal((await c.change(true,19)).changed,false,'already off: nothing to do');
 // Turning off from On saves the value, writes 19 and restores it exactly.
 t=tv({value:20,flag:false,running:true});backup=null;c=new Control(t.execute,io);
 assert.equal((await c.read()).canRestore,false);
 r=await c.change(true,20);assert.equal(r.off,true);assert.equal(t.s.value,19,'Samsung menu Off writes 19, not 0');assert.equal(JSON.parse(backup).value,20);assert.equal(t.s.flag,true);
 r=await c.change(false,19);assert.equal(r.value,20,'restores the exact firmware value');assert.equal(r.off,false);assert.equal(t.s.flag,false);assert.equal(t.s.starts,1,'on starts HbbTV once');
 assert.equal((await c.change(false,20)).changed,false,'already on');
 // The app that does not stop: the write is undone, not left half done.
 t=tv({value:20,running:true});backup=null;c=new Control(t.execute,io);
 const exec=t.execute;t.s.fail=null;const stubborn=async cmd=>{const out=await exec(cmd);const sh=Buffer.from(cmd.split(' ')[1],'base64').toString();if(/app_launcher -t/.test(sh))t.s.running=true;return out;};
 c=new Control(stubborn,io);
 await assert.rejects(c.change(true,20),/still running.*previous state restored/);assert.equal(t.s.value,20);assert.equal(t.s.flag,false);
 // After a boot the flag is gone: enforce puts it back and stops what the firmware started.
 t=tv({value:19,flag:false,running:true});c=new Control(t.execute,io);
 assert.deepEqual(await c.enforce(),{stopped:true});assert.equal(t.s.flag,true);assert.equal(t.s.running,false);
 assert.equal((await c.enforce()).stopped,false,'second time: already off');
 t=tv({value:20,flag:false,running:true});c=new Control(t.execute,io);
 assert.equal((await c.enforce()).stopped,false,'HbbTV is on in the menu: left alone');assert.equal(t.s.running,true);assert.equal(t.s.flag,false);
 console.log('PASS HbbTV: Off means value, relaunch flag and stopped app; never starts it; exact restore; boot enforcement');
})().catch(e=>{console.error(e);process.exitCode=1});
