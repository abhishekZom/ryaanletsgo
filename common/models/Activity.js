/*
 * Copyright (C) 2017 lets., All Rights Reserved.
 */

'use strict';

/**
 * Activity resource.
 * Activities are the most abstract form representing the user generated content on the platform
 *
 * @author      TSCCODER
 * @version     1.0.0
 */

const _ = require('lodash');
const ACTIVITY_PRIVACY = require('../constants').ACTIVITY_PRIVACY;

/**
 * Default module export function
 * @param  {Object}       thinky            the instantiated thinky ORM instance
 * @return {Objetc}                         the Activity model
 */
module.exports = function schemaFn(thinky) {
  const type = thinky.type;
  const Activity = thinky.createModel('activities', {
    // primary key, the primary key is set by the database so it is not required,
    // but when retrieving document thinky will match the returned
    // fields with schema and discard any extra fields
    id: type.string().uuid(4),
    title: type.string().allowNull(true),
    start: type.number().integer().allowNull(true),
    duration: type.number().integer().allowNull(true),
    location: type.string().allowNull(true),
    meetingPoint: type.string().allowNull(true),
    notes: type.string().allowNull(true),
    // the activity photos share by the author of the activity
    photos: type.array().allowNull(true),
    // the type of activity can be public, private or shared.
    // if shared than only visible to all the user's followers
    privacy: type.string().enum(_.values(ACTIVITY_PRIVACY)).required(),
    // the author of the activity
    author: type.string().uuid(4).required(),
    // internal fields
    // if this activity is shared than this is the reference to original activity that was shared.
    // NOTE: This sharing has no reference to `shared` activity type
    parent: type.string().uuid(4).allowNull(true),
    // the timestamp this resource is created
    createdAt: type.number().integer().min(0).required(),
    // the timestamp this resource was last updated
    updatedAt: type.number().integer().min(0).required(),
  }, {
    enforce_extra: 'remove',
    enforce_type: 'strict',
  });
  Activity.ensureIndex('createdAt');
  Activity.ensureIndex('updatedAt');
  Activity.ensureIndex('title');
  Activity.ensureIndex('start');
  Activity.ensureIndex('author');
  Activity.ensureIndex('privacy');
  Activity.ensureIndex('start_duration', doc => (doc('start') + doc('duration')));
  return Activity;
};
