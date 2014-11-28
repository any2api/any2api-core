var debug = require('debug')(require('../package.json').name);
var async = require('async');
var path = require('path');
var _ = require('lodash');
var Registry = require('./Registry');



module.exports = function(spec) {
  debug('new instance of Scanners', spec);

  spec = spec || {};
  spec.path = spec.path || __dirname;
  spec.path = path.join(spec.path, 'scanners');

  var obj = Registry(spec);

  var scan = function(dir, done) {
    var executable = null;

    async.eachSeries(obj.listSync(), function(name, done) {
      if (!_.isEmpty(executable)) return done();
      else {
        var Scanner = obj.loadModuleSync(name);

        Scanner().scan(dir, function(err, result) {
          if (err) return done(err);

          if (!_.isEmpty(result)) executable = result;

          done();
        });
      }
    }, function(err) {
      done(err, executable);
    });
  };

  obj.scan = scan;

  return obj;
};
