/**
 * Timer constructor
 */
function Timer(timeout, timeoutCallback) {
  this.finalTime = false;
  this.time = Date.now();
  this.TimerFunction = setTimeout(timeoutCallback, timeout);
}

/**
 * Get time elapsed 
 */
Timer.prototype.getTime = function() {
  return this.finalTime || Date.now() - this.time;
};

// Stop the timer
Timer.prototype.stop = function() {
  this.finalTime = this.getTime();
  clearTimeout(this.TimerFunction);
};

/**
 * Create a timer.
 */
exports.createTimer = function(timeout, timeoutCallback) {
  return new Timer(timeout, timeoutCallback);
};
