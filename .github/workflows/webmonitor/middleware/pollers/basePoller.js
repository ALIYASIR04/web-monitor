/**
 * Module dependencies.
 */
var timer = require('../timer');

/**
 * Base Poller constructor
 */
function BasePoller(target, timeout, callback) {
  this.target = target;
  this.timeout = timeout || 5000;
  this.callback = callback;
  this.isDebugEnabled = false;
  this.initialize();
}

BasePoller.prototype.initialize = function() {};


BasePoller.prototype.setDebug = function(bool) {
  this.isDebugEnabled = bool;
};


BasePoller.prototype.debug = function(msg) {
  if (this.isDebugEnabled) console.log(msg);
};

/**
 * Launch the actual polling
 */
BasePoller.prototype.poll = function() {
  if (!this.timer) { // timer already exists in case of a redirect
    this.timer = timer.createTimer(this.timeout, this.timeoutReached.bind(this));
  }
  this.debug(this.getTime() + "ms - Emitting Request");
};

/**
 * Error callback
 */
BasePoller.prototype.onErrorCallback = function(err) {
  this.timer.stop();
  this.debug(this.getTime() + "ms - Got error: " + err.message);
  this.callback(err, this.getTime());
};

/**
 * Timeout callback
 */
BasePoller.prototype.timeoutReached = function() {
  this.onErrorCallback({ name: "TimeOutError", message: "Request Timeout"});
};


BasePoller.prototype.getTime = function() {
  return this.timer.getTime();
};


BasePoller.validateTarget = function(target) {
  return false;
};

module.exports = BasePoller;