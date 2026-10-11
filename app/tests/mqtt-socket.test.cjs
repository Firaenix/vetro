'use strict';
const assert = require('assert').strict;
const fs = require('fs'); const vm = require('vm'); const EventEmitter = require('events');
let socket;
class Socket extends EventEmitter {
  setNoDelay() {} setTimeout() {} write() {} end() {this.ended = true;} destroy() {this.destroyed = true;}
}
const context = vm.createContext({module: {exports: {}}, Buffer,
 require: () => ({connect: () => {socket = new Socket(); return socket;}}), setInterval: () => 1, clearInterval: () => {}});
vm.runInContext(fs.readFileSync(require.resolve('../service/mqtt.js'), 'utf8'), context);
const client = new context.module.exports.MqttClient({host: 'broker'});
client.connect(); const connecting = socket; client.close();
assert.ok(connecting.ended || connecting.destroyed, 'close must cancel a socket still connecting');
connecting.emit('connect'); assert.equal(client._socket, null, 'late connect cannot revive closed client');
console.log('PASS MQTT socket cancellation before connect');

client.connect(); const refused = socket; refused.emit('connect');
refused.emit('data', Buffer.from([0x20, 0x02, 0x00, 0x05]));
assert.equal(refused.destroyed, true, 'CONNACK rejection closes the socket');
assert.equal(client._socket, null);
console.log('PASS MQTT rejects refused broker without leaving a socket');
