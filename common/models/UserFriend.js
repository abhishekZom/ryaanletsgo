/*
 * Copyright (C) 2017 lets., All Rights Reserved.
 */

'use strict';

/**
 * User friend resource.
 * An app user can have external non app contacts as well as app contacts.
 * App contact here mean that the user A is not following the specified user B
 * but that user B is still in user A contact list.
 * This resource maps the relationship from user A --> user B
 * This is used internally and abstract from the API's
 * NOTE: It is possible to have duplicates between the two tables UserFollower and UserFriend
 * For ex: user B follows user A and user B is also a friend of user A.
 * In these scenarios if unique results are expected kindly join two sequences and use distinct
 *
 * @author      TSCCODER
 * @version     1.0.0
 */

/**
 * Default module export function
 * @param  {Object}       thinky            the instantiated thinky ORM instance
 * @return {Objetc}                         the UserFriend model
 */
module.exports = function schemaFn(thinky) {
  const ttype = thinky.type;
  const UserFriend = thinky.createModel('user_friends', {
    // primary key, the primary key is set by the database so it is not required,
    // but when retrieving document thinky will match the returned
    // fields with schema and discard any extra fields
    id: ttype.string().uuid(4),
    userId: ttype.string().uuid(4).required(),
    friendId: ttype.string().uuid(4).required(),
    // the timestamp this resource is created
    createdAt: ttype.number().integer().required(),
    // the timestamp this resource was last updated
    updatedAt: ttype.number().integer().required(),
  }, {
    enforce_extra: 'remove',
    enforce_type: 'strict',
  });
  UserFriend.ensureIndex('userId');
  UserFriend.ensureIndex('friendId');
  UserFriend.ensureIndex('userId_friendId', doc => [doc('userId'), doc('friendId')]);
  return UserFriend;
};
