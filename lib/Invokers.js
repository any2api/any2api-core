var debug = require('debug')(require('../package.json').name);
var exec = require('child_process').exec;
var path = require('path');
var fs = require('fs');
var _ = require('lodash');
var Registry = require('./Registry');



var nodeBinDir = path.resolve(process.execPath, '..'); // '/usr/local/opt/nvm/v0.10.33/bin'
if (nodeBinDir) process.env.PATH = nodeBinDir + path.delimiter + process.env.PATH;



module.exports = function(spec) {
  debug('new instance of Invokers', spec);

  spec = spec || {};
  spec.path = spec.path || __dirname;
  spec.path = path.join(spec.path, 'invokers');

  var obj = Registry(spec);

  var getInvokerPath = function(apiSpec, callback) {
    if (apiSpec.invoker.path) return callback();

    var invokerName = apiSpec.invoker.name;

    if (!invokerName) invokerName = apiSpec.executable.type;

    if (!invokerName) {
      callback(new Error('neither invoker.name nor executable.type defined in API spec ' + apiSpecPathAbs));
    } else {
      apiSpec.invoker.path = obj.getPathSync(invokerName);

      if (!apiSpec.invoker.path) callback(new Error('invoker ' + invokerName + ' missing'));
      else callback();
    }
  };

  var callback = function(apiSpec, done) {
    return function(err, stdout, stderr) {
      if (err) {
        err.stderr = stderr;
        err.stdout = stdout;

        return done(err);
      }

      done(null, JSON.parse(fs.readFileSync(apiSpec.apispec_path)));
    };
  };

  var prepareBuildtime = function(apiSpec, done) {
    getInvokerPath(apiSpec, function(err) {
      if (err) return done(err);

      exec('npm run prepare-buildtime',
        { cwd: path.resolve(apiSpec.apispec_path, '..', apiSpec.invoker.path),
          env: { PATH: process.env.PATH } },
        callback(apiSpec, done));
    });
  };

  var prepareExecutable = function(apiSpec, done) {
    getInvokerPath(apiSpec, function(err) {
      if (err) return done(err);

      apiSpec.executable.prepared = true;

      exec('npm run prepare-executable',
        { cwd: path.resolve(apiSpec.apispec_path, '..', apiSpec.invoker.path),
          env: { APISPEC: JSON.stringify(apiSpec), PATH: process.env.PATH } },
        callback(apiSpec, done));
    });
  };

  obj.getInvokerPath = getInvokerPath;
  obj.prepareBuildtime = prepareBuildtime;
  obj.prepareExecutable = prepareExecutable;

  return obj;
};
