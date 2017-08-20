/*
 * Copyright (C) 2017 lets., All Rights Reserved.
 */

'use strict';

/**
 * AccessToken resource.
 * An access token is the bearer token assigned to user for making secured api calls.
 * The access token is deleted when user logs out of the app.
 *
 * @author      TSCCODER
 * @version     1.0.0
 */

/**
 * Default module export function
 * @param  {Object}       thinky            the instantiated thinky ORM instance
 * @return {Objetc}                         the AccessToken model
 */
module.exports = function schemaFn(thinky) {
  const type = thinky.type;
  const AccessToken = thinky.createModel('access_tokens', {
    // primary key, the primary key is set by the database so it is not required,
    // but when retrieving document thinky will match the returned
    // fields with schema and discard any extra fields
    id: type.string().uuid(4),
    token: type.string().required(),
    // a user has many access tokens, but one access token can belong to one user only
    userId: type.string().uuid(4).required(),
    // the timestamp this resource is created
    createdAt: type.number().integer().required(),
    // the timestamp this resource was last updated
    updatedAt: type.number().integer().required(),
  }, {
    enforce_extra: 'remove',
    enforce_type: 'strict',
  });
  AccessToken.ensureIndex('userId');
  AccessToken.ensureIndex('token');
  AccessToken.ensureIndex('userId_token', doc => [doc('userId'), doc('token')]);
  return AccessToken;
};
