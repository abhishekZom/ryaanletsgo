/*
 * Copyright (C) 2017 lets., All Rights Reserved.
 */

'use strict';

/**
 * Initiates the model
 *
 * @author      TSCCODER
 * @version     1.0.0
 */

const _ = require('lodash');
const R = require('rethinkdbdash');
const Thinky = require('thinky');
const moment = require('moment');

// in memory cache for all the db instances
const instances = { };

/**
 * Prepare the model, add timestamp hooks to the model
 *
 * @param   {Object}          Model             The thinky model
 * @return  {Object}                            the modified model instance
 */
function addHooks(Model) {
  Model.pre('validate', function preValidateHook() {
    if (this.isSaved() && !_.isNumber(this.updatedAt)) {
      this.updatedAt = moment().valueOf();
    } else if (!this.isSaved()) {
      this.updatedAt = moment().valueOf();
      this.createdAt = moment().valueOf();
    }
  });
  return Model;
}

/**
 * Get a singleton instance for a datasource.
 * The datasource is the rethindb name.
 * For each unique db names different instances are returned
 *
 * @param   {object}          options           the datasource configuration options
 * @param   {object}          options.db        the rethinkdb driver configuration
 * @param   {object}          options.logger    the logger for database driver
 * @return  {Object}                            instantiated model as name:model map
 */
exports.getDatasource = function datasource(options) {
  if (!_.has(options, 'db.db') || !_.has(options, 'logger')) {
    throw new Error('invalid datasource config options');
  }
  // if instantiated return that instance
  if (_.isObject(instances[options.db.db])) {
    return instances[options.db.db];
  }
  // instantiate db instance

  const driverOptions = _.extend(options.db, { silent: true });
  const r = new R(driverOptions);
  // add log listener to driver
  r.getPoolMaster().on('log', options.logger.info);
  const thinky = new Thinky({ r, db: options.db.db });

  // instantiate models
  const AccessToken = addHooks(require('./AccessToken')(thinky));
  const Action = addHooks(require('./Action')(thinky));
  const Activity = addHooks(require('./Activity')(thinky));
  const ActivityInvitee = addHooks(require('./ActivityInvitee')(thinky));
  const ActivityLike = addHooks(require('./ActivityLike')(thinky));
  const ActivityPhoto = addHooks(require('./ActivityPhoto')(thinky));
  const ActivityRsvp = addHooks(require('./ActivityRsvp')(thinky));
  const Comment = addHooks(require('./Comment')(thinky));
  const CommentLike = addHooks(require('./CommentLike')(thinky));

  const Feed = addHooks(require('./Feed')(thinky));

  const Group = addHooks(require('./Group')(thinky));
  const GroupMember = addHooks(require('./GroupMember')(thinky));

  const User = addHooks(require('./User')(thinky));
  const UserBlock = addHooks(require('./UserBlock')(thinky));
  const UserContact = addHooks(require('./UserContact')(thinky));
  const UserEmailVerification = addHooks(require('./UserEmailVerification')(thinky));
  const UserFollower = addHooks(require('./UserFollower')(thinky));
  const UserFriend = addHooks(require('./UserFriend')(thinky));
  const UserLinkedCalendar = addHooks(require('./UserLinkedCalendar')(thinky));
  const UserNotificationPreference = addHooks(require('./UserNotificationPreference')(thinky));
  const UserPhoneNumber = addHooks(require('./UserPhoneNumber')(thinky));
  const UserPhoneNumberVerification = addHooks(require('./UserPhoneNumberVerification')(thinky));
  const UserResetPassword = addHooks(require('./UserResetPassword')(thinky));
  const UserSetting = addHooks(require('./UserSetting')(thinky));
  const UserSocialConnection = addHooks(require('./UserSocialConnection')(thinky));

  instances[options.db.db] = {
    AccessToken,
    Action,
    Activity,
    ActivityInvitee,
    ActivityLike,
    ActivityPhoto,
    ActivityRsvp,
    Comment,
    CommentLike,
    Feed,
    Group,
    GroupMember,
    User,
    UserBlock,
    UserContact,
    UserEmailVerification,
    UserFollower,
    UserFriend,
    UserLinkedCalendar,
    UserNotificationPreference,
    UserPhoneNumber,
    UserPhoneNumberVerification,
    UserResetPassword,
    UserSetting,
    UserSocialConnection,
    thinky,
    r,
  };

  return instances[options.db.db];
};
