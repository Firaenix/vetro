'use strict';
const assert = require('assert').strict, fs = require('fs'), vm = require('vm'), EventEmitter = require('events');
const {parse, Presence, COMMAND} = require('../service/presence.js');
const block = (pid, id, st) => `\t==========================\n\t pid: ${pid}\n\t appid: ${id}\n\t app_path: /usr/apps/${id}/bin/x\n\t pkgid: ${id}\n\t status: ${st}\n\t is_sub_app : 0\n\t==========================\n`;
const sample = '[aul_app_get_all_running_app_info 0 test] \n' + block(519, 'org.tizen.tv-viewer', 4) + block(1273, 'org.tizen.litewebappservice', 8) + block(2200, 'jcz0WrZYdy.NOWTV', 3);
assert.deepEqual(parse(sample), {foreground: {appId: 'jcz0WrZYdy.NOWTV', pid: 2200, status: 3}, running: 3});
assert.equal(parse(block(1, 'a.b', 4) + block(2, 'c.d', 8)).foreground, null, 'background and service apps are not foreground');
assert.equal(parse(block(1, 'a.b', 3) + block(2, 'c.d', 2)).foreground.appId, 'c.d', 'focus outranks visible');
assert.throws(() => parse('Error: no manager'), /unreadable/);
assert.throws(() => parse(block(1, 'bad;id', 3)), /unreadable/, 'unsafe app ids are dropped');
assert.match(COMMAND, /^aul_test getallappstatus\b/);
assert.ok(!/launch|resume|term|open/.test(COMMAND), 'only the read-only listing command is used');

// One in-flight query shared by concurrent readers; failures surface as rejections.
let calls = 0, cmd;
const ok = new Presence((c) => { cmd = c; calls++; return Promise.resolve({exit_code: 0, stdout: sample}); });
(async () => {
    const [a, b] = await Promise.all([ok.read(), ok.read()]);
    assert.equal(calls, 1); assert.equal(a, b); assert.equal(cmd, COMMAND);
    await assert.rejects(new Presence(() => Promise.resolve({exit_code: 1, stdout: ''})).read(), /unavailable/);

    // Bridge: publishes on change only, retained, and republishes after reconnect.
    const timers = new Map(); let n = 0, sent = [];
    class Client extends EventEmitter { connect() {} close() {} publish(t, p, o) { sent.push([t, String(p), o && o.retain]); } subscribe() {} }
    const ctx = vm.createContext({module: {exports: {}}, require: m => m === 'fs' ? {readFileSync: () => '{"host":"broker"}'} : {MqttClient: Client},
        setInterval: f => { timers.set(++n, f); return n; }, clearInterval: i => timers.delete(i), setTimeout: f => { timers.set(++n, f); return n; }, clearTimeout: i => timers.delete(i)});
    vm.runInContext(fs.readFileSync(require.resolve('../service/mqtt-bridge.js'), 'utf8'), ctx);
    const bridge = new ctx.module.exports.MqttBridge(() => ({error: 1}));
    bridge.start(); bridge.client.emit('connect');
    assert.ok(sent.some(s => /foreground-app\/config$/.test(s[0]) && s[2] === true), 'discovery registers the foreground sensor');
    sent = [];
    const fg = {name: 'NOW TV', appId: 'jcz0WrZYdy.NOWTV', pid: 2200};
    bridge.publishPresence(fg); bridge.publishPresence(fg);
    assert.equal(sent.length, 2, 'unchanged state is not republished');
    assert.deepEqual(sent.map(s => s[1]), ['NOW TV', '{"app_id":"jcz0WrZYdy.NOWTV","pid":2200}']);
    assert.ok(sent.every(s => s[2] === true), 'state is retained');
    sent = []; bridge.publishPresence(null);
    assert.equal(sent[0][1], 'none');
    bridge.client.emit('connect'); sent = []; bridge.publishPresence(null);
    assert.equal(sent.length, 2, 'state is republished after reconnect');
    bridge.stop();
    console.log('PASS Foreground app: read-only parsing, shared query, change-only retained MQTT publication');
})().catch(e => { console.error(e); process.exit(1); });
