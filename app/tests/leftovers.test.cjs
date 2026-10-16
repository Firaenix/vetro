'use strict';
// Runs the real cleanup script against a temporary folder pair.
const assert=require('assert').strict,fs=require('fs'),os=require('os'),path=require('path'),cp=require('child_process');
const l=require('../service/leftovers.js');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'vetro-leftovers-')),a=path.join(root,'sdk_tools'),b=path.join(a,'tmp'),shim=path.join(root,'bin');
fs.mkdirSync(path.join(a,'archive-root-0123'),{recursive:true});fs.mkdirSync(shim);
// Portable stat -c %s for macOS test hosts.
fs.writeFileSync(path.join(shim,'stat'),'#!/bin/sh\nif [ "$1" = -c ]; then wc -c < "$3" | tr -d " "; exit 0; fi\nexec /usr/bin/stat "$@"\n',{mode:0o755});
const files={'app.wgt':10,'UPPER.TPK':20,'.hidden.rpm':30,'name with space.wgt':40,'.wgt':5,'device-profile.xml':7};
Object.entries(files).forEach(([n,s])=>fs.writeFileSync(path.join(a,n),'x'.repeat(s)));
fs.writeFileSync(path.join(a,'archive-root-0123','agent.wgt'),'keep');
function run(clear,dirs){return l.parse(cp.execFileSync('sh',['-c',l.script(clear,dirs,root)],{env:{...process.env,PATH:shim+':'+process.env.PATH}}).toString(),dirs);}
try{
 const listed=run(false,[a,b]);
 assert.deepEqual(listed.errors,[],'missing tmp/ subfolder is not an error');
 assert.equal(listed.packageCount,4);assert.equal(listed.packageBytes,100);
 assert.ok(listed.files.some(f=>f.name==='.wgt'&&!f.isPackage),'name must be longer than the extension');
 assert.ok(!listed.files.some(f=>f.name==='agent.wgt'),'subfolders are never scanned');
 assert.ok(listed.storageBefore&&listed.storageBefore.availableBytes>0);
 fs.mkdirSync(b);fs.writeFileSync(path.join(b,'nested.wgt'),'x'.repeat(8));
 const cleared=run(true,[a,b]);
 assert.deepEqual(cleared.deleted.map(f=>f.name).sort(),['.hidden.rpm','UPPER.TPK','app.wgt','name with space.wgt','nested.wgt']);
 assert.equal(cleared.freedBytes,108);assert.deepEqual(cleared.failed,[]);
 assert.deepEqual(fs.readdirSync(a).sort(),['.wgt','archive-root-0123','device-profile.xml','tmp']);
 assert.ok(fs.existsSync(path.join(a,'archive-root-0123','agent.wgt')),'agent staging folders stay');
 assert.deepEqual(run(false,[path.join(root,'absent'),b]).errors,[{path:path.join(root,'absent'),error:'missing'}]);
 console.log('PASS leftovers: Apps2Samsung staging rules, dotfiles, case-insensitive packages, folders kept, bytes freed');
}finally{fs.rmSync(root,{recursive:true,force:true});}
