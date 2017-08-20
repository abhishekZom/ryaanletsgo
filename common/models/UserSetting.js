/*
 * Copyright (C) 2017 lets., All Rights Reserved.
 */

'use strict';

/**
 * User setting resource.
 * A user can have multiple account settings.
 * Currently this resource is used to store default activity duration and approve followers settings.
 * It's always better to separate out the settings from user resource, this allows
 * to have additional settings in future.
 *
 * @author      TSCCODER
 * @version     1.0.0
 */

const constants = require('../constants');

/**
 * Default module export function
 * @param  {Object}       thinky            the instantiated thinky ORM instance
 * @return {Objetc}                         the UserSetting model
 */
module.exports = function schemaFn(thinky) {
  const type = thinky.type;
  const UserSetting = thinky.createModel('users_settings', {
    // primary key, the primary key is set by the database so it is not required,
    // but when retrieving document thinky will match the returned
    // fields with schema and discard any extra fields
    id: type.string().uuid(4),
    userId: type.string().uuid(4).required(),
    defaultActivityDuration: type.number().integer().min(1).default(constants.DEFAULT_ACTIVITY_DURATION)
      .required(),
    approveFollowers: type.number().integer().min(0).default(constants.DEFAULT_APPROVE_FOLLOWERS)
      .required(),
    // the timestamp this resource is created
    createdAt: type.number().integer().required(),
    // the timestamp this resource was last updated
    updatedAt: type.number().integer().required(),
  }, {
    enforce_extra: 'remove',
    enforce_type: 'strict',
  });
  UserSetting.ensureIndex('userId');
  return UserSetting;
};
