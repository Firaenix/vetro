'use strict';
const fs = require('fs'); const path = require('path'); const vm = require('vm');
module.exports = function loadProvider(root) {
    const dependencies = {
        fs: {readFileSync: function () {return '';}},
        './root-agent.js': {RootAgentServer: function () {this.start = function () {}; this.close = function () {};}}
    };
    const context = vm.createContext({module: {exports: {}},
        require: name => Object.prototype.hasOwnProperty.call(dependencies, name) ? dependencies[name]
            : name[0] === '.' ? require(path.join(root, 'service', name)) : require(name),
        __dirname: path.join(root,'service'), Buffer, process, console, setTimeout, clearTimeout});
    vm.runInContext(fs.readFileSync(path.join(root,'service/platform.js'),'utf8'),context);
    return {context: context, provider: context.module.exports};
};
