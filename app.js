/*
 * Monitor websites.
 */

var http       = require('http');
var url        = require('url');
var express    = require('express');
var config     = require('config');
var socketIo   = require('socket.io');
var fs         = require('fs');
var CheckEvent = require('./models/checkEvent');
var Ping       = require('./models/ping');
var PollerCollection = require('./middleware/pollers/pollerCollection');
var apiApp     = require('./app/api/app');
var dashboardApp = require('./app/dashboard/app');

// database
var mongoose   = require('./mongostart');


// web front

var app = module.exports = express();
var server = http.createServer(app);

app.configure(function(){
  app.use(app.router);
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(express.cookieParser('Z5V45V6B5U56B7J5N67J5VTH345GC4G5V4'));
  app.use(express.cookieSession({
    key:    'monitor',
    secret: 'FZ5HEE5YHD3E566756234C45BY4DSFZ4',
    proxy:  true,
    cookie: { maxAge: 60 * 60 * 1000 }
  }));
  app.set('pollerCollection', new PollerCollection());
});

// load plugins
config.plugins.forEach(function(pluginName) {
  var plugin = require(pluginName);
  if (typeof plugin.initWebApp !== 'function') return;
  console.log('loading plugin %s on app', pluginName);
  plugin.initWebApp({
    app:       app,
    api:       apiApp,       
    dashboard: dashboardApp, 
    io:        io,
    config:    config,
    mongoose:  mongoose
  });
});

app.emit('beforeFirstRoute', app, apiApp);

app.configure('development', function() {
  if (config.verbose) mongoose.set('debug', true);
  app.use(express.static(__dirname + '/public'));
  app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
});


// Routes
app.emit('beforeApiRoutes', app, apiApp);
app.use('/api', apiApp);

app.emit('beforeDashboardRoutes', app, dashboardApp);
app.use('/dashboard', dashboardApp);
app.get('/', function(req, res) {
  res.redirect('/dashboard/events');
});

app.get('/favicon.ico', function(req, res) {
  res.redirect(301, '/dashboard/favicon.ico');
});

app.emit('afterLastRoute', app);

// Sockets
var io = socketIo.listen(server);

io.configure('development', function() {
  if (!config.verbose) io.set('log level', 1);
});

CheckEvent.on('afterInsert', function(event) {
  io.sockets.emit('CheckEvent', event.toJSON());
});

io.sockets.on('connection', function(socket) {
  socket.on('set check', function(check) {
    socket.set('check', check);
  });
  Ping.on('afterInsert', function(ping) {
    socket.get('check', function(err, check) {
      if (ping.check == check) {
        socket.emit('ping', ping);
      }
    });
  });
});

fs.exists('./plugins/index.js', function(exists) {
  if (exists) {
    var pluginIndex = require('./plugins');
    var initFunction = pluginIndex.init || pluginIndex.initWebApp;
    if (typeof initFunction === 'function') {
      initFunction({
        app:       app,
        api:       apiApp,       
        dashboard: dashboardApp, 
        io:        io,
        config:    config,
        mongoose:  mongoose
      });
    }
  }
});

module.exports = app;

var monitorInstance;

if (!module.parent) {
  var serverUrl = url.parse(config.url);
  var port;
  if (config.server && config.server.port) {
    port = config.server.port;
  } else {
    port = serverUrl.port;
    if (port === null) {
      port = 80;
    }
  }
  var port = process.env.PORT || port;
  var host = process.env.HOST || serverUrl.hostname;
  server.listen(port, function(){
    console.log("Express server listening on host %s, port %d in %s mode", host, port, app.settings.env);
  });
  server.on('error', function(e) {
    if (monitorInstance) {
      monitorInstance.stop();
      process.exit(1);
    }
  });
}

// monitor
if (config.autoStartMonitor) {
  monitorInstance = require('./monitor');
}
