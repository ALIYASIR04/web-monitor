
var express = require('express');

exports.initWebApp = function(options) {
  var config = options.config.basicAuth;
  options.app.on('beforeFirstRoute', function(app, dashboardApp) {
    app.use(express.basicAuth(config.username, config.password));
  });
};

exports.initMonitor = function(options) {
  var config = options.config.basicAuth;
  options.monitor.addApiHttpOption('auth',  config.username + ':' + config.password);
};