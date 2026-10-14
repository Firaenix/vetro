'use strict';
// Dependency-free app-only ZIP builder. No signing or device integration.
const fs = require('fs');
const path = require('path');
const crc32 = require('./service/package-info.js').crc32;
function collectFiles() {
    const names = ['config.xml', 'index.html', 'icon.png', 'native/TvState.dll', 'native/TvState.runtimeconfig.json'].concat(
        fs.readdirSync(path.join(__dirname,'service')).filter(name => name.endsWith('.js')).sort().map(name => 'service/' + name));
    const metadata = Object.assign({}, require('./service/build-info.js'));
    let revision = process.env.VETRO_SOURCE_REVISION;
    if (!revision) {
        try { revision = require('child_process').execFileSync('git', ['rev-parse', 'HEAD'], {cwd: __dirname, stdio: ['ignore','pipe','ignore']}).toString().trim(); } catch (_) {}
    }
    if (revision && /^[a-f0-9]{40}$/.test(revision)) metadata.sourceRevision = revision;
    return names.map(name => ({uri: encodeURIComponent(name), data: name === 'service/build-info.js'
        ? Buffer.from("'use strict';\nmodule.exports = " + JSON.stringify(metadata) + ';\n')
        : fs.readFileSync(path.join(__dirname,name))}));
}
function zip(files) {
    const chunks = [], directory = []; let offset = 0;
    files.forEach(file => {
        const name = Buffer.from(decodeURIComponent(file.uri)); const data = Buffer.from(file.data);
        const local = Buffer.alloc(30); local.writeUInt32LE(0x04034b50); local.writeUInt16LE(20,4);
        local.writeUInt32LE(crc32(data),14); local.writeUInt32LE(data.length,18); local.writeUInt32LE(data.length,22); local.writeUInt16LE(name.length,26);
        const central = Buffer.alloc(46); central.writeUInt32LE(0x02014b50); central.writeUInt16LE(20,4); central.writeUInt16LE(20,6);
        central.writeUInt32LE(crc32(data),16); central.writeUInt32LE(data.length,20); central.writeUInt32LE(data.length,24); central.writeUInt16LE(name.length,28); central.writeUInt32LE(offset,42);
        chunks.push(local,name,data); directory.push(central,name); offset += local.length + name.length + data.length;
    });
    const table = Buffer.concat(directory), end = Buffer.alloc(22);
    end.writeUInt32LE(0x06054b50); end.writeUInt16LE(files.length,8); end.writeUInt16LE(files.length,10); end.writeUInt32LE(table.length,12); end.writeUInt32LE(offset,16);
    return Buffer.concat(chunks.concat([table,end]));
}
function build() {
    const output = process.env.OUT ? path.resolve(process.env.OUT) : path.join(__dirname,'dist','vetro-app-only.wgt');
    fs.mkdirSync(path.dirname(output),{recursive:true}); fs.writeFileSync(output,zip(collectFiles()));
    console.log('App-only unsigned package: ' + output);
    return output;
}
module.exports = {collectFiles: collectFiles, zip: zip, build: build};
if (require.main === module) build();
