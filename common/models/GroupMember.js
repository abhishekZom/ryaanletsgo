/*
 * Copyright (C) 2017 lets., All Rights Reserved.
 */

'use strict';

/**
 * Activity invitee resource.
 * An activity can have multiple invitees. There is one-to-many relationship from activity to invitees
 * Invitees are those users that author explicitly invite to join the activity
 *
 * @author      TSCCODER
 * @version     1.0.0
 */

/**
 * Default module export function
 * @param  {Object}       thinky            the instantiated thinky ORM instance
 * @return {Objetc}                         the GroupMember model
 */
module.exports = function schemaFn(thinky) {
  const type = thinky.type;
  const GroupMember = thinky.createModel('group_members', {
    // primary key, the primary key is set by the database so it is not required,
    // but when retrieving document thinky will match the returned
    // fields with schema and discard any extra fields
    id: type.string().uuid(4),
    groupId: type.string().uuid(4).required(),
    memberId: type.string().uuid(4).required(),
    role: type.number().integer().min(0).default(0)
      .required(),
    createdAt: type.number().integer().min(0).required(),
    // the timestamp this resource was last updated
    updatedAt: type.number().integer().min(0).required(),
  }, {
    enforce_extra: 'remove',
    enforce_type: 'strict',
  });
  GroupMember.ensureIndex('createdAt');
  GroupMember.ensureIndex('updatedAt');
  GroupMember.ensureIndex('groupId');
  GroupMember.ensureIndex('memberId');
  GroupMember.ensureIndex('groupId_memberId', doc => [doc('groupId'), doc('memberId')]);
  return GroupMember;
};
