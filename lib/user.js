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

User.prototype.active = function(feature, skipGroups) {
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

      if (active || skipGroups) {
        return new Promise(function(resolve) { resolve(active); })
      }

      var fns = [];
      Object.keys(self.rollout._groups).forEach(function(groupName) {
        var group = self.rollout._groups[groupName];
        fns.push(function (cb) {
          group._fn(user, function (error, isMember) {
            if (error) {
              cb(error);
            } else if (isMember) {
              group.active(feature).then(function (active) {
                cb(null, !!active);
              });
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