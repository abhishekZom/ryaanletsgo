/*
 * Copyright (C) 2017 lets., All Rights Reserved.
 */

'use strict';

/**
 * Activity rsvp user resource.
 * An activity can have multiple invitees.
 * Users which acknowledge their invites by rsvp'ing to the activity are stored in this relation
 *
 * @author      TSCCODER
 * @version     1.0.0
 */

/**
 * Default module export function
 * @param  {Object}       thinky            the instantiated thinky ORM instance
 * @return {Objetc}                         the ActivityRsvp model
 */
module.exports = function schemaFn(thinky) {
  const type = thinky.type;
  const ActivityRsvp = thinky.createModel('activity_rsvp', {
    // primary key, the primary key is set by the database so it is not required,
    // but when retrieving document thinky will match the returned
    // fields with schema and discard any extra fields
    id: type.string().uuid(4),
    activityId: type.string().uuid(4).required(),
    userId: type.string().uuid(4).required(),
    createdAt: type.number().integer().min(0).required(),
    // the timestamp this resource was last updated
    updatedAt: type.number().integer().min(0).required(),
  }, {
    enforce_extra: 'remove',
    enforce_type: 'strict',
  });
  ActivityRsvp.ensureIndex('createdAt');
  ActivityRsvp.ensureIndex('updatedAt');
  ActivityRsvp.ensureIndex('activityId');
  ActivityRsvp.ensureIndex('userId');
  ActivityRsvp.ensureIndex('activityId_userId', doc => [doc('activityId'), doc('userId')]);
  return ActivityRsvp;
};
