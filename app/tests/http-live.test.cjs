'use strict';
const path = require('path');
const http = require('http');
const router = require('./service-harness.cjs')(path.resolve(__dirname, '..')).router;
process.once('uncaughtException', function (error) {
  console.log('FAIL real HTTP POST /control: ' + error.name + ': ' + error.message);
  process.exit(1);
});
const server = http.createServer(router).listen(0, '127.0.0.1', function () {
  const req = http.request({ host: '127.0.0.1', port: server.address().port,
    path: '/control', method: 'POST', headers: { 'Content-Type': 'application/json' } }, function (res) {
    res.resume(); res.on('end', function () {
      console.log((res.statusCode === 400 ? 'PASS' : 'FAIL') + ' real HTTP POST /control: ' + res.statusCode);
      server.close(); process.exitCode = res.statusCode === 400 ? 0 : 1;
    });
  });
  req.end('null');
});
