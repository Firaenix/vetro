'use strict';
const assert=require('assert').strict,{Control}=require('../service/hbbtv.js');
(async()=>{let stored=20,backup=null,calls=0;const io={readFileSync(){if(!backup)throw Error('absent');return backup},writeFileSync(f,s){backup=s},renameSync(){}};
const c=new Control(async cmd=>{const s=Buffer.from(cmd.split(' ')[1],'base64').toString();if(s.includes('vconftool set')){calls++;stored=Number(s.match(/data-service (-?\d+)/)[1]);return {exit_code:0,stdout:''}}return {exit_code:0,stdout:'value = '+stored+' (Int32)'}},io);
assert.equal((await c.read()).canRestore,false);await assert.rejects(c.change(false,20),/not saved/);await assert.rejects(c.change(true,19),/Value changed/);assert.equal(calls,0);
assert.equal((await c.change(true,20)).off,true);assert.equal(JSON.parse(backup).value,20);assert.equal((await c.change(false,0)).value,20,'restore exact firmware value, never hardcode 19');assert.equal(c.busy,false);
console.log('PASS HbbTV: stale-value protection, persistent backup, exact restore of firmware bitfield');})().catch(e=>{console.error(e);process.exitCode=1});
