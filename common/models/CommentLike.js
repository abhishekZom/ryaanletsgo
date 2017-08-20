/*
 * Copyright (C) 2017 lets., All Rights Reserved.
 */

'use strict';

/**
 * Comment like resource.
 * User can express their feelings by liking a particular comment.
 *
 * @author      TSCCODER
 * @version     1.0.0
 */

/**
 * Default module export function
 * @param  {Object}       thinky            the instantiated thinky ORM instance
 * @return {Objetc}                         the CommentLike model
 */
module.exports = function schemaFn(thinky) {
  const type = thinky.type;
  const CommentLike = thinky.createModel('comment_likes', {
    // primary key, the primary key is set by the database so it is not required,
    // but when retrieving document thinky will match the returned
    // fields with schema and discard any extra fields
    id: type.string().uuid(4),
    commentId: type.string().uuid(4).required(),
    userId: type.string().uuid(4).required(),
    createdAt: type.number().integer().min(0).required(),
    // the timestamp this resource was last updated
    updatedAt: type.number().integer().min(0).required(),
  }, {
    enforce_extra: 'remove',
    enforce_type: 'strict',
  });
  CommentLike.ensureIndex('createdAt');
  CommentLike.ensureIndex('updatedAt');
  CommentLike.ensureIndex('commentId');
  CommentLike.ensureIndex('userId');
  CommentLike.ensureIndex('commentId_userId', doc => [doc('commentId'), doc('userId')]);
  return CommentLike;
};
