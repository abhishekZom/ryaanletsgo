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

const constants = require('../constants');          // eslint-disable-line import/no-unresolved
const RabbitMQService = require('./RabbitMQService');

const r = models.r;
const thinky = models.thinky;
const Activity = models.Activity;
const ActivityInvitee = models.ActivityInvitee;
const ActivityPhoto = models.ActivityPhoto;
const Comment = models.Comment;
const CommentLike = models.CommentLike;
const User = models.User;
const UserFollower = models.UserFollower;

const ACTIVITY_PRIVACY = constants.ACTIVITY_PRIVACY;
const USER_ACTIONS_VERBS = constants.USER_ACTIONS_VERBS;

// initiates a new rabbitmq service
const rabbitmqService = new RabbitMQService({ url: config.rabbitmq.url, logger });

/**
 * Validate that the comment exists with the specified id
 * @private
 *
 * @param   {String}    commentId     the id of comment
 *
 * @return  {Object}                  The comment document
 * @throws  {NotFoundError}           If comment not found with specified id
 */
function* validateCommentExists(commentId) {
  const existing = yield helper.fetch(Comment, commentId, thinky);
  if (!existing) {
    throw new errors.NotFoundError('comment not found with specified id',
      new Error(ErrorCodes.RESOURCE_NOT_FOUND));
  }
  return existing;
}

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
 * Add a comment to an activity
 * Add a comment to an activity. The comment can have photo or text
 *
 * @param   {Object}    auth          currently logged in user auth context
 * @param   {String}    activityId    the id of activity
 * @param   {Object}    entity        the request payload
 * @return  {Object}                  the details of newly created comment resource
 */
function* addComment(auth, activityId, entity) {
  const existing = yield validateActivityPrivacyAccess(activityId, auth.userId);

  const doc = _.extend(entity, { activityId: existing.id, author: auth.userId });

  const comment = yield Comment.save(doc);
  return helper.getRawObject(comment);
}

// joi validation schema for addComment
addComment.schema = {
  auth: joi.object().keys({
    userId: joi.string().required(),
    accessToken: joi.string(),
  }).required(),
  activityId: joi.string().required(),
  entity: joi.object().keys({
    text: joi.string(),
  }).required(),
};

/**
 * Add a comment to a comment
 * Users can only add additional comments to photo comments
 *
 * @param   {Object}    auth          currently logged in user auth context
 * @param   {String}    activityId    the id of activity
 * @param   {String}    commentId     the id of comment
 * @param   {Object}    entity        the request payload
 * @return  {Object}                  the details of newly created comment resource
 */
function* addCommentOnComment(auth, activityId, commentId, entity) {
  const existing = yield validateActivityPrivacyAccess(activityId, auth.userId);
  const existingComment = yield validateCommentExists(commentId);

  // user can only add comments to photo comment
  if (!_.isArray(existingComment.photos) || existingComment.photos.length === 0) {
    throw new errors.ArgumentError('user can only add comment on photo comment',
      new Error(ErrorCodes.COMMENT_INVALID_COMMENT));
  }

  const doc = _.extend(entity, { activityId: existing.id, author: auth.userId, parent: existingComment.id });

  const comment = yield Comment.save(doc);
  yield rabbitmqService.publish(config.ROUTING_KEYS.ACTIVITY_UPDATED.key, {
    auth,
    commentId: comment.id,
    action: USER_ACTIONS_VERBS.photo_comment,
  });
  return helper.getRawObject(comment);
}

// joi validation schema for addCommentOnComment
addCommentOnComment.schema = {
  auth: joi.object().keys({
    userId: joi.string().required(),
    accessToken: joi.string(),
  }).required(),
  activityId: joi.string().required(),
  commentId: joi.string().required(),
  entity: joi.object().keys({
    text: joi.string().required(),
  }).required(),
};

/**
 * Like a comment
 * Like a comment, the comment is liked by the current logged in user.
 *
 * @param   {Object}    auth          currently logged in user auth context
 * @param   {String}    activityId    the id of activity
 * @param   {String}    commentId     the id of comment
 * @return  {Void}                    this method doesn't return anything
 */
function* likeComment(auth, activityId, commentId) {
  yield validateActivityPrivacyAccess(activityId, auth.userId);
  const existingComment = yield validateCommentExists(commentId);

  const likes = yield CommentLike.getAll([existingComment.id, auth.userId], { index: 'commentId_userId' });
  if (likes && likes.length > 1) {
    throw new errors.data.DataError('multiple database records',
      new Error(ErrorCodes.MULTIPLE_DATABASE_RECORDS));
  }
  if (!likes || likes.length === 0) {
    yield CommentLike.save({ commentId: existingComment.id, userId: auth.userId });
  }
}

// joi validation schema for likeComment
likeComment.schema = {
  auth: joi.object().keys({
    userId: joi.string().required(),
    accessToken: joi.string(),
  }).required(),
  activityId: joi.string().required(),
  commentId: joi.string().required(),
};

/**
 * Dislike a comment
 * Dislike a comment, the comment is disliked by the current logged in user.
 *
 * @param   {Object}    auth          currently logged in user auth context
 * @param   {String}    activityId    the id of activity
 * @param   {String}    commentId     the id of comment
 * @return  {Void}                    this method doesn't return anything
 */
function* dislikeComment(auth, activityId, commentId) {
  yield validateActivityPrivacyAccess(activityId, auth.userId);
  const existingComment = yield validateCommentExists(commentId);

  const likes = yield CommentLike.getAll([existingComment.id, auth.userId], { index: 'commentId_userId' });
  if (likes && likes.length > 1) {
    throw new errors.data.DataError('multiple database records',
      new Error(ErrorCodes.MULTIPLE_DATABASE_RECORDS));
  }
  if (likes && likes.length === 1) {
    yield likes[0].delete();
  }
}

// joi validation schema for dislikeComment
dislikeComment.schema = {
  auth: joi.object().keys({
    userId: joi.string().required(),
    accessToken: joi.string(),
  }).required(),
  activityId: joi.string().required(),
  commentId: joi.string().required(),
};

/**
 * Add photos to a comment
 * The files to uploaded and resized.
 * The current swagger specification does not allow to specify multiple file uploads.
 * This is a limitation for this spec but server does supports multiple file upload.
 *
 * @param   {Object}    auth          currently logged in user auth context
 * @param   {String}    activityId    the id of activity
 * @param   {String}    commentId     the id of comment
 * @param   {Object}    entity        the request payload, multer file objects
 * @return  {Void}                    this method doesn't return anything
 */
function* addPhotoToComment(auth, activityId, commentId, entity) {
  const existing = yield validateActivityPrivacyAccess(activityId, auth.userId);

  const existingComment = yield validateCommentExists(commentId);

  const uphotos = yield helper.processAndUploadImagesToS3(auth.userId, entity, config.resize.ACTIVITIES);
  const records = uphotos.map(single => ({ activityId: existing.id, photo: single }));
  const saved = yield ActivityPhoto.save(records);
  const ids = saved.map(single => single.id);

  try {
    yield existingComment.merge({ photos: uphotos }).save();
  } catch (ignore) {
    logger.error('failed to add photos to comment rollback', helper.stringify(ignore));
    yield r.table(ActivityPhoto.getTableName()).filter(doc => r.expr(ids).contains(doc('id'))).delete().run();
    throw ignore;
  }
}

// joi validation schema for addPhotoToComment
addPhotoToComment.schema = {
  auth: joi.object().keys({
    userId: joi.string().required(),
    accessToken: joi.string(),
  }).required(),
  activityId: joi.string().required(),
  commentId: joi.string().required(),
  entity: joi.array().items(joi.object().required()).min(1).required(),
};

/**
 * Get comments for a comment
 * Get all the comments for a comment
 * This API supports paginated response
 *
 * @param   {Object}    auth          currently logged in user auth context
 * @param   {String}    activityId    the id of activity
 * @param   {String}    commentId     the id of photo comment
 * @param   {Object}    criteria      the optional list criteria
 * @return  {Object}                  Paginated response with paging and data fields
 */
function* getCommentsForComment(auth, activityId, commentId, criteria) {
  const lo = helper.parseLimitAndOffset(criteria);
  const existing = yield validateActivityPrivacyAccess(activityId, auth.userId);
  const existingComment = yield validateCommentExists(commentId);

  const total = yield r.table(Comment.getTableName())
    .getAll(existing.id, { index: 'activityId' })
    .filter(doc => r.expr(doc('parent')).eq(existingComment.id))
    .count()
    .run();

  let chain = r.table(Comment.getTableName())
    .getAll(existing.id, { index: 'activityId' })
    .filter(doc => r.expr(doc('parent')).eq(existingComment.id));

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

  const transformed = helper.decorateWithSignedUrl(docs, ['photos', 'photo']);
  return helper.decorateWithPaginatedResponse(transformed, lo, total);
}

// joi validation schema for getCommentsForComment
getCommentsForComment.schema = {
  auth: joi.object().keys({
    userId: joi.string().required(),
    accessToken: joi.string(),
  }).required(),
  activityId: joi.string().required(),
  commentId: joi.string().required(),
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
 * @param   {String}    commentId     the id of photo comment
 * @param   {Object}    criteria      the optional list criteria
 * @return  {Object}                   Paginated response with paging and data fields
 */
function* getLikes(auth, activityId, commentId, criteria) {
  yield validateActivityPrivacyAccess(activityId, auth.userId);
  const existingComment = yield validateCommentExists(commentId);
  const lo = helper.parseLimitAndOffset(criteria);

  const total = yield r.table(CommentLike.getTableName())
    .getAll(existingComment.id, { index: 'commentId' }).count().run();

  const docs = yield r.table(CommentLike.getTableName())
    .getAll(existingComment.id, { index: 'commentId' })
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
  commentId: joi.string().required(),
  criteria: joi.object().keys({
    limit: joi.number().integer().min(0).default(config.pagination.limit),
    offset: joi.number().integer().min(0).default(config.pagination.offset),
  }).required(),
};

module.exports = {
  addComment,
  addCommentOnComment,
  likeComment,
  dislikeComment,
  addPhotoToComment,
  getCommentsForComment,
  getLikes,
};
