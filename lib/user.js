var Promise = require('bluebird');
var async   = require('async');

exports = module.exports = User;

exports.create = function(user, rollout) {
  return new User(user, rollout);
};

/**
 * User constructor
 */

function User(user, rollout) {
  if (!user || !rollout) {
    throw new Error("The User constructor expected two params.");
  }

  this.user    = user;
  this.rollout = rollout;

  if ('object' === typeof this.rollout) {
    var name = this.rollout.name('rollout:users');
    this.rollout.client.sadd(name, user[this.rollout._id] || user, function(err, result) {});
  }
}

/**
 * Active
 */

User.prototype.active = function(feature) {
  var self = this;
  var user = self.user;

  if (!feature) {
    throw new Error("Expected a feature name.");
  }

  return new Promise(function(resolve, reject) {
    var name = self.rollout.name('rollout:users:' + (user[self.rollout._id] || user));
    self.rollout.client.sismember(name, feature, function(err, result) {
      if (err) {
        return reject(err);
      }

      if (result === 1) {
        resolve(true);
      } else {
        resolve(false);
      }
    });
  }.bind(self)).then(function(active) {

    if (active) {
      return new Promise(function(resolve) { resolve(true); })
    }

    var groups = [];
    var fns    = [];

    for(var key in self.rollout._groups) {
      var group = self.rollout._groups[key];
      if (group._fn(user)) {
        groups.push(group);
      }
    }

    groups.forEach(function(group) {
      fns.push(function(cb) {
        var name = self.rollout.name('rollout:groups:' + group.name);
        self.rollout.client.sismember(name, feature, function(err, result) {
          if (err) {
            return cb(err);
          }

          if (result === 1) {
            cb(null, true);
          } else {
            cb(null, false);
          }

        });
      });
    });

    return new Promise(function(resolve, reject) {
      async.parallel(fns, function(err, results) {
        if (err) {
          return reject(err);
        }

        if (results.indexOf(true) !== -1) {
          resolve(true);
        } else {
          resolve(false);
        }
      });
    });

  }.bind(self));
};

/**
 * Activate
 */

User.prototype.activate = function(feature) {
  var self = this;

  if (!feature) {
    throw new Error("Expected a feature.");
  }

  return new Promise(function(resolve, reject) {
    var name = self.rollout.name('rollout:users:' + (self.user[self.rollout._id] || self.user));
    self.rollout.client.sadd(name, feature, function(err, result) {
      if (err) {
        return reject(err);
      }

      resolve();
    });
  });
};