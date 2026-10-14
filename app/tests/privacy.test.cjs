'use strict';
const assert = require('assert').strict;
const { Privacy } = require('../service/privacy.js');

const OUT = [
    '__HBBTV__', 'db/menu/system/data-service, value = 0 (Int32)',
    '__DNT__', 'db/menu/system/data-service_do-not-track, value = 0 (Int32)',
    '__ACR__', 'db/Canalysis-service/recognition_status, value = 10 (Int32)',
    '__ACRRESET__', 'db/acr/reset, value = 0 (Int32)',
    '__PSID__', 'db/adagent/psid, value = ABCDEF0123 (String)',
    '__TCF__', 'db/TCF/TVPlus/TCFEnabled, value = True (Boolean)',
    '__HBBTVAPP__', '0',
    '__AGREE__', 'main_common:0', 'tnc:1', 'viewing:1'
].join('\n');

const p = new Privacy(async function () { return { exit_code: 0, stdout: OUT }; });

(async function () {
    const d = await p.read();
    assert.equal(d.hbbtv.off, true);
    assert.equal(d.hbbtv.dataService, 0);
    assert.equal(d.hbbtv.appRunning, false);
    assert.equal(d.doNotTrack, 0);
    assert.equal(d.acr.recognitionStatus, 10);
    assert.equal(d.adId.psidPresent, true);
    assert.equal(d.tvPlusConsent, true);
    assert.equal(d.agreements.find(function (a) { return a.id === 'viewing'; }).agreed, true);
    assert.equal(d.agreements.find(function (a) { return a.id === 'main_common'; }).agreed, false);
    assert.ok(/service/.test(d.scope));
    const menuOff=await new Privacy(async()=>({exit_code:0,stdout:OUT.replace('value = 0 (Int32)', 'value = 19 (Int32)')})).read();assert.equal(menuOff.hbbtv.off,true,'Samsung native menu Off is 19');
    const missing=await new Privacy(async()=>({exit_code:0,stdout:'__HBBTV__\nNo such file\n__TCF__\nNo such file\n__HBBTVAPP__\n\n__PSID__\nNo such file'})).read(); assert.equal(missing.hbbtv.off,null);assert.equal(missing.hbbtv.appRunning,null);assert.equal(missing.tvPlusConsent,null);assert.equal(missing.adId.psidPresent,null);assert.equal(missing.agreementsAvailable,null);
    const failed=await new Privacy(async()=>({exit_code:0,stdout:'__AGREE__\n__AGREE_STATUS__\n1\n__TCF__\nvalue = INVALID (Boolean)'})).read();assert.equal(failed.agreementsAvailable,false);assert.equal(failed.tvPlusConsent,null);
    console.log('PASS privacy: HbbTV/ACR/consent state parsed from vconf + HomeDataControl (TIFA marked unavailable)');
})().catch(function (e) { console.error(e); process.exitCode = 1; });
