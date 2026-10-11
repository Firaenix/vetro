'use strict';
const assert = require('assert').strict;
const fs = require('fs');
const os = require('os');
const path = require('path');
const {spawnSync} = require('child_process');
const context = require('./provider-harness.cjs')(path.resolve(__dirname, '..')).context;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vetro-launch-release-'));
const pidFile = path.join(tmp, 'agent.pid');
const fixture = path.join(tmp, 'agent.cjs');
let pid;
try {
    context.STAGE = tmp;
    context.pkg = 'fixture';
    fs.mkdirSync(path.join(tmp, context.pkg));
    fs.writeFileSync(fixture, "require('fs').writeFileSync(process.env.VETRO_TEST_CHILD_PID, String(process.pid)); setInterval(() => {}, 1000);\n");
    const script = context.buildLaunchScript(12345).replace('/usr/bin/dotnet', process.execPath + ' ' + fixture);
    const result = spawnSync('/bin/sh', ['-c', script], {
        timeout: 1000, encoding: 'utf8',
        env: {...process.env, VETRO_TEST_CHILD_PID: pidFile}
    });
    const deadline = Date.now() + 700;
    while (!fs.existsSync(pidFile) && Date.now() < deadline) Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 20);
    if (fs.existsSync(pidFile)) pid = Number(fs.readFileSync(pidFile, 'utf8'));
    assert.equal(result.error, undefined, 'launcher must return while its long-lived agent remains active');
    assert.equal(result.status, 0, result.stderr);
    assert.ok(pid, 'agent must have started');
    process.kill(pid, 0);
    console.log('PASS launcher exits with agent alive and no inherited output pipes');
} finally {
    if (pid) {try {process.kill(pid, 'SIGTERM');} catch (_) {}}
    fs.rmSync(tmp, {recursive: true, force: true});
}
