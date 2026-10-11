'use strict';
const assert = require('assert').strict;
const { Catalog, parseMenu, parseValue } = require('../service/menu-settings.js');

const MENU = JSON.stringify({
    menuitems: {
        'adaptive-picture': { 'setting-ui': { style: 'switch' }, data: { key: 'adaptive-picture', type: 'integer', list: [{ value: 0, 'display-value': 'SID_OFF' }, { value: 1, 'display-value': 'SID_ON' }] } },
        'picture-mode': { 'setting-ui': { style: 'list' }, data: { provider:'vconf-dataprovider', key: 'menu/picture/mode', type: 'integer', list: [{ value: 0, 'display-value': 'SID_STD' }, { value: 1, 'display-value': 'SID_MOVIE' }] } },
        'unlisted': {data:{key:'db/menu/test/unlisted',type:'integer'}},
        'no-key-item': { 'setting-ui': { style: 'title' }, data: { type: 'integer' } },
        'factor-reset': { 'setting-ui': { style: 'switch' }, data: { key: 'db/factory/reset', type: 'integer' } }
    },
    menutree: { picture: { submenuitems: ['picture-mode'] }, general: { submenuitems: ['adaptive-picture', 'factor-reset'] } }
});

const c = parseMenu(MENU);
assert.equal(c.count, 4); // no-key-item escluso
const ap = c.items.find(i => i.id === 'adaptive-picture');
assert.equal(ap.vconfKey, 'adaptive-picture');
assert.equal(ap.group, 'general');
assert.equal(ap.options.length, 2);
assert.equal(c.items.find(i => i.id === 'factor-reset').danger, true);
assert.equal(parseValue('db/x, value = 5 (Int32)').value, '5');

let setKey = null, stored = '0';
const runner = async function (cmd) {
    const s = Buffer.from(cmd.split(' ')[1], 'base64').toString();
    if (/^cat /.test(s)) return { exit_code: 0, stdout: MENU };
    if (/vconftool get .*picture\/mode/.test(s)) return { exit_code: 0, stdout: 'menu/picture/mode, value = ' + stored + ' (Int32)' };
    if (/vconftool set .*picture\/mode/.test(s)) { setKey = s; const m = /'(-?\d+)'\s*$/.exec(s.trim()); stored = m ? m[1] : stored; return { exit_code: 0, stdout: '' }; }
    return { exit_code: 0, stdout: '' };
};

(async function () {
    const cat = new Catalog(runner);
    const r = await cat.read('picture-mode');
    assert.equal(r.value, '0');
    await assert.rejects(cat.write('factor-reset', '1'), /Protected/);
    await assert.rejects(cat.write('picture-mode', '9'), /allowed option/);
    assert.equal(setKey, null);
    await assert.rejects(cat.write('unlisted', '1'), /Options not tested/);
    await assert.rejects(cat.write('picture-mode', '1.5'), /Invalid integer/);
    let release; const locked=new Catalog(()=>new Promise(r=>{release=r})); const pending=locked.write('picture-mode','1'); await assert.rejects(locked.write('picture-mode','1'), /already in progress/); release({exit_code:1,stdout:'fixture error'}); await assert.rejects(pending,/fixture error/); assert.equal(locked.busy,false);
    const w = await cat.write('picture-mode', '1');
    assert.equal(w.changed, true); assert.equal(w.verified, true);
    assert.ok(/vconftool set -f -t int/.test(setKey));
    let boolState='True',boolWrites=0;const boolCat=new Catalog(async cmd=>{const s=Buffer.from(cmd.split(' ')[1],'base64').toString();if(s.startsWith('cat'))return {exit_code:0,stdout:JSON.stringify({menuitems:{flag:{data:{key:'db/test/flag',type:'boolean',list:[{value:true},{value:false}]}}}})};if(s.includes('vconftool set')){boolWrites++;boolState=s.endsWith("'0'")?'False':'True';return {exit_code:0,stdout:''};}return {exit_code:0,stdout:'value = '+boolState+' (Boolean)'};});assert.equal((await boolCat.write('flag',true)).changed,false);assert.equal(boolWrites,0);assert.equal((await boolCat.write('flag',false)).value,'0');assert.equal(boolWrites,1);
    console.log('PASS tv-menu: menu-driven catalog, options/type validation, danger deny, verified write');
})().catch(function (e) { console.error(e); process.exitCode = 1; });
