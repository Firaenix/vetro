'use strict';
const assert=require('assert').strict,{Store,decode}=require('../service/tv-settings.js');
assert.equal(decode('yi 45 0\n'),45);assert.throws(()=>decode('ii 4 -1'),/unavailable/);assert.throws(()=>decode('garbage'));
(async()=>{
 let value=45,sets=[],commands=[];
 const s=new Store(async c=>{commands.push(c);if(c.includes('SetContrast')){value=+c.match(/SetContrast yi (\d+) 0/)[1];sets.push(value);return {stdout:'i 0',exit_code:0};}return {stdout:'yi '+value+' 0',exit_code:0};});
 await assert.rejects(s.write({id:'arbitrary;cmd',value:44,expected:45}));await assert.rejects(s.write({id:'contrast',value:51,expected:45}));assert.equal(commands.length,0);
 await assert.rejects(s.write({id:'contrast',value:44,expected:42}),/changed/);assert.deepEqual(sets,[]);
 const changed=await s.write({id:'contrast',value:44,expected:45});assert.equal(changed.verified,true);assert.equal(value,44);
 let phase=0;const rollback=new Store(async c=>{if(c.includes('SetContrast')){phase++;return {stdout:'i 0',exit_code:0};}return {stdout:'yi '+(phase===1?40:45)+' 0',exit_code:0};});
 await assert.rejects(rollback.write({id:'contrast',value:44,expected:45}),/restore confirmed/);assert.equal(phase,2);assert.equal(rollback.busy,false);
 let film=1;const f=new Store(async c=>{if(c.includes('SetFilmmakerAutoMode')){assert.match(c,/SetFilmmakerAutoMode i [01]$/);film=+c.slice(-1);return {stdout:'i 0',exit_code:0};}return {stdout:'ii '+film+' 0',exit_code:0};});await f.write({id:'filmmakerAuto',value:0,expected:1});assert.equal(film,0);await assert.rejects(f.write({id:'localDimming',value:0,expected:2}),/Invalid/);
 console.log('PASS TV settings: whitelist, status decoding, bounds, stale values, read-after-write and verified rollback');
})().catch(e=>{console.error(e);process.exitCode=1});
