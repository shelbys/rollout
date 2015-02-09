var Promise = require('bluebird');
var async   = require('async');

exports = module.exports = Group;

exports.create = function(name, rollout) {
  return new Group(name, rollout);
};

/**
 * Group constructor
 */

function Group(name, rollout) {
  if (!name || !rollout) {
    throw new Error("The Group constructor expected two params.");
  }

  this.name    = name;
  this.rollout = rollout;
  this._fn      = function(user, callback) {
    if (callback) {
      callback(null, true);
    } else {
      return true;
    }
  };

  if ('object' === typeof this.rollout) {
    var setName = this.rollout.name('rollout:groups');
    this.rollout.client.sadd(setName, name, function(err, result) {});
  }
}

/**
 * Define a function
 */

Group.prototype.fn = function(fn) {

  if (!fn || 'function' !== typeof fn) {
    throw new Error("Expected a function.");
  }

  this._fn = fn;
  return this;
};

/**
 * Active
 */

Group.prototype.active = function(feature) {
  var self = this;

  if (!feature) {
    throw new Error("Expected a feature name.");
  }

  return new Promise(function(resolve, reject) {
    var name = self.rollout.name('rollout:groups:' + self.name);
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
        return new Promise(function(resolve) { resolve(true); });
      }

      var name = self.rollout.name('rollout:groups:' + self.name);
      return new Promise(function(resolve, reject) {
        self.rollout.client.smembers(name, function (err, members) {
          if (err) {
            return reject(err);
          }
          resolve(members);
        });
      }.bind(self)).then(function(members) {
          var fns = [];
          members.forEach(function (member) {
            var group = self.rollout._groups[member];
            if (group) {
              fns.push(function (cb) {
                group.active(feature).then(function (active) {
                  cb(null, !!active);
                });
              });
            }
          });

          if (fns.length == 0) {
            return new Promise(function (resolve) {
              resolve(false);
            });
          }

          return new Promise(function (resolve, reject) {
            async.parallel(fns, function (err, results) {
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
    }.bind(self));
};

/**
 * Activate
 */

Group.prototype.activate = function(feature) {
  var self = this;

  if (!feature) {
    throw new Error("Expected a feature.");
  }

  return new Promise(function(resolve, reject) {
    var name = self.rollout.name('rollout:groups:' + self.name);
    self.rollout.client.sadd(name, feature, function(err, result) {
      if (err) {
        return reject(err);
      }

      resolve();
    });
  });
};