/*
 * Copyright (C) 2017 lets., All Rights Reserved.
 */

'use strict';

/**
 * User social connection resource.
 * A user has certain associated social accounts.
 *
 * @author      TSCCODER
 * @version     1.0.0
 */
const _ = require('lodash');
const SOCIAL_CONNECTION_TYPES = require('../constants').SOCIAL_CONNECTION_TYPES;

/**
 * Default module export function
 * @param  {Object}       thinky            the instantiated thinky ORM instance
 * @return {Objetc}                         the UserSocialConnection model
 */
module.exports = function schemaFn(thinky) {
  const ttype = thinky.type;
  const UserSocialConnection = thinky.createModel('users_social_connection', {
    // primary key, the primary key is set by the database so it is not required,
    // but when retrieving document thinky will match the returned
    // fields with schema and discard any extra fields
    id: ttype.string().uuid(4),
    // the social connection access token
    accessToken: ttype.string().required(),
    // the social connection refresh token if any
    refreshToken: ttype.string().allowNull(true),
    // the user social connection id
    socialId: ttype.string().required(),
    // the user social connection id as returned by social api's
    profile: ttype.object().allowNull(true).allowExtra(true),
    // the type of social connection
    type: ttype.string().enum(_.values(SOCIAL_CONNECTION_TYPES)).required(),
    userId: ttype.string().uuid(4).required(),
    // the timestamp this resource is created
    createdAt: ttype.number().integer().required(),
    // the timestamp this resource was last updated
    updatedAt: ttype.number().integer().required(),
  }, {
    enforce_extra: 'remove',
    enforce_type: 'strict',
  });
  UserSocialConnection.ensureIndex('userId');
  UserSocialConnection.ensureIndex('type');
  UserSocialConnection.ensureIndex('userId_type', doc => [doc('userId'), doc('type')]);
  UserSocialConnection.ensureIndex('socialId_type', doc => [doc('socialId'), doc('type')]);
  return UserSocialConnection;
};
