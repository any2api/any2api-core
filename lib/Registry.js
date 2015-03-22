var debug = require('debug')(require('../package.json').name);
var _ = require('lodash');
var path = require('path');
var npm = require('npm');
var async = require('async');
var fs = require('fs');
var shell = require('shelljs');

var config = { force: true, save: true, loglevel: 'silent' };



module.exports = function(spec) {
  debug('new instance of Registry', spec);

  var obj = {};

  spec = spec || {};
  spec.path = spec.path || path.join(__dirname, 'registry');
  
  shell.mkdir('-p', spec.path);

  var pkgPath = path.join(spec.path, 'package.json');
  var pkgTpl = JSON.stringify({ alias: {} });
  var registry = {};

  var pkgToRegistry = function(pkg) {
    _.each(pkg.dependencies, function(val, name) {
      registry[name] = {
        path: path.join(spec.path, 'node_modules', name)
      };
    });

    _.each(pkg.alias, function(name, alias) {
      registry[alias] = registry[name];
    });
  };

  if (fs.existsSync(pkgPath)) {
    var pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

    pkgToRegistry(pkg, registry);
  } else {
    fs.writeFileSync(pkgPath, pkgTpl);
  }

  var install = function(module, callback) {
    manage('install', module, callback);
  };

  var uninstall = function(module, callback) {
    // uninstall all modules
    if (!module) {
      shell.rm('-rf', path.join(spec.path, 'node_modules'));

      fs.writeFile(pkgPath, pkgTpl, callback);

      return;
    }

    manage('uninstall', module, callback);
  };

  var update = function(module, callback) {
    manage('update', module, callback);
  };

  var manage = function(action, module, callback) {
    var modulePath;
    var name;
    var alias = {};

    async.series([
      async.apply(npm.load, _.merge(_.clone(config), { prefix: spec.path })),
      function(callback) {
        var cb = function(err, result) {
          if (err || _.isEmpty(result)) return callback(err);

          if (action === 'install' || action === 'update') name = _.last(_.last(result)[1].split(path.sep));
          else if (action === 'uninstall') name = _.last(result);

          if (name) modulePath = path.join(spec.path, 'node_modules', name); // 'install' -> _.last(result)[1]
          //name = _.last(modulePath.split(path.sep));

          callback();
        };

        if (action === 'install' && module) npm.commands[action](spec.path, [ module ], cb);
        else if (module) npm.commands[action]([ module ], cb);
        else npm.commands[action](cb);

        npm.on('log', debug);
        npm.registry.log.on('log', debug);
      },
      function(callback) {
        if (!name || action === 'uninstall') return callback();

        var aliasPath = path.join(modulePath, 'alias.json');

        if (!fs.existsSync(aliasPath)) return callback();

        fs.readFile(aliasPath, 'utf8', function(err, content) {
          if (err) callback(err);

          alias = JSON.parse(content);

          callback();
        });
      },
      function(callback) {
        if (!name) return callback();

        fs.readFile(pkgPath, 'utf8', function(err, content) {
          if (err) callback(err);

          var pkg = JSON.parse(content);

          if (action !== 'uninstall') pkg.dependencies[name] = '*';

          pkg.alias = pkg.alias || {};

          _.each(pkg.alias, function(n, a) {
            if (n === name) delete pkg.alias[a];
          });

          _.each(alias, function(a) {
            pkg.alias[a] = name;
          });

          pkgToRegistry(pkg);

          fs.writeFile(pkgPath, JSON.stringify(pkg), callback);
        });
      }
    ], callback);
  };

  var listSync = function() {
    return _.keys(registry);
  };

  var list = function(callback) {
    try {
      callback(null, listSync(name));
    } catch (err) {
      callback(err);
    }
  };

  var existsSync = function(name) {
    return !!registry[name];
  };

  var exists = function(name, callback) {
    try {
      callback(null, existsSync(name));
    } catch (err) {
      callback(err);
    }
  };

  var getPathSync = function(name) {
    if (!existsSync(name)) return new Error('module missing: ' + name);

    return registry[name].path;
  };

  var getPath = function(name, callback) {
    try {
      callback(null, getSync(name));
    } catch (err) {
      callback(err);
    }
  };

  var loadModuleSync = function(name) {
    if (!existsSync(name)) return new Error('module missing: ' + name);

    return require(registry[name].path);
  };

  var loadModule = function(name, callback) {
    try {
      callback(null, getModuleSync(name));
    } catch (err) {
      callback(err);
    }
  };

  obj.uninstall = uninstall;
  obj.update = update;
  obj.install = install;
  obj.listSync = listSync;
  obj.list = list;
  obj.existsSync = existsSync;
  obj.exists = exists;
  obj.getPathSync = getPathSync;
  obj.getPath = getPath;
  obj.loadModuleSync = loadModuleSync;
  obj.loadModule = loadModule;

  return obj;
};
