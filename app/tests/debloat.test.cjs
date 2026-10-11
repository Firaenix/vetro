const assert = require('assert').strict;
const debloat = require('../service/debloat.js');
const component = 'com.samsung.tv.coba.adagent';
assert.equal(debloat.isAds(component, component), false,
  'Smart Hub dependency must not be selected for bulk debloat');
assert.throws(() => debloat.validateTargets([component], false), /Smart Hub/,
  'Explicit disable must also protect the Smart Hub dependency');
assert.equal(debloat.isAds('com.samsung.tv.acr', 'com.samsung.tv.acr-service-app'), true);
assert.doesNotThrow(() => debloat.validateTargets([component], true));
assert.throws(() => debloat.validateTargets([component + ".service"], false), /Smart Hub/);
console.log('PASS: Smart Hub dependency protected; ACR selection and recovery preserved');
