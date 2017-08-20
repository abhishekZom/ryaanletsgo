/*
 * Copyright (C) 2017 lets., All Rights Reserved.
 */

'use strict';

/**
 * Activity photo resource.
 * This table has consolidated list of all the activity photos
 * This is needed for `GET /activities/{activityId}/photos` API.
 * It is not always feasible to merge photos from all the comments and activities
 * and then sort, limit or skip these records in application side.
 * This application side operations are feasible for small number of records like 1M
 * but it will result in lot of heap usage for large number of records 100M.
 *
 * @author      TSCCODER
 * @version     1.0.0
 */

/**
 * Default module export function
 * @param  {Object}       thinky            the instantiated thinky ORM instance
 * @return {Objetc}                         the ActivityPhoto model
 */
module.exports = function schemaFn(thinky) {
  const type = thinky.type;
  const ActivityPhoto = thinky.createModel('activity_photos', {
    // primary key, the primary key is set by the database so it is not required,
    // but when retrieving document thinky will match the returned
    // fields with schema and discard any extra fields
    id: type.string().uuid(4),
    activityId: type.string().uuid(4).required(),
    commentId: type.string().uuid(4).optional().allowNull(true),
    photo: type.object().allowNull(true).allowExtra(true),
    createdAt: type.number().integer().min(0).required(),
    // the timestamp this resource was last updated
    updatedAt: type.number().integer().min(0).required(),
  }, {
    enforce_extra: 'remove',
    enforce_type: 'strict',
  });
  ActivityPhoto.ensureIndex('createdAt');
  ActivityPhoto.ensureIndex('updatedAt');
  ActivityPhoto.ensureIndex('activityId');
  ActivityPhoto.ensureIndex('activityId_commentId', doc => [doc('activityId'), doc('commentId')]);
  return ActivityPhoto;
};
