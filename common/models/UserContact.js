/*
 * Copyright (C) 2017 lets., All Rights Reserved.
 */

'use strict';

/**
 * User contact resource.
 * A user can have followers/followings which are app users
 * A user can also have external non app contacts.
 *
 * @author      TSCCODER
 * @version     1.0.0
 */
const _ = require('lodash');
const CONTACT_TYPES = require('../constants').CONTACT_TYPES;

/**
 * Default module export function
 * @param  {Object}       thinky            the instantiated thinky ORM instance
 * @return {Objetc}                         the UserContact model
 */
module.exports = function schemaFn(thinky) {
  const ttype = thinky.type;
  const UserContact = thinky.createModel('user_contacts', {
    // primary key, the primary key is set by the database so it is not required,
    // but when retrieving document thinky will match the returned
    // fields with schema and discard any extra fields
    id: ttype.string().uuid(4),
    userId: ttype.string().uuid(4).required(),
    phoneNumber: ttype.string().allowNull(true),
    email: ttype.string().allowNull(true),
    type: ttype.string().enum(_.values(CONTACT_TYPES)).required(),
    facebookId: ttype.string().allowNull(true),
    googleId: ttype.string().allowNull(true),
    metadata: ttype.object().allowNull(true).allowExtra(true),
    // the timestamp this resource is created
    createdAt: ttype.number().integer().required(),
    // the timestamp this resource was last updated
    updatedAt: ttype.number().integer().required(),
  }, {
    enforce_extra: 'remove',
    enforce_type: 'strict',
  });
  UserContact.ensureIndex('userId');
  UserContact.ensureIndex('phoneNumber');
  UserContact.ensureIndex('email');
  UserContact.ensureIndex('type');
  UserContact.ensureIndex('facebookId');
  UserContact.ensureIndex('googleId');
  UserContact.ensureIndex('userId_type', doc => [doc('userId'), doc('type')]);
  UserContact.ensureIndex('userId_type_facebookId', doc => [doc('userId'), doc('type'), doc('facebookId')]);
  UserContact.ensureIndex('userId_type_googleId', doc => [doc('userId'), doc('type'), doc('googleId')]);
  UserContact.ensureIndex('userId_type_phoneNumber', doc => [doc('userId'), doc('type'), doc('phoneNumber')]);
  UserContact.ensureIndex('userId_type_email', doc => [doc('userId'), doc('type'), doc('email')]);
  return UserContact;
};
