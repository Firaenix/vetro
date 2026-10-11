'use strict';
const assert = require('assert').strict;
const zlib = require('zlib');
const info = require('../service/package-info.js');
function archive(xml, method) {
  const decoded = Buffer.from(xml); const data = method === 8 ? zlib.deflateRawSync(decoded) : decoded;
  const name = Buffer.from('config.xml'); const local = Buffer.alloc(30); local.writeUInt32LE(0x04034b50); local.writeUInt16LE(method, 8); local.writeUInt16LE(name.length, 26);
  const central = Buffer.alloc(46); central.writeUInt32LE(0x02014b50); central.writeUInt16LE(method, 10); central.writeUInt32LE(info.crc32(decoded), 16); central.writeUInt32LE(data.length, 20); central.writeUInt32LE(decoded.length, 24); central.writeUInt16LE(name.length, 28);
  const offset = local.length + name.length + data.length;
  const end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50); end.writeUInt16LE(1, 8); end.writeUInt16LE(1, 10); end.writeUInt32LE(central.length + name.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([local, name, data, central, name, end]);
}
async function main() {
  const xml = '<widget xmlns:tizen="http://tizen.org/ns/widgets"><tizen:application package="testPkg123" id="testPkg123.app"/></widget>';
  for (const method of [0, 8]) assert.equal((await info.fromBuffer(archive(xml, method))).packageId, 'testPkg123');
  await assert.rejects(info.fromBuffer(Buffer.from('not a ZIP')));
  const corrupt = archive(xml, 0); corrupt[45] ^= 1;
  await assert.rejects(info.fromBuffer(corrupt), /checksum/);
  await assert.rejects(info.fromBuffer(archive(xml.replace('testPkg123', 'bad;id'), 8)), /package ID/);
  await assert.rejects(info.fromBuffer(archive(xml + '<tizen:application package="other"/>', 0)), /one Tizen/);
  await assert.rejects(info.fromBuffer(archive('<!DOCTYPE widget>' + xml, 0)), /declarations/);
  await assert.rejects(info.read('/tmp/x.wgt;reboot'), /absolute/);
  console.log('PASS WGT: stored/deflated manifests, corrupt archives, ambiguous IDs and unsafe paths');
}
main().catch(e => {console.error(e); process.exitCode = 1;});
