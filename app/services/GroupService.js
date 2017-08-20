/*
 * Copyright (C) 2017 lets., All Rights Reserved.
 */

'use strict';

/**
 * Comments resource service contract
 * Some of the modules this service depends on will be resolved at deployment time.
 *
 * @author      TSCCODER
 * @version     1.0.0
 */

const errors = require('common-errors');
const config = require('config');
const joi = require('joi');
const _ = require('lodash');

const logger = require('../common/Logger');
const ErrorCodes = require('../ErrorCodes');
const helper = require('../common/Helper');

const models = require('../models').getDatasource({       // eslint-disable-line import/no-unresolved
  db: _.extend(config.db, { max: 10 }),
  logger,
});

const thinky = models.thinky;
const r = models.r;
const Group = models.Group;
const GroupMember = models.GroupMember;
const User = models.User;

/**
 * Validate that the group exists with the specified id
 * @private
 *
 * @param   {String}    groupId       the id of group
 *
 * @return  {Object}                  The group document
 * @throws  {NotFoundError}           If group not found with specified id
 */
function* validateGroupExists(groupId) {
  const existing = yield helper.fetch(Group, groupId, thinky);
  if (!existing) {
    throw new errors.NotFoundError('group not found with specified id',
      new Error(ErrorCodes.RESOURCE_NOT_FOUND));
  }
  return existing;
}

/**
 * Validate that the group exists and owner of group is accessing the group
 * @private
 *
 * @param   {Object}    auth          currently logged in user auth context
 * @param   {String}    groupId       the id of group
 *
 * @return  {Object}                  The group document
 * @throws  {NotFoundError}           If group not found with specified id
 * @throws  {NotPermittedError}       If user is not the owner of group
 */
function* validateOwnerAccess(auth, groupId) {
  const existing = yield validateGroupExists(groupId);
  if (existing.owner !== auth.userId) {
    throw new errors.NotPermittedError('only owner of group can access',
        new Error(ErrorCodes.OPERATION_NOT_PERMITTED));
  }
  return existing;
}

/**
 * Get basic group details, this method will only resolve owner reference
 * @private
 *
 * @param   {Object}    group         The group document for which to modify the members list
 * @param   {Object}    members       the members list to add/remove
 * @return  {Object}                  the group details
 */
function* getBasicGroupDetail(group) {
  const plain = helper.getRawObject(group, 'owner');
  const owner = yield User.get(group.owner);
  return _.extend(plain, { owner });
}

/**
 * Add a single member to the group
 * @private
 *
 * @param   {Object}    group         The group document for which to modify the members list
 * @param   {String}    memberId      the member id to add to group
 * @return  {Promise}                 the promise which is resolved after operation completes
 */
function* addSingleMember(group, memberId) {
  // if the member is group owner than this user is already added. skip
  if (group.owner !== memberId) {
    const member = yield r.table(GroupMember.getTableName())
      .getAll([group.id, memberId], { index: 'groupId_memberId' })
      .nth(0).default(null)
      .run();

    if (!member) {
      yield GroupMember.save({ groupId: group.id, memberId });
    }
  }
}

/**
 * Remove a single member from the group
 * @private
 *
 * @param   {Object}    group         The group document for which to modify the members list
 * @param   {String}    memberId      the member id to add to group
 * @return  {Promise}                 the promise which is resolved after operation completes
 */
function* removeSingleMember(group, memberId) {
  // if the member is group owner than this user cannot be removed from the group. Skip.
  if (group.owner !== memberId) {
    yield r.table(GroupMember.getTableName())
      .getAll([group.id, memberId], { index: 'groupId_memberId' }).delete().run();
  }
}

/**
 * Modify the members list for group
 * @private
 *
 * @param   {Object}    group         The group document for which to modify the members list
 * @param   {Object}    members       the members list to add/remove
 * @return  {Void}                    This function doesn't return anything
 */
function* modifyMembers(group, members) {
  if (_.has(members, 'additions.users')) {
    const apromises = members.additions.users.map(user => helper.executeWrapped(addSingleMember, group, user));
    yield Promise.all(apromises);
  }
  if (_.has(members, 'removals.users')) {
    const rpromises = members.removals.users.map(user => helper.executeWrapped(removeSingleMember, group, user));
    yield Promise.all(rpromises);
  }
}

/**
 * Create a group
 * Create a group, optionally specify initial list of group members
 *
 * @param   {Object}    auth          currently logged in user auth context
 * @param   {Object}    entity        the request payload
 * @return  {Object}                  the details of newly created Group resource
 */
function* createGroup(auth, entity) {
  const doc = _.pick(entity, 'title', 'description');
  const group = yield Group.save(_.extend(doc, { owner: auth.userId }));
  try {
    yield modifyMembers(group, entity.members);
  } catch (ignore) {
    logger.error('failed to add group members rollback', ignore);
    yield r.table(GroupMember.getTableName()).getAll(group.id, { index: 'groupId' }).delete().run();
    yield group.delete();
    throw ignore;
  }

  const transformed = yield getBasicGroupDetail(group);
  return helper.decorateWithSignedUrl(transformed, ['photo', 'photos']);
}

// joi validation schema for addComment
createGroup.schema = {
  auth: joi.object().keys({
    userId: joi.string().required(),
    accessToken: joi.string(),
  }).required(),
  entity: joi.object().keys({
    title: joi.string().required(),
    description: joi.string(),
    members: joi.object().keys({
      additions: joi.object().keys({
        users: joi.array().items(joi.string().required()).min(1).required(),
      }),
      removals: joi.object().keys({
        users: joi.array().items(joi.string().required()).min(1).required(),
      }),
    }).or('additions', 'removals'),
  }).required(),
};

/**
 * Edit a group details
 * Edit a group details, can optionally specify group members to add/remove
 *
 * @param   {Object}    auth          currently logged in user auth context
 * @param   {String}    groupId       the id of group
 * @param   {Object}    entity        the request payload
 * @return  {Object}                  the details of updated Group resource
 */
function* editGroup(auth, groupId, entity) {
  const existing = yield validateOwnerAccess(auth, groupId);
  const doc = _.pick(entity, 'title', 'description');
  yield existing.merge(doc).save();
  try {
    yield modifyMembers(existing, entity.members);
  } catch (ignore) {
    logger.error('failed to edit group members rollback', ignore);
    const oldValue = existing.getOldValue();
    yield existing.merge(oldValue).save();
    throw ignore;
  }
  const group = yield getBasicGroupDetail(existing);
  return helper.decorateWithSignedUrl(group, ['photo', 'photos']);
}

// joi validation schema for editGroup
editGroup.schema = {
  auth: joi.object().keys({
    userId: joi.string().required(),
    accessToken: joi.string(),
  }).required(),
  groupId: joi.string().required(),
  entity: joi.object().keys({
    title: joi.string(),
    description: joi.string(),
    members: joi.object().keys({
      additions: joi.object().keys({
        users: joi.array().items(joi.string().required()).min(1).required(),
      }),
      removals: joi.object().keys({
        users: joi.array().items(joi.string().required()).min(1).required(),
      }),
    }).or('additions', 'removals'),
  }).or('title', 'description', 'members').required(),
};

/**
 * Get a group details
 * Get a group details, the response payload will have resolved references to group members
 *
 * @param   {Object}    auth          currently logged in user auth context
 * @param   {String}    groupId       the id of group
 * @return  {Object}                  The Group details
 */
function* getGroupDetail(auth, groupId) {
  const existing = yield validateGroupExists(groupId);

  const detail = yield r.table(Group.getTableName())
    .get(existing.id)
    .do((gitem) => {
      const members = r.table(GroupMember.getTableName())
        .getAll(existing.id, { index: 'groupId' })
        .orderBy(r.desc('updatedAt'))
        .eqJoin('memberId', r.table(User.getTableName()), { ordered: true })
        .map(mitem => mitem('right').without('password'));

      return gitem.merge({ members });
    })
    .run();
  return helper.decorateWithSignedUrl(detail, ['photo', 'photos']);
}

// joi validation schema for getGroupDetail
getGroupDetail.schema = {
  auth: joi.object().keys({
    userId: joi.string().required(),
    accessToken: joi.string(),
  }).required(),
  groupId: joi.string().required(),
};

/**
 * Delete a group
 * Delete a group, and all of it's members
 *
 * @param   {Object}    auth          currently logged in user auth context
 * @param   {String}    groupId       the id of group
 * @return  {Object}                  The Group details
 */
function* deleteGroup(auth, groupId) {
  const existing = yield validateOwnerAccess(auth, groupId);
  yield existing.delete();
  yield r.table(GroupMember.getTableName())
    .getAll(groupId, { index: 'groupId' }).delete().run();
}

// joi validation schema for deleteGroup
deleteGroup.schema = {
  auth: joi.object().keys({
    userId: joi.string().required(),
    accessToken: joi.string(),
  }).required(),
  groupId: joi.string().required(),
};

module.exports = {
  createGroup,
  getGroupDetail,
  editGroup,
  deleteGroup,
};
