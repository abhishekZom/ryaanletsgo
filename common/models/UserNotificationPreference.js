/*
 * Copyright (C) 2017 lets., All Rights Reserved.
 */

'use strict';

/**
 * User notification preferences resource.
 * A user has certain notification preferences, notification preferences are stored as bitset values
 *
 * @author      TSCCODER
 * @version     1.0.0
 */

const constants = require('../constants');

/**
 * Default module export function
 * @param  {Object}       thinky            the instantiated thinky ORM instance
 * @return {Objetc}                         the UserNotificationPreference model
 */
module.exports = function schemaFn(thinky) {
  const type = thinky.type;
  const UserNotificationPreference = thinky.createModel('users_notification_preferences', {
    // primary key, the primary key is set by the database so it is not required,
    // but when retrieving document thinky will match the returned
    // fields with schema and discard any extra fields
    id: type.string().uuid(4),
    // bitset storing user preferences
    preferences: type.number().integer().min(0).default(constants.DEFAULT_NOTIFICATION_PREFERENCE)
      .required(),
    userId: type.string().uuid(4).required(),
    // the timestamp this resource is created
    createdAt: type.number().integer().required(),
    // the timestamp this resource was last updated
    updatedAt: type.number().integer().required(),
  }, {
    enforce_extra: 'remove',
    enforce_type: 'strict',
  });
  UserNotificationPreference.ensureIndex('userId');
  return UserNotificationPreference;
};
