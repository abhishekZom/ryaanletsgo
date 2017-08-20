/*
 * Copyright (C) 2017 lets., All Rights Reserved.
 */

'use strict';

/**
 * User phone number resource.
 * A user can have multiple phone numbers and each of the phone number can be assigned to a single user.
 *
 * @author      TSCCODER
 * @version     1.0.0
 */
const _ = require('lodash');
const DEVICE_TYPES = require('../constants').DEVICE_TYPES;

/**
 * Default module export function
 * @param  {Object}       thinky            the instantiated thinky ORM instance
 * @return {Objetc}                         the UserPhoneNumber model
 */
module.exports = function schemaFn(thinky) {
  const type = thinky.type;
  const UserPhoneNumber = thinky.createModel('users_phone_numbers', {
    // primary key, the primary key is set by the database so it is not required,
    // but when retrieving document thinky will match the returned
    // fields with schema and discard any extra fields
    id: type.string().uuid(4),
    userId: type.string().uuid(4).required(),
    countryCode: type.string().required(),
    phoneNumber: type.string().required(),
    // the unique device hardware id
    deviceId: type.string().required(),
    // the unique device token for this device used to send notifications
    deviceToken: type.string().allowNull(true),
    deviceType: type.string().enum(_.values(DEVICE_TYPES)).required(),
    // indicates that this number is primary phone number
    primary: type.number().integer().min(0).max(1)
      .default(0)
      .required(),
    status: type.number().integer().min(0).max(1)
      .default(0)
      .required(),
    // the timestamp this resource is created
    createdAt: type.number().integer().required(),
    // the timestamp this resource was last updated
    updatedAt: type.number().integer().required(),
  }, {
    enforce_extra: 'remove',
    enforce_type: 'strict',
  });
  UserPhoneNumber.ensureIndex('userId');
  UserPhoneNumber.ensureIndex('phoneNumber');
  UserPhoneNumber.ensureIndex('countryCode_phoneNumber', doc => [doc('countryCode'), doc('phoneNumber')]);
  UserPhoneNumber.ensureIndex('number', doc => `${doc('countryCode')}${doc('phoneNumber')}`);
  return UserPhoneNumber;
};
