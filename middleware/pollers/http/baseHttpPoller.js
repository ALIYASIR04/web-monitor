/**
 * Module dependencies.
 */

var util = require('util');
var url  = require('url');
var BasePoller = require('../basePoller');


/**
 * Abstract class for HTTP and HTTPS Pollers, to check web pages
 */
function BaseHttpPoller(target, timeout, callback) {
  BaseHttpPoller.super_.call(this, target, timeout, callback);
}

util.inherits(BaseHttpPoller, BasePoller);

BaseHttpPoller.prototype.initialize = function() {
  if (typeof(this.target) == 'string') {
    this.target = url.parse(this.target);
  }
};

/**
 * Set the User Agent, which identifies the poller to the outside world
 */
BaseHttpPoller.prototype.setUserAgent = function(userAgent) {
  if (typeof this.target.headers == 'undefined') {
    this.target.headers = {};
  }
  this.target.headers['User-Agent'] = userAgent;
};

/**
 * Response callback
 */
BaseHttpPoller.prototype.onResponseCallback = function(res) {
  var statusCode = res.statusCode.toString();
  if (statusCode.match(/3\d{2}/)) {
    return this.handleRedirectResponse(res); // abstract, see implementations in http and https
  }
  if (statusCode.match(/2\d{2}/) === null) {
    return this.handleErrorResponse(res);
  }
  this.handleOkResponse(res);
};

BaseHttpPoller.prototype.handleErrorResponse = function(res) {
  this.request.abort();
  this.onErrorCallback({ name: "NonOkStatusCode", message: "HTTP status " + res.statusCode});
};

BaseHttpPoller.prototype.handleOkResponse = function(res) {
  var poller = this;
  var body = '';
  this.debug(this.getTime() + "ms - Status code 200 OK");
  res.on('data', function(chunk) {
    body += chunk.toString();
    poller.debug(poller.getTime() + 'ms - BODY: ' + chunk.toString().substring(0, 100) + '...');
  });
  res.on('end', function() {
    res.body = body;
    poller.timer.stop();
    poller.debug(poller.getTime() + "ms - Request Finished");
    poller.callback(undefined, poller.getTime(), res);
  });
};

/**
 * Timeout callback
 */
BaseHttpPoller.prototype.timeoutReached = function() {
  BaseHttpPoller.super_.prototype.timeoutReached.call(this);
  this.request.removeAllListeners('error');
  this.request.on('error', function() { /* swallow error */ });
  this.request.abort();
};

module.exports = BaseHttpPoller;
