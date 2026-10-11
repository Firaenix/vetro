'use strict';
var protectedApp=require('./debloat.js').isProtected;
function wrap(s){return 'echo '+Buffer.from(s).toString('base64')+' | base64 -d | sh';}
function validId(s){return typeof s==='string'&&/^[A-Za-z0-9_.-]{1,180}$/.test(s);}
function validate(p,rows){
 if(!p||!validId(p.appId))throw Error('Invalid app ID');
 var a=rows.find(function(a){return a.appId===p.appId});if(!a)throw Error('App not installed');
 if(protectedApp(a.appId)||protectedApp(a.packageId)||/^vetrotvapp(?:\.|$)/.test(a.appId))throw Error('Protected component');
 if(['stop','flags','uninstall'].indexOf(p.action)<0)throw Error('Invalid action');
 if(p.action==='flags'&&(['onboot','autorestart'].indexOf(p.flag)<0||typeof p.enabled!=='boolean'))throw Error('Invalid flag');
 if(p.action==='uninstall'&&(!a.removable||a.system||!validId(a.packageId)||rows.some(function(r){return r.packageId===a.packageId&&r.protected})))throw Error('Package protected or not removable');
 return a;
}
function command(p,a){
 if(p.action==='stop')return wrap('app_launcher -k '+a.appId);
 if(p.action==='uninstall')return wrap('pkgcmd -u -n '+a.packageId);
 var field=p.flag==='onboot'?'app_onboot':'app_autorestart',db='/opt/dbspace/.pkgmgr_parser.db';
 return wrap('set -e\nmkdir -p /home/owner/share/vetro/startup-backups\nbackup=/home/owner/share/vetro/startup-backups/'+a.appId+'\nif [ ! -f "$backup" ]; then sqlite3 -readonly '+db+' "SELECT app_onboot,app_autorestart FROM package_app_info WHERE app_id=\''+a.appId+'\';" > "$backup"; fi\nsqlite3 -bail '+db+' "BEGIN IMMEDIATE; UPDATE package_app_info SET '+field+'=\''+(p.enabled?'true':'false')+'\' WHERE app_id=\''+a.appId+'\'; COMMIT;"\nsqlite3 -readonly '+db+' "SELECT '+field+' FROM package_app_info WHERE app_id=\''+a.appId+'\';"');
}
module.exports={validate:validate,command:command};
