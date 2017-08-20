/*
 * Copyright (C) 2017 lets., All Rights Reserved.
 */

'use strict';

/**
 * User linked calendar resource.
 * A user can have multiple linked calendars.
 * Whenever user create an activity the calendar is auto updated based on the setting
 *
 * @author      TSCCODER
 * @version     1.0.0
 */
const _ = require('lodash');
const CALENDAR_TYPES = require('../constants').CALENDAR_TYPES;

/**
 * Default module export function
 * @param  {Object}       thinky            the instantiated thinky ORM instance
 * @return {Objetc}                         the UserLinkedCalendar model
 */
module.exports = function schemaFn(thinky) {
  const type = thinky.type;
  const UserLinkedCalendar = thinky.createModel('users_linked_calendars', {
    // primary key, the primary key is set by the database so it is not required,
    // but when retrieving document thinky will match the returned
    // fields with schema and discard any extra fields
    id: type.string().uuid(4),
    userId: type.string().uuid(4).required(),
    type: type.string().enum(_.values(CALENDAR_TYPES)).required(),
    autoUpdate: type.number().integer().min(0).max(1)
      .default(0)
      .required(),
    // for apple calendar access token is not required
    accessToken: type.string(),
    refreshToken: type.string().allowNull(true),
    metadata: type.object().allowNull(true).allowExtra(true),
    // the timestamp this resource is created
    createdAt: type.number().integer().required(),
    // the timestamp this resource was last updated
    updatedAt: type.number().integer().required(),
  }, {
    enforce_extra: 'remove',
    enforce_type: 'strict',
  });

  UserLinkedCalendar.ensureIndex('userId');
  UserLinkedCalendar.ensureIndex('type');
  UserLinkedCalendar.ensureIndex('userId_type', doc => [doc('userId'), doc('type')]);
  return UserLinkedCalendar;
};
