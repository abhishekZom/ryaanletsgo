/*
 * Copyright (C) 2017 lets., All Rights Reserved.
 */

'use strict';

/**
 * User block resource.
 * A user can block another user. This relationship is one way i.e, A blocked B does not necessarily
 * mean B blocked A.
 *
 * @author      TSCCODER
 * @version     1.0.0
 */

/**
 * Default module export function
 * @param  {Object}       thinky            the instantiated thinky ORM instance
 * @return {Objetc}                         the UserBlock model
 */
module.exports = function schemaFn(thinky) {
  const type = thinky.type;
  const UserBlock = thinky.createModel('users_blocked_list', {
    // primary key, the primary key is set by the database so it is not required,
    // but when retrieving document thinky will match the returned
    // fields with schema and discard any extra fields
    id: type.string().uuid(4),
    // this relationship means that a user with id `userId` blocked another user with id `blockedId`
    userId: type.string().uuid(4).required(),
    blockedId: type.string().uuid(4).required(),
    // the timestamp this resource is created
    createdAt: type.number().integer().required(),
    // the timestamp this resource was last updated
    updatedAt: type.number().integer().required(),
  }, {
    enforce_extra: 'remove',
    enforce_type: 'strict',
  });
  UserBlock.ensureIndex('userId');
  UserBlock.ensureIndex('blockedId');
  UserBlock.ensureIndex('userId_blockedId', doc => [doc('userId'), doc('blockedId')]);
  return UserBlock;
};
