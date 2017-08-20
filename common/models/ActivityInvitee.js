/*
 * Copyright (C) 2017 lets., All Rights Reserved.
 */

'use strict';

/**
 * Activity invitee resource.
 * An activity can have multiple invitees. There is one-to-many relationship from activity to invitees
 * Invitees are those users that author explicitly invite to join the activity
 *
 * @author      TSCCODER
 * @version     1.0.0
 */

const _ = require('lodash');
const USER_TYPES = require('../constants').USER_TYPES;

/**
 * Default module export function
 * @param  {Object}       thinky            the instantiated thinky ORM instance
 * @return {Objetc}                         the ActivityInvitee model
 */
module.exports = function schemaFn(thinky) {
  const type = thinky.type;
  const ActivityInvitee = thinky.createModel('activity_invitees', {
    // primary key, the primary key is set by the database so it is not required,
    // but when retrieving document thinky will match the returned
    // fields with schema and discard any extra fields
    id: type.string().uuid(4),
    activityId: type.string().uuid(4).required(),
    inviteeId: type.string().uuid(4).required(),
    type: type.string().enum(_.values(USER_TYPES)).required(),
    createdAt: type.number().integer().min(0).required(),
    // the timestamp this resource was last updated
    updatedAt: type.number().integer().min(0).required(),
  }, {
    enforce_extra: 'remove',
    enforce_type: 'strict',
  });
  ActivityInvitee.ensureIndex('createdAt');
  ActivityInvitee.ensureIndex('updatedAt');
  ActivityInvitee.ensureIndex('activityId');
  ActivityInvitee.ensureIndex('inviteeId');
  ActivityInvitee.ensureIndex('activityId_inviteeId', doc => [doc('activityId'), doc('inviteeId')]);
  return ActivityInvitee;
};
