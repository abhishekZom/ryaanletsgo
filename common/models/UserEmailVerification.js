/*
 * Copyright (C) 2017 lets., All Rights Reserved.
 */

'use strict';

/**
 * User email verification resource.
 * Whenever a new user signed up, the user has to verify the email address associated with the account.
 *
 * @author      TSCCODER
 * @version     1.0.0
 */

/**
 * Default module export function
 * @param  {Object}       thinky            the instantiated thinky ORM instance
 * @return {Objetc}                         the UserEmailVerification model
 */
module.exports = function schemaFn(thinky) {
  const type = thinky.type;
  const UserEmailVerification = thinky.createModel('users_email_verification', {
    // primary key, the primary key is set by the database so it is not required,
    // but when retrieving document thinky will match the returned
    // fields with schema and discard any extra fields
    id: type.string().uuid(4),
    userId: type.string().uuid(4).required(),
    email: type.string().email().required(),
    // the unique verification token
    token: type.string().required(),
    // unix timestamp at which this token expires
    expires: type.number().integer().min(0).required(),
    // the timestamp this resource is created
    createdAt: type.number().integer().required(),
    // the timestamp this resource was last updated
    updatedAt: type.number().integer().required(),
  }, {
    enforce_extra: 'remove',
    enforce_type: 'strict',
  });
  UserEmailVerification.ensureIndex('userId');
  return UserEmailVerification;
};
