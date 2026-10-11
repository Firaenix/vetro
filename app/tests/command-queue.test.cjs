'use strict';
const assert=require('assert').strict,path=require('path');
const c=require('./service-harness.cjs')(path.resolve(__dirname,'..')).context;
const original=c.platform.execute;
const starts=[],pending=[];
c.platform.execute=(cmd)=>{starts.push(cmd);return new Promise((resolve,reject)=>pending.push({resolve,reject}));};
(async()=>{
 try {
  const a=c.agentExecute('first'),b=c.agentExecute('second');a.catch(()=>{});
  await new Promise(setImmediate);assert.deepEqual(starts,['first']);
  pending[0].reject(new Error('fixture failure'));await assert.rejects(a,/fixture failure/);
  await new Promise(setImmediate);assert.deepEqual(starts,['first','second']);
  pending[1].resolve({exit_code:0});await b;assert.equal(c.queuedCommands,0);
  console.log('PASS command queue: serial TV requests, timeout begins at dispatch, errors do not poison queue');
 } finally {c.platform.execute=original;}
})().catch(e=>{console.error(e);process.exitCode=1});
