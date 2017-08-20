/*
 * Copyright (C) 2017 lets., All Rights Reserved.
 */

'use strict';

/**
 * User phone number verification resource.
 * A user can have multiple phone numbers and each of the phone number can be assigned to only a single user.
 * This resource keeps track of verification codes send to a user's phone number
 *
 * @author      TSCCODER
 * @version     1.0.0
 */

/**
 * Default module export function
 * @param  {Object}       thinky            the instantiated thinky ORM instance
 * @return {Objetc}                         the UserPhoneNumberVerification model
 */
module.exports = function schemaFn(thinky) {
  const type = thinky.type;
  const UserPhoneNumberVerification = thinky.createModel('users_phone_number_verification', {
    // primary key, the primary key is set by the database so it is not required,
    // but when retrieving document thinky will match the returned
    // fields with schema and discard any extra fields
    id: type.string().uuid(4),
    // the reference id of the associated phone number table record
    referenceId: type.string().required(),
    code: type.string().required(),
    // the timestamp this resource is created
    createdAt: type.number().integer().required(),
    // the timestamp this resource was last updated
    updatedAt: type.number().integer().required(),
  }, {
    enforce_extra: 'remove',
    enforce_type: 'strict',
  });
  UserPhoneNumberVerification.ensureIndex('userId');
  return UserPhoneNumberVerification;
};
