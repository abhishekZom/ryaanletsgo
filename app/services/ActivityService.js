/*
 * Copyright (C) 2017 lets., All Rights Reserved.
 */

'use strict';

/**
 * Activity resource service contract
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

const constants = require('../constants');          // eslint-disable-line import/no-unresolved
const RabbitMQService = require('./RabbitMQService');

const ACTIVITY_PRIVACY = constants.ACTIVITY_PRIVACY;
const USER_TYPES = constants.USER_TYPES;
const USER_ACTIONS_VERBS = constants.USER_ACTIONS_VERBS;

const r = models.r;
const thinky = models.thinky;
const Activity = models.Activity;
const ActivityInvitee = models.ActivityInvitee;
const ActivityRsvp = models.ActivityRsvp;
const ActivityLike = models.ActivityLike;
const ActivityPhoto = models.ActivityPhoto;

const Comment = models.Comment;
const CommentLike = models.CommentLike;

const User = models.User;
const UserContact = models.UserContact;
const UserSetting = models.UserSetting;
const UserFollower = models.UserFollower;

// initiates a new rabbitmq service
const rabbitmqService = new RabbitMQService({ url: config.rabbitmq.url, logger });

/**
 * Validate that the activity exists with the specified id
 * @private
 *
 * @param   {String}    activityId    the id of activity
 *
 * @return  {Object}                  The activity document
 * @throws  {NotFoundError}           If activity not found with specified id
 */
function* validateActivityExists(activityId) {
  const existing = yield helper.fetch(Activity, activityId, thinky);
  if (!existing) {
    throw new errors.NotFoundError('activity not found with specified id',
      new Error(ErrorCodes.RESOURCE_NOT_FOUND));
  }
  return existing;
}

/**
 * Validate that the activity exists with the specified id and author of the activity is authorId
 * @private
 *
 * @param   {String}    activityId    the id of activity
 * @param   {String}    authorId      the id of author of activity
 *
 * @return  {Object}                  The activity document
 * @throws  {NotFoundError}           If activity not found with specified id
 * @throws  {NotPermittedError}       If illegal access
 */
function* validateAuthorAccess(activityId, authorId) {
  const existing = yield validateActivityExists(activityId);
  if (existing.author !== authorId) {
    throw new errors.NotPermittedError('user can only perform operation for self authored activities',
      new Error(ErrorCodes.OPERATION_NOT_PERMITTED));
  }
  return existing;
}

/**
 * Internal helper method to get activitiy photos
 * @private
 *
 * @param   {String}    activityId      the activity id
 * @param   {Number}    limit           the number of photos to return
 * @param   {Number}    offset          the number of photos to skip
 * @return  {Array}                     The photos
 */
function* doGetPhotos(activityId, limit, offset) {
  const docs = yield r.table(ActivityPhoto.getTableName())
    .getAll(activityId, { index: 'activityId' })
    .orderBy(r.desc('createdAt'))
    .skip(offset)
    .limit(limit)
    .run();

  return docs;
}

/**
 * Internal helper method to get activitiy details
 * @private
 *
 * @param   {Object}    auth            currently logged in user auth context
 * @param   {String}    activityId      the activity id
 * @return  {Object}                    The activity details object
 */
function* doGetActivityDetail(auth, activityId) {
  return yield r.table(Activity.getTableName())
    .get(activityId)
    .do((item) => {
      const likes = r.table(ActivityLike.getTableName())
        .getAll(item('id'), { index: 'activityId' })
        .orderBy(r.desc('updatedAt'))
        .limit(config.aggregation.ACTIVITY_LATEST_LIKES)
        .eqJoin('userId', r.table(User.getTableName()))
        .map(single => single('right').without('password'));

      const lcount = r.table(ActivityLike.getTableName())
        .getAll(item('id'), { index: 'activityId' }).count();

      const rsvp = r.table(ActivityRsvp.getTableName())
        .getAll(item('id'), { index: 'activityId' })
        .orderBy(r.desc('updatedAt'))
        .limit(config.aggregation.ACTIVITY_LATEST_RSVP)
        .eqJoin('userId', r.table(User.getTableName()))
        .map(single => single('right').without('password'));

      const rcount = r.table(ActivityRsvp.getTableName())
        .getAll(item('id'), { index: 'activityId' }).count();

      const comments = r.table(Comment.getTableName())
        .getAll(item('id'), { index: 'activityId' })
        .filter(citem => citem.hasFields('parent').not())
        .orderBy(r.desc('updatedAt'))
        .limit(config.aggregation.ACTIVITY_LATEST_COMMENTS)
        .eqJoin('author', r.table(User.getTableName()))
        .map(single =>
          single('left').merge({
            author: single('right'),
            currentUserLike: r.table(CommentLike.getTableName())
              .getAll([single('left')('id'), auth.userId], { index: 'commentId_userId' }).nth(0).default(null),
          }));

      const ccount = r.table(Comment.getTableName())
        .getAll(item('id'), { index: 'activityId' })
        .filter(citem => citem.hasFields('parent').not())
        .count();

      const currentUserLike = r.table(ActivityLike.getTableName())
        .getAll([item('id'), auth.userId], { index: 'activityId_userId' })
        .nth(0)
        .default(null);

      const currentUserRsvp = r.table(ActivityRsvp.getTableName())
        .getAll([item('id'), auth.userId], { index: 'activityId_userId' })
        .nth(0)
        .default(null);

      const photos = r.table(ActivityPhoto.getTableName())
        .getAll(item('id'), { index: 'activityId' })
        .orderBy(r.desc('updatedAt'))
        .limit(config.aggregation.ACTIVITY_LATEST_PHOTOS)
        .coerceTo('array');

      const pcount = r.table(ActivityPhoto.getTableName())
        .getAll(item('id'), { index: 'activityId' }).count();

      return item.merge({
        rsvp: { items: rsvp, total: rcount },
        likes: { items: likes, total: lcount },
        photos: { items: photos, total: pcount },
        comments: { items: comments, total: ccount },
        author: r.table(User.getTableName()).get(item('author')).without('password'),
        parent: r.branch(item.hasFields('parent'),
          r.table(Activity.getTableName()).get(item('parent'))
            .do((pitem) => {
              const prsvp = r.table(ActivityRsvp.getTableName())
                .getAll(pitem('id'), { index: 'activityId' })
                .orderBy(r.desc('updatedAt'))
                .limit(config.aggregation.ACTIVITY_LATEST_RSVP)
                .eqJoin('userId', r.table(User.getTableName()))
                .map(psingle => psingle('right').without('password'));

              const pcurrentUserRsvp = r.table(ActivityRsvp.getTableName())
                .getAll([pitem('id'), auth.userId], { index: 'activityId_userId' })
                .nth(0)
                .default(null);

              const pcurrentUserLike = r.table(ActivityLike.getTableName())
                .getAll([pitem('id'), auth.userId], { index: 'activityId_userId' })
                .nth(0)
                .default(null);

              const prcount = r.table(ActivityRsvp.getTableName())
                .getAll(pitem('id'), { index: 'activityId' }).count();

              return pitem.merge({
                rsvp: { items: prsvp, total: prcount },
                currentUserRsvp: pcurrentUserRsvp,
                currentUserLike: pcurrentUserLike,
                author: r.table(User.getTableName()).get(pitem('author')).without('password'),
              });
            }), null),
        currentUserRsvp,
        currentUserLike,
      });
    })
    .run();
}

/**
 * Transform the thinky Document instance into raw javascript object
 * For activity the photos array will have signed url to access the secured images
 * @private
 *
 * @param   {Object}    auth          currently logged in user auth context
 * @param   {Object}    activity      the activity document to transform
 * @return  {Object}                  The raw javascript object
 */
function* getRawActivity(auth, activity) {
  const details = yield doGetActivityDetail(auth, activity.id);
  const plain = _.omitBy(details, _.isNil);
  return helper.decorateWithSignedUrl(plain, ['photo', 'photos']);
}

/**
 * Add a single invitee to the list if not already added.
 * @private
 *
 * @param   {String}    activityId    the activity id
 * @param   {String}    inviteeId     the invitee id
 * @param   {String}    type          the type of invitee
 * @return  {Void}                    This function does not return anything
 */
function* addSingleInvitee(activityId, inviteeId, type) {
  const invitee = yield r.table(ActivityInvitee.getTableName())
    .getAll([activityId, inviteeId], { index: 'activityId_inviteeId' })
    .nth(0).default(null)
    .run();

  if (!invitee) {
    yield ActivityInvitee.save({ activityId, inviteeId, type });
  }
}

/**
 * Remove a single invitee from the list if added.
 * @private
 *
 * @param   {String}    activityId    the activity id
 * @param   {String}    inviteeId     the invitee id
 * @return  {Void}                    This function does not return anything
 */
function* removeSingleInvitee(activityId, inviteeId) {
  yield r.table(ActivityInvitee.getTableName())
    .getAll([activityId, inviteeId], { index: 'activityId_inviteeId' }).delete().run();
}

/**
 * Modify the activity invitees list
 * @private
 *
 * @param   {Object}    activity      the activity document for which to modify the invitees
 * @param   {Object}    additions     the list of invitees to add
 * @param   {Object}    removals      the list of invitees to remove
 * @return  {Void}                    This function does not return anything
 */
function* modifyInvitees(activity, additions, removals) {
  const promises = [];
  if (_.isObject(additions) && _.isArray(additions.users)) {
    const aupromises = additions.users.map(single => helper.executeWrapped(addSingleInvitee,
      activity.id, single, USER_TYPES.APP_USER));
    promises.push(Promise.all(aupromises));
  }

  if (_.isObject(additions) && _.isArray(additions.contacts)) {
    const acpromises = additions.contacts.map(single => helper.executeWrapped(addSingleInvitee,
      activity.id, single, USER_TYPES.NON_APP_USER));
    promises.push(Promise.all(acpromises));
  }

  if (_.isObject(removals) && _.isArray(removals.users)) {
    const rupromises = removals.users.map(single => helper.executeWrapped(removeSingleInvitee, activity.id, single));
    promises.push(Promise.all(rupromises));
  }

  if (_.isObject(removals) && _.isArray(removals.contacts)) {
    const rcpromises = removals.contacts.map(single => helper.executeWrapped(removeSingleInvitee, activity.id, single));
    promises.push(Promise.all(rcpromises));
  }

  yield Promise.all(promises);
}

/**
 * Create an activity, the currently logged in user is the author of activity
 *
 * @param   {Object}    auth          currently logged in user auth context
 * @param   {Object}    entity        the request payload
 * @return  {Object}                  The newly created activity resource
 */
function* createActivity(auth, entity) {
  const doc = _.pick(entity, 'title', 'start', 'duration', 'location', 'meetingPoint', 'notes', 'privacy');

  // get the user default activity duration setting
  const settings = yield UserSetting.filter({ userId: auth.userId });
  if (!settings || settings.length !== 1) {
    // race condition should never happen
    throw new errors.data.DataError('corrupt user settings state',
      new Error(ErrorCodes.CORRUPT_USER_SETTINGS_STATE));
  }

  // resolve author
  doc.author = auth.userId;

  // if duration is not specified use default activity duration
  if (!_.has(entity, 'duration')) {
    doc.duration = settings[0].defaultActivityDuration;
  }
  const activity = yield Activity.save(doc);

  // add activity invitees if present
  try {
    if (_.has(entity, 'invitees')) {
      yield modifyInvitees(activity, { users: entity.invitees.users, contacts: entity.invitees.contacts });
    }
    if (_.isArray(activity.photos)) {
      const records = activity.photos.map(single => ({ activityId: activity.id, photo: single }));
      yield ActivityPhoto.save(records);
    }
    yield ActivityRsvp.save({ activityId: activity.id, userId: activity.author });
  } catch (ignore) {
    logger.error('failed to save invitees list rollback', helper.stringify(ignore));
    yield activity.delete();
    throw ignore;
  }

  yield rabbitmqService.publish(config.ROUTING_KEYS.ACTIVITY_CREATED.key, {
    auth,
    activityId: activity.id,
    action: USER_ACTIONS_VERBS.post,
  });

  return yield getRawActivity(auth, activity);
}

// joi validation schema for createActivity
createActivity.schema = {
  auth: joi.object().keys({
    userId: joi.string().required(),
    accessToken: joi.string(),
  }).required(),
  entity: joi.object().keys({
    title: joi.string().required(),
    start: joi.number().integer().positive().required(),
    duration: joi.number().integer().positive(),
    location: joi.string(),
    meetingPoint: joi.string(),
    notes: joi.string(),
    privacy: joi.string().valid(_.values(ACTIVITY_PRIVACY)).required(),
    invitees: joi.object().keys({
      users: joi.array().items(joi.string().guid({ version: 'uuidv4' }).required()).min(1),
      contacts: joi.array().items(joi.string().guid({ version: 'uuidv4' }).required()).min(1),
    }).or('users', 'contacts'),
  }).required(),
};

/**
 * Get an activity detail
 *
 * @param   {Object}    auth          currently logged in user auth context
 * @param   {String}    activityId    the id of activity
 * @return  {Void}                    this method doesn't return anything
 */
function* getActivityDetail(auth, activityId) {
  const existing = yield validateActivityExists(activityId);

  const activity = yield doGetActivityDetail(auth, existing.id);

  return helper.decorateWithSignedUrl(activity, ['photo', 'photos']);
}

// joi validation schema for getActivityDetail
getActivityDetail.schema = {
  auth: joi.object().keys({
    userId: joi.string().required(),
    accessToken: joi.string(),
  }).required(),
  activityId: joi.string().required(),
};

/**
 * Delete an activity.
 * User can only delete self authored activities
 *
 * @param   {Object}    auth          currently logged in user auth context
 * @param   {String}    activityId    the id of activity
 * @return  {Void}                    this method doesn't return anything
 */
function* deleteActivity(auth, activityId) {
  const existing = yield validateAuthorAccess(activityId, auth.userId);

  yield existing.delete();

  yield rabbitmqService.publish(config.ROUTING_KEYS.ACTIVITY_DELETED.key, {
    auth,
    activityId: existing.id,
    action: USER_ACTIONS_VERBS.delete,
  });
}

// joi validation schema for deleteActivity
deleteActivity.schema = {
  auth: joi.object().keys({
    userId: joi.string().required(),
    accessToken: joi.string(),
  }).required(),
  activityId: joi.string().required(),
};

/**
 * Edit an activity details.
 * User can only edit self authored activities details
 *
 * @param   {Object}    auth          currently logged in user auth context
 * @param   {String}    activityId    the id of activity
 * @param   {Object}    entity        the optional request payload
 * @return  {Object}                  The updated activity details
 */
function* updateActivity(auth, activityId, entity) {
  const existing = yield validateAuthorAccess(activityId, auth.userId);

  const activity = yield existing.merge(entity).save();

  try {
    if (_.has(entity, 'invitees')) {
      yield modifyInvitees(activity, entity.invitees.additions, entity.invitees.removals);
    }
  } catch (ignore) {
    logger.error('failed to modify invitees list rollback', helper.stringify(ignore));
    const oldValue = activity.getOldValue();
    yield activity.merge(oldValue).save();
    throw ignore;
  }

  return yield getRawActivity(auth, activity);
}

// joi validation schema for updateActivity
updateActivity.schema = {
  auth: joi.object().keys({
    userId: joi.string().required(),
    accessToken: joi.string(),
  }).required(),
  activityId: joi.string().required(),
  entity: joi.object().keys({
    title: joi.string().allow(null),
    start: joi.number().integer().positive().allow(null),
    duration: joi.number().integer().positive().allow(null),
    location: joi.string().allow(null),
    meetingPoint: joi.string().allow(null),
    notes: joi.string().allow(null),
    privacy: joi.string().valid(_.values(ACTIVITY_PRIVACY)),
    invitees: joi.object().keys({
      additions: joi.object().keys({
        users: joi.array().items(joi.string().guid({ version: 'uuidv4' }).required()).min(1),
        contacts: joi.array().items(joi.string().guid({ version: 'uuidv4' }).required()).min(1),
      }).or('users', 'contacts'),
      removals: joi.object().keys({
        users: joi.array().items(joi.string().guid({ version: 'uuidv4' }).required()).min(1),
        contacts: joi.array().items(joi.string().guid({ version: 'uuidv4' }).required()).min(1),
      }).or('users', 'contacts'),
    }).or('additions', 'removals'),
  }).required(),
};

/**
 * Modify activity invitees list.
 * Modify activity invitees list.
 * This api supports invitees and removals parameters, specify the user id's in removals if you want to remove
 * a user from the list
 *
 * @param   {Object}    auth          currently logged in user auth context
 * @param   {String}    activityId    the id of activity
 * @param   {Object}    entity        the optional request payload
 * @return  {Void}                    this method doesn't return anything
 */
function* addInvitees(auth, activityId, entity) {
  const existing = yield validateAuthorAccess(activityId, auth.userId);
  yield modifyInvitees(existing, entity.additions, entity.removals);
}

// joi validation schema for addInvitees
addInvitees.schema = {
  auth: joi.object().keys({
    userId: joi.string().required(),
    accessToken: joi.string(),
  }).required(),
  activityId: joi.string().required(),
  entity: joi.object().keys({
    additions: joi.object().keys({
      users: joi.array().items(joi.string().guid({ version: 'uuidv4' }).required()).min(1),
      contacts: joi.array().items(joi.string().guid({ version: 'uuidv4' }).required()).min(1),
    }).or('users', 'contacts'),
    removals: joi.object().keys({
      users: joi.array().items(joi.string().guid({ version: 'uuidv4' }).required()).min(1),
      contacts: joi.array().items(joi.string().guid({ version: 'uuidv4' }).required()).min(1),
    }).or('users', 'contacts'),
  }).or('additions', 'removals').required(),
};

/**
 * Get activity invitees list
 * Get list of users invitied to the specified activity
 *
 * @param   {Object}    auth          currently logged in user auth context
 * @param   {String}    activityId    the id of activity
 * @param   {Object}    criteria      optional get query params, currently supported params are limit and offset
 * @return  {Void}                    this method doesn't return anything
 */
function* getInvitees(auth, activityId, criteria) {
  const existing = yield validateAuthorAccess(activityId, auth.userId);

  const lo = helper.parseLimitAndOffset(criteria);

  const total = yield r.table(ActivityInvitee.getTableName())
    .getAll(existing.id, { index: 'activityId' })
    .count()
    .run();

  const docs = yield r.table(ActivityInvitee.getTableName())
    .getAll(existing.id, { index: 'activityId' })
    .orderBy(r.desc('createdAt'))
    .skip(lo.offset)
    .limit(lo.limit)
    .map(invitee => r.branch(
      r.eq(invitee('type'), USER_TYPES.NON_APP_USER),
      invitee.merge({ reference: r.table(UserContact.getTableName()).get(invitee('inviteeId')) }),
      invitee.merge({ reference: r.table(User.getTableName()).get(invitee('inviteeId')) })))
    .run();

  const users = _.filter(docs, single => single.type === USER_TYPES.APP_USER);
  const contacts = _.filter(docs, single => single.type === USER_TYPES.NON_APP_USER);

  const merged = {
    users: users.map(single => single.reference),
    contacts: contacts.map(single => single.reference),
  };

  const transformed = helper.decorateWithSignedUrl(merged, ['photo', 'photos']);

  return helper.decorateWithPaginatedResponse(transformed, lo, total);
}

// joi validation schema for getInvitees
getInvitees.schema = {
  auth: joi.object().keys({
    userId: joi.string().required(),
    accessToken: joi.string(),
  }).required(),
  activityId: joi.string().required(),
  criteria: joi.object().keys({
    limit: joi.number().integer().min(0).default(config.pagination.limit),
    offset: joi.number().integer().min(0).default(config.pagination.offset),
  }).required(),
};

/**
 * Add additional photos to the activity
 *
 * @param   {Object}    auth          currently logged in user auth context
 * @param   {String}    activityId    the id of activity
 * @param   {Object}    entity        the optional request payload
 * @return  {Void}                    this method doesn't return anything
 */
function* addPhotos(auth, activityId, entity) {
  const existing = yield validateAuthorAccess(activityId, auth.userId);

  const uphotos = yield helper.processAndUploadImagesToS3(auth.userId, entity, config.resize.ACTIVITIES);

  const records = uphotos.map(single => ({ activityId: existing.id, photo: single }));
  const saved = yield ActivityPhoto.save(records);
  const ids = saved.map(single => single.id);

  try {
    const photos = _.isArray(existing.photos) ? existing.photos.concat(uphotos) : uphotos;
    yield existing.merge({ photos }).save();
  } catch (ignore) {
    logger.error('failed to add photos to activity rollback', helper.stringify(ignore));
    yield r.table(ActivityPhoto.getTableName()).filter(doc => r.expr(ids).contains(doc('id'))).delete().run();
    throw ignore;
  }
  const plain = helper.getRawObject(existing);
  return helper.decorateWithSignedUrl(plain, ['photos', 'photo']);
}

// joi validation schema for addPhotos
addPhotos.schema = {
  auth: joi.object().keys({
    userId: joi.string().required(),
    accessToken: joi.string(),
  }).required(),
  activityId: joi.string().required(),
  entity: joi.array().items(joi.object().required()).min(1).required(),
};

/**
 * Get all activity photos
 * Get all the photos uploaded for the specified activity, this includes comment photos
 *
 * @param   {Object}    auth          currently logged in user auth context
 * @param   {String}    activityId    the id of activity
 * @param   {Object}    criteria      optional get query params, currently supported params are limit and offset
 * @return  {Void}                    this method doesn't return anything
 */
function* getPhotos(auth, activityId, criteria) {
  const existing = yield validateActivityExists(activityId);
  const lo = helper.parseLimitAndOffset(criteria);

  const total = yield r.table(ActivityPhoto.getTableName())
    .getAll(activityId, { index: 'activityId' })
    .count()
    .run();

  const docs = yield doGetPhotos(existing.id, lo.limit, lo.offset);

  const transformed = helper.decorateWithSignedUrl(docs, ['photo', 'photos']);

  return helper.decorateWithPaginatedResponse(transformed, lo, total);
}

// joi validation schema for getPhotos
getPhotos.schema = {
  auth: joi.object().keys({
    userId: joi.string().required(),
    accessToken: joi.string(),
  }).required(),
  activityId: joi.string().required(),
  criteria: joi.object().keys({
    limit: joi.number().integer().min(0).default(config.pagination.limit),
    offset: joi.number().integer().min(0).default(config.pagination.offset),
  }).required(),
};

/**
 * Validate that the activity exists with the specified id.
 * Validate that user accessing the activity resource has permission to do so
 * @private
 *
 * @param   {String}    activityId    the id of activity
 * @param   {String}    userId        the user accessing activity resource
 *
 * @return  {Object}                  The activity document
 * @throws  {NotFoundError}           If activity not found with specified id
 * @throws  {NotPermittedError}       If illegal access
 */
function* validateActivityPrivacyAccess(activityId, userId) {
  const existing = yield validateActivityExists(activityId);

  const isAuthor = existing.author === userId;

  if (existing.privacy === ACTIVITY_PRIVACY.shared) {
    // userId should be a follower of author
    const followers = yield UserFollower.getAll([existing.author, userId], { index: 'userId_followerId' });
    if ((!followers || followers.length === 0 || followers[0].status !== 1) && isAuthor === false) {
      throw new errors.NotPermittedError('user is not follower of activity author',
        new Error(ErrorCodes.SHARED_ACTIVITY_ILLEGAL_ACCESS));
    }
  } else if (existing.privacy === ACTIVITY_PRIVACY.private) {
    // userId should be an invitee to the activity
    const invitees = yield ActivityInvitee.getAll([existing.id, userId], { index: 'activityId_inviteeId' });
    if ((!invitees || invitees.length === 0) && isAuthor === false) {
      throw new errors.NotPermittedError('user is not an invitee',
        new Error(ErrorCodes.PRIVATE_ACTIVITY_ILLEGAL_ACCESS));
    }
  }

  return existing;
}

/**
 * RSVP to the activity
 * Add currently logged in user to the list of rsvp'd users list
 * The user should be an invitee of the activity before user can rsvp to activity
 *
 * @param   {Object}    auth          currently logged in user auth context
 * @param   {String}    activityId    the id of activity
 * @return  {Void}                    this method doesn't return anything
 */
function* addRsvp(auth, activityId) {
  const existing = yield validateActivityPrivacyAccess(activityId, auth.userId);

  if (existing.author === auth.userId) {
    throw new errors.ArgumentError('cannot add author to rsvp list',
      new Error(ErrorCodes.ADD_RSVP_AUTHOR_NOT_ALLOWED));
  }

  // if already rsvp'd skip
  const rsvp = yield ActivityRsvp.getAll([existing.id, auth.userId], { index: 'activityId_userId' });
  if (rsvp && rsvp.length > 1) {
    throw new errors.data.DataError('multiple database records',
      new Error(ErrorCodes.MULTIPLE_DATABASE_RECORDS));
  }
  if (!rsvp || rsvp.length === 0) {
    yield ActivityRsvp.save({ activityId: existing.id, userId: auth.userId });
    yield rabbitmqService.publish(config.ROUTING_KEYS.ACTIVITY_UPDATED.key, {
      auth,
      activityId: existing.id,
      action: USER_ACTIONS_VERBS.join,
    });
  }
}

// joi validation schema for addRsvp
addRsvp.schema = {
  auth: joi.object().keys({
    userId: joi.string().required(),
    accessToken: joi.string(),
  }).required(),
  activityId: joi.string().required(),
};

/**
 * Undo RSVP to the activity
 * Remove currently logged in user from the list of rsvp'd users.
 *
 * @param   {Object}    auth          currently logged in user auth context
 * @param   {String}    activityId    the id of activity
 * @return  {Void}                    this method doesn't return anything
 */
function* removeRsvp(auth, activityId) {
  const existing = yield validateActivityPrivacyAccess(activityId, auth.userId);
  if (existing.author === auth.userId) {
    throw new errors.ArgumentError('cannot remove author from rsvp list',
      new Error(ErrorCodes.ACTIVITY_AUTHOR_UNDO_RSVP_NOT_ALLOWED));
  }
  // if already rsvp'd skip
  const rsvp = yield ActivityRsvp.getAll([existing.id, auth.userId], { index: 'activityId_userId' });
  if (rsvp && rsvp.length > 1) {
    throw new errors.data.DataError('multiple database records',
      new Error(ErrorCodes.MULTIPLE_DATABASE_RECORDS));
  } else if (rsvp && rsvp.length === 1) {
    yield rsvp[0].delete();
    yield rabbitmqService.publish(config.ROUTING_KEYS.ACTIVITY_UPDATED.key, {
      auth,
      activityId: existing.id,
      action: USER_ACTIONS_VERBS.remove_rsvp,
    });
  }
}

// joi validation schema for removeRsvp
removeRsvp.schema = {
  auth: joi.object().keys({
    userId: joi.string().required(),
    accessToken: joi.string(),
  }).required(),
  activityId: joi.string().required(),
};

/**
 * Share an activity
 * Share an activity, the activity that is shared is the parent activity of newly created activity.
 * Current user is the author of shared activity.
 *
 * @param   {Object}    auth          currently logged in user auth context
 * @param   {String}    activityId    the id of activity
 * @param   {Object}    entity        the optional request payload
 * @return  {Object}                  The newly created activity resource
 */
function* shareActivity(auth, activityId, entity) {
  const existing = yield validateActivityPrivacyAccess(activityId, auth.userId);

  const doc = _.pick(entity, 'title', 'start', 'duration', 'location', 'meetingPoint', 'notes', 'privacy');

  // get the user default activity duration setting
  const settings = yield UserSetting.filter({ userId: auth.userId });
  if (!settings || settings.length !== 1) {
    // race condition should never happen
    throw new errors.data.DataError('corrupt user settings state',
      new Error(ErrorCodes.CORRUPT_USER_SETTINGS_STATE));
  }

  // resolve author and parent activity
  doc.author = auth.userId;
  doc.parent = existing.id;

  // if duration is not specified use default activity duration
  if (!_.has(entity, 'duration')) {
    doc.duration = settings[0].defaultActivityDuration;
  }
  const activity = yield Activity.save(doc);

  try {
    // add activity invitees if present
    if (_.has(entity, 'invitees')) {
      const invitees = entity.invitees.map(single => ({ activityId: activity.id, inviteeId: single }));
      yield ActivityInvitee.save(invitees);
    }
    yield ActivityRsvp.save({ activityId: activity.id, userId: activity.author });
  } catch (ignore) {
    logger.error('failed to save invitees list rollback', helper.stringify(ignore));
    yield activity.delete();
    throw ignore;
  }

  yield rabbitmqService.publish(config.ROUTING_KEYS.ACTIVITY_CREATED.key, {
    auth,
    activityId: activity.id,
    action: USER_ACTIONS_VERBS.share,
  });
  return yield getRawActivity(auth, activity);
}

// joi validation schema for shareActivity
shareActivity.schema = {
  auth: joi.object().keys({
    userId: joi.string().required(),
    accessToken: joi.string(),
  }).required(),
  activityId: joi.string().required(),
  entity: joi.object().keys({
    title: joi.string(),
    start: joi.number().integer().positive(),
    duration: joi.number().integer().positive(),
    location: joi.string(),
    meetingPoint: joi.string(),
    notes: joi.string(),
    privacy: joi.string().valid(_.values(ACTIVITY_PRIVACY)).required(),
    invitees: joi.array().items(joi.string().guid({ version: 'uuidv4' }).required()).min(1),
  }).required(),
};

/**
 * Like an activity
 * Like an activity, the activity is liked by the current logged in user.
 *
 * @param   {Object}    auth          currently logged in user auth context
 * @param   {String}    activityId    the id of activity
 * @return  {Void}                    this method doesn't return anything
 */
function* likeActivity(auth, activityId) {
  const existing = yield validateActivityPrivacyAccess(activityId, auth.userId);

  const likes = yield ActivityLike.getAll([existing.id, auth.userId], { index: 'activityId_userId' });
  if (likes && likes.length > 1) {
    throw new errors.data.DataError('multiple database records',
      new Error(ErrorCodes.MULTIPLE_DATABASE_RECORDS));
  }
  if (!likes || likes.length === 0) {
    yield ActivityLike.save({ activityId: existing.id, userId: auth.userId });
  }
}

// joi validation schema for likeActivity
likeActivity.schema = {
  auth: joi.object().keys({
    userId: joi.string().required(),
    accessToken: joi.string(),
  }).required(),
  activityId: joi.string().required(),
};

/**
 * Dislike an activity
 * Dislike an activity, the activity is disliked by the current logged in user.
 *
 * @param   {Object}    auth          currently logged in user auth context
 * @param   {String}    activityId    the id of activity
 * @return  {Void}                    this method doesn't return anything
 */
function* dislikeActivity(auth, activityId) {
  const existing = yield validateActivityPrivacyAccess(activityId, auth.userId);

  const likes = yield ActivityLike.getAll([existing.id, auth.userId], { index: 'activityId_userId' });
  if (likes && likes.length > 1) {
    throw new errors.data.DataError('multiple database records',
      new Error(ErrorCodes.MULTIPLE_DATABASE_RECORDS));
  }
  if (likes && likes.length === 1) {
    yield likes[0].delete();
  }
}

// joi validation schema for dislikeActivity
dislikeActivity.schema = {
  auth: joi.object().keys({
    userId: joi.string().required(),
    accessToken: joi.string(),
  }).required(),
  activityId: joi.string().required(),
};

/**
 * Get comments for an activity
 * Get all the comments for an activity.
 * This API supports paginated response
 *
 * @param   {Object}    auth          currently logged in user auth context
 * @param   {String}    activityId    the id of activity
 * @param   {Object}    criteria      the optional list criteria
 * @return  {Object}                   Paginated response with paging and data fields
 */
function* getComments(auth, activityId, criteria) {
  const existing = yield validateActivityPrivacyAccess(activityId, auth.userId);
  const lo = helper.parseLimitAndOffset(criteria);

  const total = yield r.table(Comment.getTableName())
    .getAll(existing.id, { index: 'activityId' })
    .filter(citem => citem.hasFields('parent').not())
    .count()
    .run();

  let chain = r.table(Comment.getTableName())
    .getAll(existing.id, { index: 'activityId' })
    .filter(citem => citem.hasFields('parent').not());

  if (criteria.direction === config.SORT_DIRECTION.DESC) {
    chain = chain.orderBy(r.desc(criteria.sort));
  } else {
    chain = chain.orderBy(r.asc(criteria.sort));
  }

  const docs = yield chain
    .skip(lo.offset)
    .limit(lo.limit)
    .map((item) => {
      const likes = r.table(CommentLike.getTableName())
        .getAll(item('id'), { index: 'commentId' })
        .orderBy(r.desc('updatedAt'))
        .limit(config.aggregation.ACTIVITY_LATEST_LIKES)
        .eqJoin('userId', r.table(User.getTableName()))
        .map(single => single('right').without('password'));

      const lcount = r.table(CommentLike.getTableName())
        .getAll(item('id'), { index: 'commentId' }).count();

      const currentUserLike = r.table(CommentLike.getTableName())
        .getAll([item('id'), auth.userId], { index: 'commentId_userId' })
        .nth(0)
        .default(null);

      return item.merge({
        activity: r.table(Activity.getTableName()).get(item('activityId')),
        author: r.table(User.getTableName()).get(item('author')).without('password'),
        likes: { items: likes, total: lcount },
        currentUserLike,
      });
    })
    .run();

  const decorated = helper.decorateWithSignedUrl(docs, ['photos', 'photo']);
  return helper.decorateWithPaginatedResponse(decorated, lo, total);
}

// joi validation schema for getComments
getComments.schema = {
  auth: joi.object().keys({
    userId: joi.string().required(),
    accessToken: joi.string(),
  }).required(),
  activityId: joi.string().required(),
  criteria: joi.object().keys({
    limit: joi.number().integer().min(0).default(config.pagination.limit),
    offset: joi.number().integer().min(0).default(config.pagination.offset),
    direction: joi.string().valid(_.values(config.SORT_DIRECTION)).default(config.SORT_DIRECTION.DESC),
    sort: joi.string().valid(['createdAt', 'updatedAt', 'activityId', 'author', 'id']).default('updatedAt'),
  }).required(),
};


/**
 * Get an activity likes
 * Get all the likes for an activity.
 * This API supports paginated response
 *
 * @param   {Object}    auth          currently logged in user auth context
 * @param   {String}    activityId    the id of activity
 * @param   {Object}    criteria      the optional list criteria
 * @return  {Object}                   Paginated response with paging and data fields
 */
function* getLikes(auth, activityId, criteria) {
  const existing = yield validateActivityPrivacyAccess(activityId, auth.userId);
  const lo = helper.parseLimitAndOffset(criteria);

  const total = yield r.table(ActivityLike.getTableName())
    .getAll(existing.id, { index: 'activityId' }).count().run();

  const docs = yield r.table(ActivityLike.getTableName())
    .getAll(existing.id, { index: 'activityId' })
    .orderBy(r.desc('updatedAt'))
    .skip(lo.offset)
    .limit(lo.limit)
    .eqJoin('userId', r.table(User.getTableName()))
    .map(single => single('right').without('password'))
    .run();

  const decorated = helper.decorateWithSignedUrl(docs, ['photos', 'photo']);
  return helper.decorateWithPaginatedResponse(decorated, lo, total);
}

// joi validation schema for getLikes
getLikes.schema = {
  auth: joi.object().keys({
    userId: joi.string().required(),
    accessToken: joi.string(),
  }).required(),
  activityId: joi.string().required(),
  criteria: joi.object().keys({
    limit: joi.number().integer().min(0).default(config.pagination.limit),
    offset: joi.number().integer().min(0).default(config.pagination.offset),
  }).required(),
};

module.exports = {
  createActivity,
  getActivityDetail,
  deleteActivity,
  updateActivity,
  addInvitees,
  getInvitees,
  addPhotos,
  getPhotos,
  addRsvp,
  removeRsvp,
  shareActivity,
  likeActivity,
  dislikeActivity,
  getComments,
  getLikes,
};
