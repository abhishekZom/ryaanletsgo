/*
 * Copyright (C) 2017 lets., All Rights Reserved.
 */

'use strict';

/**
 * User reset password resource.
 * Whenever a user requests forgot password link a unique token is emailed to user which allows user to set
 * a new password.
 * This resource stores the user password history. This can be used to enforce strict password validations.
 *
 * @author      TSCCODER
 * @version     1.0.0
 */

/**
 * Default module export function
 * @param  {Object}       thinky            the instantiated thinky ORM instance
 * @return {Objetc}                         the UserResetPassword model
 */
module.exports = function schemaFn(thinky) {
  const type = thinky.type;
  const UserResetPassword = thinky.createModel('users_reset_password', {
    // primary key, the primary key is set by the database so it is not required,
    // but when retrieving document thinky will match the returned
    // fields with schema and discard any extra fields
    id: type.string().uuid(4),
    userId: type.string().uuid(4).required(),
    email: type.string().email().required(),
    // the unique verification token
    token: type.string().allowNull(true),
    // unix timestamp at which this token expires
    expires: type.number().integer().min(0).allowNull(true),
    // the hashed password at the time this password recovery is requested
    password: type.string().required(),
    // the timestamp this resource is created
    createdAt: type.number().integer().required(),
    // the timestamp this resource was last updated
    updatedAt: type.number().integer().required(),
  }, {
    enforce_extra: 'remove',
    enforce_type: 'strict',
  });
  UserResetPassword.ensureIndex('userId');
  return UserResetPassword;
};
