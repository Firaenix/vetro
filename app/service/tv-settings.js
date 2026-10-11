'use strict';
// Native controls identified on the Q80A; no arbitrary D-Bus method or key.
var PREFIX='busctl --system call org.tizen.tv.avoc /org/tizen/tv/avoc org.tizen.tv.avoc.AvOutputControl ';
var ITEMS=[
 {id:'backlight',label:'Panel brightness',group:'picture',get:'GetBacklight',args:'i 0',set:'SetBacklight',signature:'ii',min:0,max:50},
 {id:'contrast',label:'Contrast',group:'picture',get:'GetContrast',args:'i 0',set:'SetContrast',signature:'yi',min:0,max:50},
 {id:'sharpness',label:'Sharpness',group:'picture',get:'GetSharpness',args:'i 0',set:'SetSharpness',signature:'yi',min:0,max:20},
 {id:'color',label:'Color',group:'picture',get:'GetColorStrength',args:'i 0',set:'SetColorStrength',signature:'yi',min:0,max:50},
 {id:'pictureMode',label:'Picture mode',group:'picture',get:'GetPictureMode',args:'i 0',coded:true},
 {id:'colorTone',label:'Color tone',group:'picture',get:'GetColorToneMode',args:'i 0',coded:true},
 {id:'brightness',label:'Internal brightness',group:'advanced',get:'GetBrightness',args:'i 0'},
 {id:'colorSpace',label:'Color space',group:'advanced',get:'GetColorSpace',args:'i 0',coded:true},
 {id:'localDimming',label:'Local dimming',group:'advanced',get:'GetSmartLed',args:'i 0',coded:true,set:'SetSmartLed',signature:'ii',min:1,max:2},
 {id:'gameMode',label:'Game mode',group:'advanced',get:'GetGameMode',args:'i 0',coded:true},
 {id:'hdr',label:'HDR state',group:'advanced',get:'GetHdrStatus',args:'',coded:true},
 {id:'motionLighting',label:'Motion lighting',group:'advanced',get:'GetMotionLighting',args:'',coded:true},
 {id:'ecoSensor',label:'Light sensor configuration',group:'advanced',get:'GetEcoSensor',args:'i 0',coded:true},
 {id:'ecoSensorState',label:'Light sensor state',group:'advanced',get:'GetEcoSensorState',args:'',coded:true},
 {id:'minimumBacklight',label:'Minimum brightness with sensor',group:'advanced',get:'GetEcoSensorMinimalBacklight',args:'i 0'},
 {id:'filmmakerAuto',label:'Auto switch to Filmmaker',group:'advanced',get:'GetFilmmakerAutoMode',args:'',set:'SetFilmmakerAutoMode',signature:'i',min:0,max:1,boolean:true},
 {id:'motionPlus',label:'Motion Plus',group:'advanced',get:'GetAutoMotionPlus',args:'i 0',coded:true},
 {id:'blurReduction',label:'Blur reduction',group:'advanced',get:'GetBlurReduction',args:'i 0'},
 {id:'cleanView',label:'Digital Clean View',group:'advanced',get:'GetDigitalCleanView',args:'i 0',coded:true},
 {id:'dynamicContrast',label:'Contrast enhancer',group:'advanced',get:'GetDynamicContrast',args:'i 0',coded:true},
 {id:'filmMode',label:'Film processing mode',group:'advanced',get:'GetFilmMode',args:'i 0',coded:true},
 {id:'soundMode',label:'Sound mode',group:'audio',get:'GetSoundMode',args:'u 0',coded:true},
 {id:'autoVolume',label:'Auto volume',group:'audio',get:'GetAutoVolume',args:'u 0',coded:true},
 {id:'balance',label:'Audio balance',group:'audio',get:'GetBalance',args:'u 0',coded:true},
 {id:'digitalAudioFormat',label:'Digital audio output format',group:'audio',get:'GetNordigUserDigitalAudioOutputFormat',args:'',coded:true},
 {id:'earc',label:'eARC',group:'audio',get:'GetEarcEnable',args:'',coded:true}
];
function decode(text){var m=/^([iyu]{2})\s+(-?\d+)\s+(-?\d+)\s*$/.exec(String(text));if(!m)throw Error('Unrecognized setting response');if(+m[3]!==0)throw Error('Setting unavailable (code '+m[3]+')');return +m[2];}
function check(r){if(r.exit_code||r.timed_out)throw Error(r.stderr||'TV read failed');return r.stdout;}
function Store(execute){this.execute=execute;this.busy=false;this.cached=null;this.pending=null;}
Store.prototype.read=function(){var self=this;if(this.cached&&Date.now()-this.cached.ts<2000)return Promise.resolve(this.cached);if(this.pending)return this.pending;
 var cmd=ITEMS.map(function(x){return 'echo __'+x.id+'__; '+PREFIX+x.get+' '+x.args;}).join('; ');
 this.pending=this.execute(cmd,15000).then(function(r){var output=check(r),rows=ITEMS.map(function(x){var row={id:x.id,label:x.label,group:x.group,writable:!!x.set,coded:!!x.coded,boolean:!!x.boolean,access:x.set?'verified':x.id==='hdr'||x.id==='ecoSensorState'?'state':'unverified',readOnlyReason:x.set?null:x.id==='hdr'||x.id==='ecoSensorState'?'State reported by the TV':x.coded?'Options and writes have not been tested':'Write and restore have not been tested',min:x.min,max:x.max,value:null,error:null};var section=output.split('__'+x.id+'__\n')[1];try{row.value=decode((section||'').split('__')[0].trim());}catch(e){row.error=e.message;row.writable=false;}return row;});self.cached={ts:Date.now(),items:rows,scope:'Values apply to the current source and may change with apps or HDR.'};return self.cached;}).finally(function(){self.pending=null;});return this.pending;
};
Store.prototype.write=function(p){var self=this,x=ITEMS.find(function(x){return x.id===p.id});if(!x||!x.set)return Promise.reject(Error('Setting is read-only'));
 if(!Number.isInteger(p.value)||p.value<x.min||p.value>x.max||!Number.isInteger(p.expected))return Promise.reject(Error('Invalid value'));
 if(this.busy)return Promise.reject(Error('Change already in progress'));this.busy=true;
 function get(){return self.execute(PREFIX+x.get+' '+x.args,5000).then(function(r){return decode(check(r));});}
 function set(v){return self.execute(PREFIX+x.set+' '+x.signature+' '+v+(x.signature.length>1?' 0':''),5000).then(function(r){if(!/^i 0\s*$/.test(check(r)))throw Error('TV rejected the change');});}
 return get().then(function(before){if(before!==p.expected)throw Error('TV value changed; refresh before saving');return set(p.value).then(get).then(function(after){if(after!==p.value)throw Error('Readback does not match');return {ok:true,verified:true,id:x.id,previous:before,value:after};}).catch(function(e){return set(before).then(get).then(function(restored){e.message+=' · restore '+(restored===before?'confirmed':'not confirmed');throw e;},function(){throw Error(e.message+' · restore not confirmed');});});}).finally(function(){self.cached=null;self.busy=false;});
};
function unwrap(v){if(v&&typeof v==='object'&&Object.prototype.hasOwnProperty.call(v,'type')&&Object.prototype.hasOwnProperty.call(v,'data'))return unwrap(v.data);if(Array.isArray(v))return v.map(unwrap);if(v&&typeof v==='object'){var o={};Object.keys(v).forEach(function(k){o[k]=unwrap(v[k]);});return o;}return v;}
function networkDecode(output){
 var parts=String(output).split(/__(LINKS|ADDR|ROUTES|ROUTES6)__\n/),sections={connman:parts[0]};for(var i=1;i<parts.length;i+=2)sections[parts[i]]=parts[i+1];
 var services=[],serviceError=null;try{var raw=JSON.parse(sections.connman.trim());services=unwrap(raw).data;/* outer tuple contains the services array */if(!services)services=unwrap(raw);if(services.length===1&&Array.isArray(services[0])&&Array.isArray(services[0][0]))services=services[0];services=services.map(function(pair){var p=pair[1],eth=p.Ethernet||{};return {name:p.Name||eth.Interface||p.Type,type:p.Type,state:p.State,interface:eth.Interface,mac:eth.Address,mtu:eth.MTU,autoConnect:p.AutoConnect,ipv4:p.IPv4||{},ipv4Configured:p['IPv4.Configuration']||{},ipv6:p.IPv6||{},ipv6Configured:p['IPv6.Configuration']||{},nameservers:p.Nameservers||[],nameserversConfigured:p['Nameservers.Configuration']||[],proxy:p.Proxy||{},mdns:p.mDNS,signal:p.Strength==null?null:p.Strength,security:p.Security||[]};});}catch(e){serviceError='ConnMan configuration unavailable';}
 var interfaces=[];String(sections.LINKS||'').split('\n').forEach(function(line){var m=/^\d+: ([^:@]+)(?:@[^:]+)?:.*?mtu (\d+).*?state (\S+)/.exec(line);if(!m||m[1]==='lo')return;var mac=/link\/ether ([0-9a-f:]+)/i.exec(line);interfaces.push({name:m[1],state:m[3],mtu:+m[2],mac:mac?mac[1]:null,addresses:[]});});
 String(sections.ADDR||'').split('\n').forEach(function(line){var m=/^\d+: (\S+)\s+(inet6?) (\S+).*?scope (\S+)/.exec(line);if(!m)return;var item=interfaces.find(function(x){return x.name===m[1]});if(item)item.addresses.push({family:m[2]==='inet'?'IPv4':'IPv6',address:m[3],scope:m[4]});});
 function routes(text){return String(text||'').split('\n').filter(function(l){return /^default /.test(l)}).map(function(l){var dev=/\bdev (\S+)/.exec(l),via=/\bvia (\S+)/.exec(l);return {interface:dev?dev[1]:null,gateway:via?via[1]:null};});}
 var defaults=routes(sections.ROUTES),defaults6=routes(sections.ROUTES6),active=services.find(function(x){return defaults.some(function(r){return r.interface===x.interface})})||services.find(function(x){return x.state==='online'||x.state==='ready'})||null;
 return {source:'ConnMan + kernel interfaces and routes',services:services,interfaces:interfaces,active:active,defaultRoutes:defaults,defaultRoutes6:defaults6,configurationError:serviceError,writable:false,writeReason:'Network writes and connection recovery have not been tested'};
}
Store.prototype.readNetwork=function(){if(this.networkPending)return this.networkPending;var self=this;this.networkPending=this.execute('busctl --system --json=short call net.connman / net.connman.Manager GetServices; echo __LINKS__; ip -o link; echo __ADDR__; ip -o addr; echo __ROUTES__; ip route; echo __ROUTES6__; ip -6 route',10000).then(function(r){return networkDecode(check(r));}).finally(function(){self.networkPending=null;});return this.networkPending;};

module.exports={Store:Store,ITEMS:ITEMS,decode:decode,networkDecode:networkDecode};
