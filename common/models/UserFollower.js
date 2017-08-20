/*
 * Copyright (C) 2017 lets., All Rights Reserved.
 */

'use strict';

/**
 * User follower resource.
 * A user can follow other users. This relationship is one way i.e, A is following B but not necessarily
 * B is following A.
 *
 * @author      TSCCODER
 * @version     1.0.0
 */

/**
 * Default module export function
 * @param  {Object}       thinky            the instantiated thinky ORM instance
 * @return {Objetc}                         the UserFollower model
 */
module.exports = function schemaFn(thinky) {
  const type = thinky.type;
  const UserFollower = thinky.createModel('users_followers', {
    // primary key, the primary key is set by the database so it is not required,
    // but when retrieving document thinky will match the returned
    // fields with schema and discard any extra fields
    id: type.string().uuid(4),
    userId: type.string().uuid(4).required(),
    followerId: type.string().uuid(4).required(),
    /**
     * The status of the request
     * 0: The request is in pending state
     * 1: The follow request is accepted by the user with id `userId`
     * 2: The follow request was rejected by the user with id `userId`
     * @type {Number}
     */
    status: type.number().integer().min(0).default(0)
      .required(),
    // the timestamp this resource is created
    createdAt: type.number().integer().required(),
    // the timestamp this resource was last updated
    updatedAt: type.number().integer().required(),
  }, {
    enforce_extra: 'remove',
    enforce_type: 'strict',
  });
  UserFollower.ensureIndex('followerId');
  UserFollower.ensureIndex('userId');
  UserFollower.ensureIndex('followerId_status', doc => [doc('followerId'), doc('status')]);
  UserFollower.ensureIndex('userId_status', doc => [doc('userId'), doc('status')]);
  UserFollower.ensureIndex('userId_followerId', doc => [doc('userId'), doc('followerId')]);
  return UserFollower;
};
