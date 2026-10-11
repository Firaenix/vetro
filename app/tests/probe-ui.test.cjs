'use strict';
const assert = require('assert').strict;
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const html = fs.readFileSync(process.argv[2] || path.join(__dirname, '..', 'index.html'), 'utf8');
const script = /<script>\s*([\s\S]*?)<\/script>/.exec(html)[1];

async function run(response) {
  const sent = [], output = {textContent: ''};
  function XHR() {}
  XHR.prototype.open = function (method, url) { this.method = method; this.url = url; };
  XHR.prototype.setRequestHeader = function () {};
  XHR.prototype.send = function (body) {
    sent.push({method: this.method, url: this.url, body: JSON.parse(body)});
    this.status = 200; this.responseText = JSON.stringify(response); this.onload();
  };
  function WS() { setImmediate(() => this.onopen()); }
  WS.prototype.close = function () {};
  await vm.runInNewContext(script, {
    document: {getElementById: () => output}, XMLHttpRequest: XHR, WebSocket: WS,
    // Emulates the observed runtime: fetch reports 200 but cannot be trusted
    // to honor POST options. Report delivery must use the explicit XHR path.
    fetch: async () => ({status: 200}),
    tizen: {
      tvinputdevice: {getSupportedKeys: () => [{name: 'VolumeUp'}]},
      application: {getAppsInfo: ok => ok([{id: 'vetrotvapp.app', packageId: 'vetrotvapp'}])},
      package: {getPackagesInfo: ok => ok([{id: 'vetrotvapp', version: '0.1.0'}])},
      systeminfo: {getPropertyValue: (name, ok) => ok({model: 'TV'})}
    }, webapis: {productinfo: {getModel: () => 'TV'}},
    btoa: s => Buffer.from(s).toString('base64'), setTimeout, clearTimeout
  });
  return {sent, output: output.textContent};
}
(async function () {
  const good = await run({ok: true, persisted: true});
  assert.equal(good.sent.length, 1, 'widget must actually POST its collected report');
  assert.equal(good.sent[0].method, 'POST');
  assert.equal(good.sent[0].url, 'http://127.0.0.1:8099/probe');
  assert.equal(good.sent[0].body.apps[0].id, 'vetrotvapp.app');
  assert.ok(good.output.includes('saved'));
  const bad = await run({});
  assert.ok(!bad.output.includes('Report sent to service:'));
  assert.ok(bad.output.includes('Report rejected'));
  console.log('PASS widget probe: explicit POST, complete report, no false success on empty 200');
})().catch(e => {console.error(e); process.exitCode = 1;});
