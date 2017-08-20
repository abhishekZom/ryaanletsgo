/*
 * Copyright (C) 2017 lets., All Rights Reserved.
 */

'use strict';

/**
 * Group resource.
 * Users can form groups and invite/add app users or non app users to the group
 *
 * @author      TSCCODER
 * @version     1.0.0
 */

/**
 * Default module export function
 * @param  {Object}       thinky            the instantiated thinky ORM instance
 * @return {Objetc}                         the Group model
 */
module.exports = function schemaFn(thinky) {
  const type = thinky.type;
  const Group = thinky.createModel('groups', {
    // primary key, the primary key is set by the database so it is not required,
    // but when retrieving document thinky will match the returned
    // fields with schema and discard any extra fields
    id: type.string().uuid(4),
    title: type.string().required(),
    // optional group description
    description: type.string().allowNull(true),
    // the owner of the group
    owner: type.string().uuid(4).required(),
    // the timestamp this resource is created
    createdAt: type.number().integer().min(0).required(),
    // the timestamp this resource was last updated
    updatedAt: type.number().integer().min(0).required(),
  }, {
    enforce_extra: 'remove',
    enforce_type: 'strict',
  });
  Group.ensureIndex('createdAt');
  Group.ensureIndex('updatedAt');
  Group.ensureIndex('title');
  Group.ensureIndex('owner');
  return Group;
};
