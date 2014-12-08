var debug = require('debug')(require('../package.json').name);
var async = require('async');
var _ = require('lodash');
var S = require('string');
var fs = require('fs-extra');
var path = require('path');
var url = require('url');
var shortId = require('shortid');
var util = require('any2api-util');
var Registry = require('./Registry');



var specFile = 'apispec.json';

var nodeBinDir = path.resolve(process.execPath, '..'); // '/usr/local/opt/nvm/v0.10.33/bin'
if (nodeBinDir) process.env.PATH = nodeBinDir + path.delimiter + process.env.PATH;



module.exports = function() {
  var obj = {};

  var basePath = null;
  var log = debug;

  var scannersReg = null;
  var invokersReg = null;
  var generatorsReg = null;

  obj.scanners = function() {
    scannersReg = scannersReg || Registry({ path: path.join(basePath, 'scanners') });

    return scannersReg;
  };

  obj.invokers = function() {
    invokersReg = invokersReg || Registry({ path: path.join(basePath, 'invokers') });

    return invokersReg;
  };

  obj.generators = function() {
    generatorsReg = generatorsReg || Registry({ path: path.join(basePath, 'generators') });

    return generatorsReg;
  };

  obj.init = function(args) {
    if (basePath) throw new Error('core initialized already');

    args = args || {};

    basePath = args.path || __dirname;
    log = args.log || debug;

    debug('core initialized', args, basePath);
  };

  /*
   * Scan executable
   */
  obj.scan = function(args, done) {
    args = args || {};

    if (!args.outputPath) {
      return done(new Error('output directory must be specified'));
    } else if (!args.executables) {
      return done(new Error('executables must be specified'));
    }

    if (_.isString(args.executables)) args.executables = [ args.executables ];

    var scanners = obj.scanners();

    if (args.scanner && !scanners.existsSync(args.scanner)) {
      args.scanner = scannerPrefix + args.scanner;

      if (!scanners.existsSync(args.scanner)) {
        return done(new Error('scanner ' + args.scanner + ' missing'));
      }
    }

    var outputPath = path.resolve(args.outputPath);
    fs.mkdirsSync(outputPath);

    var apiSpec = { executables: {} };

    var specPath = path.join(outputPath, specFile);

    // Scan all executables
    async.eachSeries(args.executables, function(exec, done) {
      var retrieve = args.retrieve;
      var execId = shortId.generate();
      var execPath = path.join(outputPath, execId);
      var execSpec = null;
      var execStored = false;

      //var execPath = outputPath;
      //if (args.subdir) execPath = path.join(outputPath, args.subdir);

      async.series([
        function(callback) {
          // Called after trying to store executable
          var execStoredCallback = function(err) {
            if (err) return callback(err);

            execStored = true;

            log('Executable stored: ' + execPath);

            callback();
          };

          // Auto-detect URLs
          if (!retrieve &&
              (S(exec).startsWith('http://') || S(exec).startsWith('https://'))) {
            retrieve = 'http';
          } else if (!retrieve && S(exec).startsWith('lp:')) { // launchpad.net repository
            retrieve = 'bzr';
          }

          // Remotely hosted executable
          if (retrieve) {
            log('Retrieving executable: ' + exec);

            var execUrl = exec;
            //exec = _.last(url.parse(execUrl).pathname.replace(/\/$/, '').split('/'));

            if (retrieve === 'http' || retrieve === 'https') {
              util.download({ url: execUrl, dir: execPath }, execStoredCallback);
            } else if (retrieve === 'git') {
              util.checkoutGit({ url: execUrl, dir: execPath }, execStoredCallback);
            } else if (retrieve === 'bzr' || retrieve === 'bazaar') {
              util.checkoutBzr({ url: execUrl, dir: execPath }, execStoredCallback);
            } else {
              return callback(new Error('retrieve mode ' + retrieve + ' not supported'));
            }
          // Executable does not exist
          } else if (!fs.existsSync(exec)) {
            return callback(new Error('executable ' + exec + ' missing'));
          // Executable is a file
          } else if (fs.statSync(exec).isFile()) {
            log('Extracting executable: ' + exec);

            util.extract({ file: exec, dir: execPath }, execStoredCallback);
          // Executable is a directory
          } else if (fs.statSync(exec).isDirectory()) {
            if (path.resolve(exec) !== path.resolve(execPath) && args.copyExecutable) {
              log('Copying executable: ' + exec);

              fs.mkdirsSync(execPath);
              fs.copy(exec, execPath, execStoredCallback);
            //} else if (path.resolve(outputPath) === path.resolve(defaultOutput)) {
            //  outputPath = exec;

            //  specPath = path.join(outputPath, specFile);
            } else {
              execPath = exec;

              callback();
            }
          }
        },
        function(callback) {
          log('Scanning executable:', execPath);

          //var basename = path.basename(exec, path.extname(exec));

          if (args.scanner) {
            scanners.get(args.scanner, function(err, Scanner) {
              if (err) return callback(err);

              Scanner().scan(execPath, function(err, result) {
                if (err) return callback(err);

                execSpec = result;

                callback();
              });
            });
          } else {
            async.eachSeries(obj.scanners().listSync(), function(name, callback) {
              if (!_.isEmpty(execSpec)) {
                return callback();
              } else {
                var Scanner = obj.scanners().loadModuleSync(name);

                Scanner().scan(execPath, function(err, result) {
                  if (err) return callback(err);

                  if (!_.isEmpty(result)) execSpec = result;

                  callback();
                });
              }
            }, callback);
          }
        },
        function(callback) {
          if (_.isEmpty(execSpec)) {
            log('Warning: executable spec is empty, most probably no scanner available.');

            return callback();
          } else {
            log('Executable scanned.');
          }

          if (execStored && execSpec.name) {
            var betterExecPath = path.join(outputPath, execSpec.name);

            if (!fs.existsSync(betterExecPath)) {
              fs.renameSync(execPath, betterExecPath);

              execPath = betterExecPath;

              log('Executable moved: ' + execPath);
            }
          }

          execSpec.name = execSpec.name || execId;

          execSpec.path = path.relative(outputPath, execPath);
          if (S(execSpec.path).startsWith('..')) execSpec.path = execPath;
          else if (_.isEmpty(execSpec.path)) execSpec.path = '.';

          apiSpec.executables[execSpec.name] = execSpec;
          delete execSpec.name;

          callback();
        }
      ], done);
    }, function(err) {
      if (err) {
        return done(err);
      } else if (_.isEmpty(apiSpec) || _.isEmpty(apiSpec.executables)) {
        return done(new Error('API spec is empty'));
      }

      log('Writing API spec: ' + specPath);

      util.writeSpec({ specPath: specPath, apiSpec: apiSpec }, function(err, updApiSpec) {
        if (err) return done(err);

        log('API spec written.');

        done(null, updApiSpec);
      });
    });
  };

  /*
   * Generate API spec
   */
  obj.gen = function(args, done) {
    args = args || {};

    if (!args.specPath) {
      return done(new Error('API spec path must be specified'));
    } else if (!args.outputPath) {
      return done(new Error('output directory must be specified'));
    } else if (fs.existsSync(args.outputPath)) {
      return done(new Error('output directory must not exist'));
    }

    args.outputPath = path.resolve(args.outputPath);

    var apiSpec;

    var updateSpecCallback = function(callback) {
      return function(err, updApiSpec) {
        if (err) return callback(err);

        if (updApiSpec) apiSpec = updApiSpec;

        callback();
      };
    };

    async.series([
      function(callback) {
        util.readInput({ specPath: args.specPath }, updateSpecCallback(callback));
      },
      function(callback) {
        util.updateInvokers({ apiSpec: apiSpec, invokers: obj.invokers() }, callback);
      },
      function(callback) {
        _.each(apiSpec.executables, function(executable, name) {
          delete apiSpec.executables[name];

          name = S(name).dasherize().s;

          if (executable.invoker_name) {
            executable.invoker_name = S(executable.invoker_name).dasherize().s;
          }

          apiSpec.executables[name] = executable;
        });

        _.each(apiSpec.invokers, function(invoker, name) {
          delete apiSpec.invokers[name];

          name = S(name).dasherize().s;

          apiSpec.invokers[name] = invoker;
        });

        callback();
      },
      function(callback) {
        apiSpec.implementation.path = args.outputPath;

        if (args.implTitle) apiSpec.implementation.title = args.implTitle;
        if (args.implType) apiSpec.implementation.type = args.implType;
        if (args.interface) apiSpec.implementation.interface = args.interface;

        var generatorNames = [];

        if (args.generator) {
          generatorNames.push(args.generator);
        } else if (apiSpec.implementation.generator_name) {
          generatorNames.push(apiSpec.implementation.generator_name);
        } else {
          generatorNames = obj.generators().listSync();
        }

        async.eachSeries(generatorNames, function(name, callback) {
          if (apiSpec.generated) {
            return callback();
          } else {
            var Generator = obj.generators().loadModuleSync(name);

            var g = Generator();

            if (g.supports(apiSpec)) {
              apiSpec.implementation.generator_name = name;

              g.generate(apiSpec, function(err) {
                if (err) return callback(err);

                var implPath = apiSpec.implementation.path;

                apiSpec.implementation.path = '.';

                var ports = apiSpec.implementation.ports || [ '8080' ];

                var dockerBaseImg = process.env.DOCKER_BASE_IMAGE || 'node:0.10';
                var dockerBaseRun = process.env.DOCKER_BASE_RUN || 'apt-get -y update && apt-get -y install sudo';

                var vagrantBaseBox = process.env.VAGRANT_BASE_BOX || 'ubuntu/trusty64';

                async.parallel([
                  function(callback) {
                    fs.readFile(path.join(__dirname, '..', 'tpl', 'Dockerfile.tpl'), 'utf8', function(err, content) {
                      if (err) return callback(err);

                      fs.writeFile(path.join(implPath, 'Dockerfile'),
                        _.template(content, { ports: ports, baseImage: dockerBaseImg, baseRun: dockerBaseRun }), callback);
                    });
                  },
                  function(callback) {
                    fs.readFile(path.join(__dirname, '..', 'tpl', 'Vagrantfile.tpl'), 'utf8', function(err, content) {
                      if (err) return callback(err);

                      fs.writeFile(path.join(implPath, 'Vagrantfile'),
                        _.template(content, { ports: ports, baseBox: vagrantBaseBox }), callback);
                    });
                  },
                  async.apply(util.writeSpec, { specPath: path.join(implPath, specFile), apiSpec: apiSpec })
                ], function(err) {
                  apiSpec.generated = true;

                  callback(err);
                });
              });
            } else {
              callback();
            }
          }
        }, function(err) {
          if (err) return callback(err);
          else if (!apiSpec.generated) return callback(new Error('no generator found'));

          delete apiSpec.generated;

          callback();
        });
      },
      function(callback) {
        if (args.skipPrepare) return callback();

        var preparedInvokers = {};

        async.eachSeries(_.keys(apiSpec.executables), function(name, callback) {
          log('Preparing buildtime environment for preparing executable ' + name);

          util.prepareBuildtime({ apiSpec: apiSpec, preparedInvokers: preparedInvokers, executable_name: name }, callback);
        }, callback);
      },
      function(callback) {
        if (args.skipPrepare) return callback();

        async.eachSeries(_.keys(apiSpec.executables), function(name, callback) {
          log('Preparing executable ' + name);

          util.prepareExecutable({ apiSpec: apiSpec, executable_name: name }, updateSpecCallback(callback));
        }, callback);
      }
    ], function(err) {
      if (err) return done(err);

      util.writeSpec({ apiSpec: apiSpec }, function(err, updApiSpec) {
        if (err) return done(err);

        log('API implementation generated with API spec: ' + apiSpec.apispec_path);

        done(null, updApiSpec);
      });
    });
  };

  return obj;
};
