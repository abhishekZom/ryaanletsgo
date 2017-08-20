/*
 * Copyright (C) 2017 lets., All Rights Reserved.
 */

'use strict';

/**
 * Comment resource.
 * Users interact with activities by commenting, sharing or liking them.
 * A comment can have text or photos
 *
 * @author      TSCCODER
 * @version     1.0.0
 */

/**
 * Default module export function
 * @param  {Object}       thinky            the instantiated thinky ORM instance
 * @return {Objetc}                         the Comment model
 */
module.exports = function schemaFn(thinky) {
  const type = thinky.type;
  const Comment = thinky.createModel('comments', {
    // primary key, the primary key is set by the database so it is not required,
    // but when retrieving document thinky will match the returned
    // fields with schema and discard any extra fields
    id: type.string().uuid(4),
    activityId: type.string().uuid(4).required(),
    text: type.string().allowNull(true),
    photos: type.array().allowNull(true),
    // the author of the comment
    author: type.string().uuid(4).required(),
    // if this is a comment on another comment than parent id is the id of original comment
    parent: type.string().uuid(4).allowNull(true),
    // the timestamp this resource is created
    createdAt: type.number().integer().min(0).required(),
    // the timestamp this resource was last updated
    updatedAt: type.number().integer().min(0).required(),
  }, {
    enforce_extra: 'remove',
    enforce_type: 'strict',
  });
  Comment.ensureIndex('createdAt');
  Comment.ensureIndex('updatedAt');
  Comment.ensureIndex('activityId');
  Comment.ensureIndex('author');
  Comment.ensureIndex('activityId_author', doc => [doc('activityId'), doc('author')]);
  return Comment;
};
