var debug = require('debug')(require('../package.json').name);
var async = require('async');
var _ = require('lodash');
var fs = require('fs');
var path = require('path');
var Registry = require('./Registry');



module.exports = function(spec) {
  debug('new instance of Generators', spec);

  spec = spec || {};
  spec.path = spec.path || __dirname;
  spec.path = path.join(spec.path, 'generators');

  var obj = Registry(spec);

  var gen = function(generator, apiSpec, callback) {
    generator.generate(apiSpec, function(err) {
      if (err) return callback(err);

      var implPath = apiSpec.implementation.path;

      apiSpec.implementation.path = '.';

      delete apiSpec.apispec_path;

      var port = apiSpec.implementation.port || '3000';

      var dockerBaseImg = process.env.DOCKER_BASE_FROM || 'node:0.10';
      var dockerBaseRun = process.env.DOCKER_BASE_RUN || 'apt-get -y update && apt-get -y install sudo';

      async.parallel([
        async.apply(fs.writeFile, path.join(implPath, 'apispec.json'), JSON.stringify(apiSpec)),
        async.apply(fs.writeFile, path.join(implPath, 'Dockerfile'), [
          'FROM ' + dockerBaseImg,
          '',
          'RUN ' + dockerBaseRun,
          '',
          'ENV PORT ' + port,
          '',
          'ADD . /impl/',
          'WORKDIR /impl',
          'RUN npm run prepare-runtime',
          '',
          'CMD npm start',
          '',
          'EXPOSE $PORT',
          ''
        ].join('\n'))
      ], function(err) {
        apiSpec.apispec_path = path.join(implPath, 'apispec.json');

        apiSpec.generated = true;

        callback(err);
      });
    });
  };

  var generate = function(apiSpec, done) {
    async.eachSeries(obj.listSync(), function(name, done) {
      if (apiSpec.generated) return done();
      else {
        var Generator = obj.loadModuleSync(name);

        var g = Generator();

        if (g.supports(apiSpec)) {
          apiSpec.implementation.generator_name = name;

          gen(g, apiSpec, done);
        } else {
          done();
        }
      }
    }, function(err) {
      delete apiSpec.generated;

      done(err, apiSpec);
    });
  };

  obj.generate = generate;

  return obj;
};
