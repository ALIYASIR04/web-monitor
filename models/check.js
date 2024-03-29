var mongoose = require('mongoose');
var Schema   = mongoose.Schema;
var moment   = require('moment');
var async    = require('async');

// models dependencies
var Ping             = require('../models/ping');
var CheckEvent       = require('../models/checkEvent');

// main model
var Check = new Schema({
  name        : String,
  type        : String,
  url         : String,
  interval    : { type: Number, default: 5000 }, // interval between two pings
  maxTime     : { type: Number, default: 5000 },  
  alertTreshold : { type: Number, default: 5 },   
  errorCount  : { type: Number, default: 0 },     // count number of errors
  lastChanged : Date,
  firstTested : Date,
  lastTested  : Date,
  isUp        : Boolean,
  isPaused    : { type: Boolean, default: false },
  uptime      : { type: Number, default: 0 },
  downtime    : { type: Number, default: 0 },
  pollerParams : Schema.Types.Mixed
});
Check.plugin(require('mongoose-lifecycle'));

Check.pre('remove', function(next) {
  async.parallel([this.removePings.bind(this), this.removeEvents.bind(this), this.removeStats.bind(this)], function() {
    next();
  });
});

Check.methods.setPollerParam = function(name, value) {
  if (!this.pollerParams) this.pollerParams = {};
  this.pollerParams[name] = value;
  this.markModified('pollerParams');
};

Check.methods.getPollerParam = function(name) {
  if (!this.pollerParams) return;
  return this.pollerParams[name];
};

Check.methods.removePings = function(callback) {
  Ping.remove({ check: this._id }, callback);
};

Check.methods.removeEvents = function(callback) {
  CheckEvent.remove({ check: this._id }, callback);
};


Check.methods.needsPoll = function() {
  if (this.isPaused) return false;
  if (!this.firstTested) return true;
  var delay = (this.lastTested.getTime() - this.firstTested.getTime()) % this.interval;
  return (Date.now() - this.lastTested.getTime() + delay) >= (this.interval || 60000);
};

Check.methods.togglePause = function() {
  this.isPaused = !this.isPaused;
  if (!this.isPaused) {
    // restarted
    this.isUp = undefined;
  }
  this.lastChanged = new Date();
};

Check.methods.setLastTest = function(status, time, error) {
  var now = time ? new Date(time) : new Date();
  var mustNotifyEvent = this.mustNotifyEvent(status);

  if (!this.firstTested) {
    this.firstTested = now;
  }

  this.lastTested = now;

  if (this.isUp != status) {
    this.lastChanged = now;
    this.isUp = status;
    this.uptime = 0;
    this.downtime = 0;
  }

  if (mustNotifyEvent) {
    var event = new CheckEvent({
      timestamp: now,
      check: this,
      //tags: this.tags,
      message: status ? 'up' : 'down',
      details: error
    });
    if (status && this.lastChanged && this.isUp != undefined) {
      // Check comes back up
      event.downtime = now.getTime() - this.lastChanged.getTime();
    }
    event.save();
    this.markEventNotified();
  }
  var durationSinceLastChange = now.getTime() - this.lastChanged.getTime();
  if (status) {
    this.uptime = durationSinceLastChange;
  } else {
    this.downtime = durationSinceLastChange;
  }
  return this;
};

Check.methods.mustNotifyEvent = function(status) {
  if (!this.firstTested) {
    return true;
  }
  if (!status) {
    // check is down
    if (this.isUp != status) {
      // check goes down for the first time
      this.errorCount = 1;
    }
    if (this.errorCount < this.alertTreshold) {
      // repeated down pings - increase error count until reaching the down alert treshold
      this.errorCount++;
      return false;
    }
    if (this.errorCount === this.alertTreshold) {
      // enough down pings to trigger notification
      return true;
    }
    // error count higher than treshold, that means the alert was already sent
    return false;
  }
  // check is up
  if (this.isUp != status && this.errorCount > this.alertTreshold) {
    // check goes up after reaching the down alert treshold before
    return true;
  }
  // check either goes up after less than alertTreshold down pings, or is already up for long
  return false;
};

Check.methods.markEventNotified = function() {
  // increase error count to disable notification if the next ping has the same status
  this.errorCount = this.alertTreshold + 1;
};


Check.methods.updateUptime = function(callback) {
  var self = this;
  Ping
  .findOne()
  .where('check', self)
  .sort({ timestamp: -1 })
  .exec(function(err, latestPing) {
    if (err) return callback(err);
    if (!latestPing) return;
    self.lastTested = latestPing.timestamp;
    self.isUp = latestPing.isUp;
    if (latestPing.isUp) {
      // check is up
      // lastChanged is the latest down ping
      self.downtime = 0;
      Ping
      .findOne()
      .where('check', self)
      .where('isUp', false)
      .where('timestamp').lt(latestPing.timestamp)
      .sort({ timestamp: -1 })
      .exec(function(err, latestDownPing) {
        if (err) return callback(err);
        if (latestDownPing) {
          self.lastChanged = latestDownPing.timestamp;
          self.uptime = latestPing.timestamp.getTime() - latestDownPing.timestamp.getTime();
          self.save(callback);
        } else {
          // check never went down, last changed is the date of the first ping
          Ping
          .findOne()
          .where('check', self)
          .sort({ timestamp: 1 })
          .exec(function(err, firstPing) {
            if (err) return callback(err);
            self.lastChanged = firstPing.timestamp;
            self.uptime = latestPing.timestamp.getTime() - firstPing.timestamp.getTime();
            self.save(callback);
          });
        }
      });
    } else {
      // check is down
      // lastChanged is the latest up ping
      self.uptime = 0;
      Ping
      .findOne()
      .where('check', self)
      .where('isUp', true)
      .where('timestamp').lt( latestPing.timestamp)
      .sort({ timestamp: -1 })
      .exec(function(err, latestUpPing) {
        if (err) return callback(err);
        if (latestUpPing) {
          self.lastChanged = latestUpPing.timestamp;
          self.downtime = latestPing.timestamp.getTime() - latestUpPing.timestamp.getTime();
          self.save(callback);
        } else {
          // check never went up, last changed is the date of the first ping
          Ping
          .findOne()
          .where('check', self)
          .sort({ timestamp: 1 })
          .exec(function(err, firstPing) {
            if (err) return callback(err);
            self.lastChanged = firstPing.timestamp;
            self.downtime = latestPing.timestamp.getTime() - firstPing.timestamp.getTime();
            self.save(callback);
          });
        }
      });
    }
  });
};


Check.methods.getStatsForPeriod = function(period, begin, end, callback) {
  var periodPrefs = statProvider[period];
  var stats = [];
  var query = { check: this, timestamp: { $gte: begin, $lte: end } };
  var stream = this.db.model(periodPrefs['model']).find(query).sort({ timestamp: -1 }).stream();
  stream.on('error', function(err) {
    callback(err);
  }).on('data', function(stat) {
    if (typeof stat.isUp != 'undefined') {
      // stat is a Ping
      stats.push(stat);
    } else {
      // stat is an aggregation
      stats.push({
        timestamp: Date.parse(stat.timestamp),
        availability: (stat.availability * 100).toFixed(3),
        responsiveness: (stat.responsiveness * 100).toFixed(3),
        downtime: parseInt(stat.downtime / 1000),
        responseTime: parseInt(stat.responseTime),
        outages: stat.outages || [],
        end: stat.end ? stat.end.valueOf() : (Date.parse(stat.timestamp) + periodPrefs['duration'])
      });
    }
  }).on('close', function() {
    callback(null, stats);
  });
};

var singleStatsProvider = {
  'hour':  'CheckHourlyStat',
  'day':   'CheckDailyStat',
  'month': 'CheckMonthlyStat',
  'year':  'CheckYearlyStat'
};

Check.methods.getSingleStatForPeriod = function(period, date, callback) {
  var model = singleStatsProvider[period];
  var begin = moment(date).clone().startOf(period).toDate();
  var end   = moment(date).clone().endOf(period).toDate();
  var query = { check: this, timestamp: { $gte: begin, $lte: end } };
  this.db.model(model).findOne(query, function(err, stat) {
    if (err || !stat) return callback(err);
    return callback(null, {
      timestamp: Date.parse(stat.timestamp),
      availability: (stat.availability * 100).toFixed(3),
      responsiveness: (stat.responsiveness * 100).toFixed(3),
      downtime: parseInt(stat.downtime / 1000),
      responseTime: parseInt(stat.responseTime),
      outages: stat.outages || [],
      begin: begin.valueOf(),
      end: end.valueOf()
    })
  });
};

Check.methods.populateFromDirtyCheck = function(dirtyCheck, pollerCollection) {
  this.url = dirtyCheck.url || this.url;
  this.maxTime = dirtyCheck.maxTime || this.maxTime;
  this.isPaused = dirtyCheck.isPaused || this.isPaused;
  this.alertTreshold = dirtyCheck.alertTreshold || this.alertTreshold;
  this.interval = dirtyCheck.interval * 1000 || this.interval;

  if (typeof(dirtyCheck.name) !== 'undefined' && dirtyCheck.name.length) {
      this.name = dirtyCheck.name;
  } else if (typeof(this.name) === 'undefined' || !this.name.length ) {
      this.name = dirtyCheck.url;
  }

  if (typeof(this.url) == 'undefined') {
    throw new Error('URL must be defined');
  }

  if (dirtyCheck.type) {
    if (!pollerCollection.getForType(dirtyCheck.type).validateTarget(this.url)) {
      throw new Error('URL ' + this.url + ' and poller type ' + dirtyCheck.type + ' mismatch');
    }
    this.type = dirtyCheck.type;
  } else {
    this.type = pollerCollection.guessTypeForUrl(this.url);
  }
};



/**
 * Calls a function for all checks that need to be polled.
 */
Check.statics.callForChecksNeedingPoll = function(callback) {
  var stream = this.needingPoll().stream();
  stream.on('data', function(check) {
    callback(check);
  });
};

Check.statics.needingPoll = function() {
  return this.$where(Check.methods.needsPoll);
};

module.exports = mongoose.model('Check', Check);
