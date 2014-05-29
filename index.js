/*!
 * cube: index.js
 * Authors  : fish (https://github.com/fishbar)
 * Create   : 2014-04-18 15:32:20
 * CopyRight 2014 (c) Fish And Other Contributors
 */
var url = require('url');
var path = require('path');
var connect = require('connect');
var JsProcessor = require('./controller/js_processor');
var CssProcessor = require('./controller/css_processor');
var JsTransfer = require('./lib/jstransfer');
var CssTransfer = require('./lib/csstransfer');
var ug = require('uglify-js');
var xfs = require('xfs');
var app;

function loadIgnore(path) {
  try {
    covIgnore = xfs.readFileSync(path).toString().split(/\r?\n/g);
  } catch (e) {
    console.log(e);
    return [];
  }
  var _ignore = [];
  covIgnore.forEach(function (v, i, a) {
    if (!v) {
      return;
    }
    if (v.indexOf('/') === 0) {
      v = '^' + v;
    }
    _ignore.push(new RegExp(v.replace(/\./g, '\\.').replace(/\*/g, '.*')));
  });
  return _ignore;
}

function checkIgnore(file, ignores) {
  var flag = false;
  var rule;
  for (var i = 0; i < ignores.length; i++){
    rule = ignores[i];
    if (rule.test(file)) {
      flag = true;
      break;
    }
  };
  return flag;
}
/**
 * [init description]
 * @param  {Object} config
 *         - port       listen port [optional]
 *         - connect    the connect object
 *         - root       static root
 *         - router     http path
 *         - honeyComb  for honeyComb
 */
exports.init = function (config) {
  JsProcessor.init(config);
  CssProcessor.init(config);
  function processQuery(req, res, next) {
    var q = url.parse(req.url, true);
    var qpath = q.pathname;
    var ext = path.extname(qpath);
    if (qpath === '/') {
      req.url = '/index.html'
    }
    switch(ext) {
      case '.css':
      case '.less':
      case '.sass':
        CssProcessor(req, res, next);
        break;
      case '.js':
        JsProcessor(req, res, next);
        break;
      default:
        next();
    }
  }
  // for weird honeycomb
  if (config.honeyComb) {
    return processQuery;
  } else {
    if (config.connect) {
      app = config.app;
    } else {
      app = connect();
      app.use(connect.query());
    }
    app.use(config.router, processQuery);
    app.use(config.router, connect.static(config.root));
  }

  // other static files

  if (config.port) {
    app.listen(config.port, function (err) {
      if (err) {
        console.error('[Cube] server fail to start,', err.message);
      } else {
        console.log('[Cube] server started, listen:', config.port);
        console.log('[Cube] visit: http://localhost:' + config.port + path.join( config.router, '/index.html').replace(/\\/g, '/'));
      }
    });
  }
};

exports.getApp = function () {
  return app;
};
/**
 * [processDir description]
 * @param  {abspath}   source   [description]
 * @param  {[type]}   dest     [description]
 * @param  {[type]}   compress [description]
 * @param  {Function} cb       [description]
 * @return {[type]}            [description]
 */
exports.processDir = function (source, dest, compress, cb) {
  if (!dest) {
    dest = source + '-build';
  }
  JsTransfer.init({root: source});
  var ignores = loadIgnore(path.join(source, '.cubeignore'));
  xfs.walk(source, function (err, sourceFile) {
    var relFile = sourceFile.substr(source.length);
    var destFile = path.join(dest, relFile);
    var fileName = path.basename(relFile);
    if (/\.min\.(css|js)$/.test(fileName) || !/\.(js|css|less|sass)$/.test(fileName)) {
      // copy file
      xfs.sync().save(destFile, xfs.readFileSync(sourceFile));
      console.log('[copy file]:', relFile.substr(1));
    } else if (/\.js$/.test(fileName)) {
      var code;
      if (checkIgnore(relFile, ignores)) {
        code = ug.minify(sourceFile);
        xfs.sync().save(destFile, code.code);
        console.log('[minifiy js]:', relFile.substr(1));
      } else {
        code = JsTransfer.transferFile(relFile, compress);
        xfs.sync().save(destFile, code);
        console.log('[transfer js]:', relFile.substr(1));
      }
    } else if (/\.(css|less|sass)$/.test(fileName)) {
      var code = CssTransfer.transferFile(sourceFile, compress);
      xfs.sync().save(destFile, code);
      console.log('[transfer css]:', relFile.substr(1));
    }
  }, cb);
};
/**
 * transfer js module to browserify node
 * @param  {[type]} file     [description]
 * @param  {[type]} base     [description]
 * @param  {[type]} compress [description]
 * @param  {[type]} merge    [description]
 * @return {[type]}          [description]
 */
exports.buildJs = function (file, base, compress, merge) {
  JsTransfer.init(base);
  return JsTransfer.transferFile(file, compress, merge);
};
exports.minifyJs = function (file, outfile) {
  var destCode = ug.minify();
};
exports.buildTpl = function (file, base, compress) {

};
exports.buildCss = function (file, compress) {
  return ;
};