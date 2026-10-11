'use strict';
const assert = require('assert').strict;
const fs = require('fs');
const os = require('os');
const path = require('path');
const child = require('child_process');
const load = require('./provider-harness.cjs');
const root = process.argv[2] || path.resolve(__dirname, '..');
const context = load(root).context;
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'vetro-relaunch-test-'));
const counter = path.join(directory, 'counter');
const command = 'printf x >> ' + counter;
function decode(injection) {
  const encoded = injection.match(/\$\{IFS\}([A-Za-z0-9+/=]+)\|base64/)[1];
  return Buffer.from(encoded, 'base64').toString();
}
function run(script) {
  // Preserve real shell control flow; isolate only its /tmp gate directory.
  const isolated = script.replace(/\/tmp\/s-([a-f0-9]+)/g, directory + '/s-$1');
  child.spawnSync('/bin/sh', ['-c', isolated]);
}
try {
  const first = decode(context.buildInjection(command));
  const second = decode(context.buildInjection(command));
  run(first); run(first); // duplicate delivery of one attempt must run once
  assert.equal(fs.readFileSync(counter, 'utf8'), 'x');
  run(second); // a new attempt after disconnect must run again
  assert.equal(fs.readFileSync(counter, 'utf8'), 'xx',
    'Second root launch is silently skipped because its gate already exists');
  console.log('PASS: duplicate delivery runs once; a new root attempt runs again');
} finally {
  fs.readdirSync(directory).forEach(function (entry) {
    const name = path.join(directory, entry);
    if (fs.statSync(name).isDirectory()) fs.rmdirSync(name); else fs.unlinkSync(name);
  });
  fs.rmdirSync(directory);
}
