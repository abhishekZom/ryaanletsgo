/*
 * Copyright (C) 2017 lets., All Rights Reserved.
 */

'use strict';

/**
 * User resource.
 * A user is the most abstract representation of a human interacting with the app.
 *
 * @author      TSCCODER
 * @version     1.0.0
 */

/**
 * Default module export function
 * @param  {Object}       thinky            the instantiated thinky ORM instance
 * @return {Objetc}                         the User model
 */
module.exports = function schemaFn(thinky) {
  const type = thinky.type;
  const User = thinky.createModel('users', {
    // primary key, the primary key is set by the database so it is not required,
    // but when retrieving document thinky will match the returned
    // fields with schema and discard any extra fields
    id: type.string().uuid(4),
    fullName: type.string().required(),
    username: type.string().required(),
    email: type.string().email().required(),
    password: type.string().required(),
    firstName: type.string().alphanum().allowNull(true),
    lastName: type.string().alphanum().allowNull(true),
    bio: type.string().allowNull(true),
    // if user didn't upload a pic, than this is the default photo url
    photo: type.object().allowNull(true).allowExtra(true),
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
  // ensure indexes
  User.ensureIndex('username');
  User.ensureIndex('email');
  return User;
};
