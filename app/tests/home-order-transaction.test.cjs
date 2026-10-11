'use strict';
const assert=require('assert').strict,fs=require('fs'),os=require('os'),path=require('path'),cp=require('child_process');
const {transactionScript,BASE,FILES}=require('../service/home-order.js');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'vetro-home-'));
function run(payload,restore,fault){let s=transactionScript(payload,restore).split(BASE).join(dir);if(fault)s='mv() { case "$3" in *appLayerCache.2) return 1;; esac; command mv "$@"; }\n'+s;return cp.spawnSync('sh',['-c',s],{encoding:'utf8'});}
try {
 FILES.forEach((f,i)=>fs.writeFileSync(path.join(dir,f),'original-'+i));
 assert.notEqual(run(Buffer.from('new').toString('base64'),false,true).status,0);
 FILES.forEach((f,i)=>assert.equal(fs.readFileSync(path.join(dir,f),'utf8'),'original-'+i,'partial rename must rollback both caches'));
 assert.equal(run(Buffer.from('new').toString('base64')).status,0);
 assert.equal(run(Buffer.from('next').toString('base64')).status,0);
 FILES.forEach((f,i)=>assert.equal(fs.readFileSync(path.join(dir,f+'.vetro-bak'),'utf8'),'original-'+i,'baseline backup immutable'));
 assert.equal(run(null,true).status,0);
 FILES.forEach((f,i)=>assert.equal(fs.readFileSync(path.join(dir,f),'utf8'),'original-'+i));
 console.log('PASS Home transaction: real files, partial rename rollback, immutable baseline, restore');
} finally {fs.rmSync(dir,{recursive:true,force:true});}
