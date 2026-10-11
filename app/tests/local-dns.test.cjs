'use strict';
const assert=require('assert').strict,{Filter,validate}=require('../service/local-dns.js');
assert.deepEqual(validate(['Ads.example.com','ads.example.com']),['ads.example.com']);
for(const value of [['*.example.com'],['a;reboot.example'],['127.0.0.1'],['localhost'],['x.localhost'],['-a.example']])assert.throws(()=>validate(value));
let script;const f=new Filter(async cmd=>{script=Buffer.from(cmd.split(' ')[1],'base64').toString();if(script.includes('__HOSTS__'))return {exit_code:0,stdout:'{"enabled":true,"domains":["ads.example.com"]}\n__HOSTS__\napplied\n__RESOLVERS__\nnameserver 192.0.2.53\n'};assert.ok(!/resolv.conf/.test(script));assert.ok(script.includes('hosts.original'));assert.ok(script.includes('umount /etc/hosts'));return {exit_code:0,stdout:''}});
f.apply(true,['ads.example.com']).then(s=>{assert.equal(s.applied,true);assert.deepEqual(s.resolvers,['192.0.2.53']);console.log('PASS local DNS: validated exact domains, preserved resolvers and verified applied status');}).catch(e=>{console.error(e);process.exitCode=1});
