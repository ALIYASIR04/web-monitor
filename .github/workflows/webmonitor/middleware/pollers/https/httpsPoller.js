/**
 * Module dependencies.
 */

var util  = require('util');
var https = require('https');
var http  = require('http');
var url   = require('url');
var fs    = require('fs');
var ejs   = require('ejs');
var BaseHttpPoller = require('../http/baseHttpPoller');


/**
 * HTTPS Poller, to check web pages served via SSL
 */
function HttpsPoller(target, timeout, callback) {
  HttpsPoller.super_.call(this, target, timeout, callback);
}

util.inherits(HttpsPoller, BaseHttpPoller);

HttpsPoller.type = 'https';

HttpsPoller.validateTarget = function(target) {
  return url.parse(target).protocol == 'https:';
};

/**
 * Launch the actual polling
 */
HttpsPoller.prototype.poll = function(secure) {
  HttpsPoller.super_.prototype.poll.call(this);
  secure = typeof secure !== 'undefined' ? secure : true;
  try {
    if (secure) {
      this.request = https.get(this.target, this.onResponseCallback.bind(this));
    } else {
      this.request = http.get(this.target, this.onResponseCallback.bind(this));
    }
  } catch(err) {
    return this.onErrorCallback(err);
  }
  this.request.on('error', this.onErrorCallback.bind(this));
};

HttpsPoller.prototype.handleRedirectResponse = function(res) {
  this.debug(this.getTime() + "ms - Got redirect response to " + this.target.href);
  var target = url.parse(res.headers.location);
  if (!target.protocol) {
    // relative location header. This is incorrect but tolerated
    this.target = url.parse('http://' + this.target.hostname + res.headers.location);
    this.poll(false);
    return;
  }
  switch (target.protocol) {
    case 'https:':
      this.target = target;
      this.poll(true);
      break;
    case 'http:':
      this.target = target;
      this.poll(false);
      break;
    default:
      this.request.abort();
      this.onErrorCallback({ name: "WrongRedirectUrl", message: "Received redirection from https: to unsupported protocol " + target.protocol});
  }
  return;
};

module.exports = HttpsPoller;