'use strict';
const assert=require('assert').strict,ops=require('../service/component-actions.js');
const rows=[{appId:'user.ui',packageId:'user',removable:true,system:false},{appId:'core.ui',packageId:'core',system:true,removable:false},{appId:'com.samsung.tv.coba.adagent',packageId:'com.samsung.tv.coba.adagent',removable:true}];
for(const p of [{action:'flags',appId:'user.ui',flag:'oops',enabled:true},{action:'flags',appId:'user.ui',flag:'onboot',enabled:'false'},{action:'stop',appId:'user.ui;reboot'},{action:'stop',appId:'absent'},{action:'uninstall',appId:'core.ui'},{action:'stop',appId:'com.samsung.tv.coba.adagent'}])assert.throws(()=>ops.validate(p,rows));
const p={action:'flags',appId:'user.ui',flag:'onboot',enabled:false},a=ops.validate(p,rows),cmd=ops.command(p,a);
const script=Buffer.from(cmd.split(' ')[1],'base64').toString();assert.ok(script.includes('BEGIN IMMEDIATE'));assert.ok(script.includes("app_onboot='false'"));assert.ok(script.includes('startup-backups'));assert.ok(!script.includes('app_autorestart='),'changing boot must preserve restart');
console.log('PASS component actions: exact installed targets, protected components, removable packages and independent persistent flags');
