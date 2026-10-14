'use strict';
// Q80A native menu verified 2026-10-13: Off=19, On=20.
// Recognize legacy Vetro value 0 as Off; new writes use the native menu value.
var fs=require('fs'),KEY='db/menu/system/data-service',FILE='/opt/usr/home/owner/share/vetro-hbbtv.json';
function wrap(s){return 'echo '+Buffer.from(s).toString('base64')+' | base64 -d | sh';}
function check(r){if(r.exit_code||r.timed_out)throw Error(r.stderr||r.stdout||'HbbTV unavailable');return r.stdout||'';}
function Control(execute,storage){this.execute=execute;this.fs=storage||fs;this.busy=false;}
Control.prototype.read=function(){var self=this;return this.execute(wrap('vconftool get '+KEY+' 2>&1'),6000).then(function(r){var m=/value = (-?\d+) \(Int32\)/.exec(check(r));if(!m)throw Error('HbbTV value unreadable');var v=Number(m[1]),saved=null;try{var b=JSON.parse(self.fs.readFileSync(FILE,'utf8'));if(Number.isInteger(b.value)&&b.value>0&&b.value!==19&&b.value<=2147483647)saved=b.value;}catch(e){}return {value:v,off:v===0||v===19,restoreValue:saved,canRestore:saved!==null,source:KEY,verification:'HbbTV storage and reload; visual effect must be checked on the TV'};});};
Control.prototype.change=function(off,expected){var self=this;if(typeof off!=='boolean'||!Number.isInteger(expected))return Promise.reject(Error('Invalid HbbTV state'));if(this.busy)return Promise.reject(Error('HbbTV change already in progress'));this.busy=true;var previous;
function apply(value){return self.execute(wrap('set -e\nvconftool set -f -t int '+KEY+' '+value+'\nif app_launcher -S | grep -q "^[[:space:]]*org.tizen.hbbtv[[:space:]]"; then app_launcher -t org.tizen.hbbtv; fi\napp_launcher -s org.tizen.hbbtv'),12000).then(check);}
return this.read().then(function(s){if(s.value!==expected)throw Error('Value changed; refresh before editing');previous=s.value;var target=off?19:s.restoreValue;if(target===null)throw Error('Previous value not saved; restore unavailable');if(target===s.value||(off&&s.off))return Object.assign(s,{changed:false});
 if(off&&s.value>0){var tmp=FILE+'.tmp';self.fs.writeFileSync(tmp,JSON.stringify({value:s.value})+'\n',{mode:0o600});self.fs.renameSync(tmp,FILE);}
 return apply(target).then(function(){return self.read();}).then(function(after){if(after.value!==target)throw Error('HbbTV write not confirmed');return Object.assign(after,{changed:true});}).catch(function(e){return apply(previous).then(function(){return self.read();}).then(function(restored){throw Error(e.message+' · '+(restored.value===previous?'previous state restored':'restore not confirmed'));},function(){throw Error(e.message+' · restore not confirmed');});});
}).finally(function(){self.busy=false;});};
module.exports={Control:Control,KEY:KEY,FILE:FILE};
