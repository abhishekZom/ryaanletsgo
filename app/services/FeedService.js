/*
 * Copyright (C) 2017 lets., All Rights Reserved.
 */

'use strict';

/**
 * Feeds resource service contract
 * Some of the modules this service depends on will be resolved at deployment time.
 *
 * @author      TSCCODER
 * @version     1.0.0
 */

const config = require('config');
const moment = require('moment');
const joi = require('joi');
const _ = require('lodash');

const logger = require('../common/Logger');
const helper = require('../common/Helper');

const models = require('../models').getDatasource({       // eslint-disable-line import/no-unresolved
  db: _.extend(config.db, { max: 10 }),
  logger,
});

const constants = require('../constants');          // eslint-disable-line import/no-unresolved

const ACTIVITY_PRIVACY = constants.ACTIVITY_PRIVACY;
const USER_ACTIONS_VERBS = constants.USER_ACTIONS_VERBS;

const r = models.r;

const Action = models.Action;
const Activity = models.Activity;
const ActivityLike = models.ActivityLike;
const ActivityPhoto = models.ActivityPhoto;
const ActivityRsvp = models.ActivityRsvp;
const Comment = models.Comment;
const CommentLike = models.CommentLike;
const User = models.User;

/**
 * Get public feeds
 * Get all the public feeds. This API supports paginated response
 *
 * @param   {Object}    auth          currently logged in user auth context
 * @param   {Object}    criteria      optional get query params, currently supported params are limit and offset
 * @return  {Array}                   Array of PublicFeed objects. See PublicFeeds swagger model definition
 */
function* getPublicFeeds(auth, criteria) {
  // parse limit and offset
  const lo = helper.parseLimitAndOffset(criteria);

  const total = yield r.table(Activity.getTableName())
    .getAll(ACTIVITY_PRIVACY.public, { index: 'privacy' })
    .count()
    .run();

  const docs = yield r.table(Activity.getTableName())
    .getAll(ACTIVITY_PRIVACY.public, { index: 'privacy' })
    .orderBy(r.desc('updatedAt'))
    .skip(lo.offset)
    .limit(lo.limit)
    .map((item) => {
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
              const prcount = r.table(ActivityRsvp.getTableName())
                .getAll(pitem('id'), { index: 'activityId' }).count();
              return pitem.merge({
                rsvp: { total: prcount },
                author: r.table(User.getTableName()).get(pitem('author')).without('password'),
              });
            }), null),
        currentUserRsvp,
        currentUserLike,
      });
    })
    .run();

  const transformed = helper.decorateWithSignedUrl(docs, ['photo', 'photos']);
  return helper.decorateWithPaginatedResponse(transformed, lo, total);
}

// joi validation schema for getPublicFeeds
getPublicFeeds.schema = {
  auth: joi.object().keys({
    userId: joi.string().required(),
    accessToken: joi.string(),
  }).required(),
  criteria: joi.object().keys({
    limit: joi.number().integer().min(0).default(config.pagination.limit),
    offset: joi.number().integer().min(0).default(config.pagination.offset),
  }).required(),
};

/**
 * Private helper method to get activity feed.
 * Activity feed includes activity likes, rsvp list, comments, comment likes etc.
 * @private
 *
 * @param   {Object}    auth          currently logged in user auth context
 * @param   {Array}     activityIds   the activity ids detail to fetch
 * @param   {Number}    limit         the optional number of items to return
 * @param   {Number}    skip          the optional number of items to skip
 * @return  {Array}                   Array of feed items
 */
function* getActivityFeed(auth, activityIds, limit, skip) {
  const lo = helper.parseLimitAndOffset({ limit, offset: skip });
  return yield r.table(Activity.getTableName())
    .filter(doc => r.expr(activityIds).contains(doc('id')))
    .orderBy(r.desc('updatedAt'))
    .limit(lo.limit)
    .skip(lo.offset)
    .map((item) => {
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
              const prcount = r.table(ActivityRsvp.getTableName())
                .getAll(pitem('id'), { index: 'activityId' }).count();
              return pitem.merge({
                rsvp: { total: prcount },
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
 * Private helper method to get activity details for the sepcified activity id
 * @private
 *
 * @param   {Object}    auth          currently logged in user auth context
 * @param   {String}    verb          the feed verb
 * @param   {Array}     activityIds   the activity ids detail to fetch
 * @return  {Array}                   Array of feed items
 */
function* resolveActivityFeedDetail(auth, verb, activityIds) {
  const docs = yield getActivityFeed(auth, activityIds);

  return docs.map(single => ({ verb, item: single }));
}

/**
 * Private helper method to get comment details for the sepcified comment ids
 * @private
 *
 * @param   {Object}    auth          currently logged in user auth context
 * @param   {String}    verb          the feed verb
 * @param   {Array}     commentIds    the comment ids detail to fetch
 * @return  {Array}                   Array of feed items
 */
function* resolveCommentFeedDetail(auth, verb, commentIds) {
  const docs = yield r.table(Comment.getTableName())
    .filter(doc => r.expr(commentIds).contains(doc('id')))
    .map((item) => {
      const likes = r.table(CommentLike.getTableName())
        .getAll(item('id'), { index: 'commentId' })
        .orderBy(r.desc('updatedAt'))
        .limit(config.aggregation.ACTIVITY_LATEST_LIKES)
        .eqJoin('userId', r.table(User.getTableName()))
        .map(single => single('right').without('password'));

      const lcount = r.table(CommentLike.getTableName())
        .getAll(item('id'), { index: 'commentId' }).count();

      const comments = r.table(Comment.getTableName())
        .filter(doc => r.expr(doc('parent')).eq(item('id')))
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
        .filter(doc => r.expr(doc('parent')).eq(item('id'))).count();

      const currentUserLike = r.table(CommentLike.getTableName())
        .getAll([item('id'), auth.userId], { index: 'commentId_userId' })
        .nth(0)
        .default(null);

      return item.merge({
        activity: r.table(Activity.getTableName()).get(item('activityId')),
        author: r.table(User.getTableName()).get(item('author')).without('password'),
        comments: { items: comments, total: ccount },
        likes: { items: likes, total: lcount },
        currentUserLike,
      });
    })
    .run();

  return docs.map(single => ({ verb, item: single }));
}

/**
 * Get my feeds
 * Get my feeds. This API supports paginated response
 *
 * @param   {Object}    auth          currently logged in user auth context
 * @param   {Object}    criteria      optional get query params, currently supported params are limit and offset
 * @return  {Array}                   Array of PublicFeed objects. See PublicFeeds swagger model definition
 */
function* getMyFeeds(auth, criteria) {
  // parse limit and offset
  const lo = helper.parseLimitAndOffset(criteria);

  // get current user authored activities
  const activities = yield r.table(Activity.getTableName())
    .getAll(auth.userId, { index: 'author' })
    .pluck('id').run();

  const activityIds = activities.map(single => single.id);

  // get photo comments for all these activities

  const pcomments = yield r.table(Comment.getTableName())
    .filter(item => r.expr(activityIds).contains(item('activityId')))
    .hasFields('photos')
    .pluck('id')
    .run();

  const pcommentIds = pcomments.map(single => single.id);

  const ps = [USER_ACTIONS_VERBS.post, USER_ACTIONS_VERBS.share];
  const jp = [USER_ACTIONS_VERBS.join, USER_ACTIONS_VERBS.photo_comment];

  const total = yield r.table(Action.getTableName())
    .filter((doc) => {
      const jcbool = r.expr(_.concat([], activityIds, pcommentIds)).contains(doc('object'))
        .and(r.expr(jp).contains(doc('verb')));
      const psbool = r.expr(ps).contains(doc('verb')).and(r.expr(doc('actor')).eq(auth.userId));
      return r.or(jcbool, psbool);
    })
    .count()
    .run();

  const docs = yield r.table(Action.getTableName())
    .filter((doc) => {
      const jcbool = r.expr(_.concat([], activityIds, pcommentIds)).contains(doc('object'))
        .and(r.expr(jp).contains(doc('verb')));
      const psbool = r.expr(ps).contains(doc('verb')).and(r.expr(doc('actor')).eq(auth.userId));
      return r.or(jcbool, psbool);
    })
    .orderBy(r.desc('updatedAt'))
    .skip(lo.offset)
    .limit(lo.limit)
    .group('verb', 'object')
    .ungroup()
    .run();

  const postActivityIds = _.filter(docs, doc => doc.group[0] === USER_ACTIONS_VERBS.post).map(doc => doc.group[1]);
  const shareActivityIds = _.filter(docs, doc => doc.group[0] === USER_ACTIONS_VERBS.share).map(doc => doc.group[1]);
  const joinActivityIds = _.filter(docs, doc => doc.group[0] === USER_ACTIONS_VERBS.join).map(doc => doc.group[1]);

  const commentIds = _.filter(docs, doc => doc.group[0] === USER_ACTIONS_VERBS.photo_comment).map(doc => doc.group[1]);

  const postActivityFeeds = yield resolveActivityFeedDetail(auth, USER_ACTIONS_VERBS.post, postActivityIds);
  const shareActivityFeeds = yield resolveActivityFeedDetail(auth, USER_ACTIONS_VERBS.share, shareActivityIds);
  const joinActivityFeeds = yield resolveActivityFeedDetail(auth, USER_ACTIONS_VERBS.join, joinActivityIds);

  const commentFeeds = yield resolveCommentFeedDetail(auth, USER_ACTIONS_VERBS.photo_comment, commentIds);

  const merged = _.concat([], postActivityFeeds, shareActivityFeeds, joinActivityFeeds, commentFeeds);
  const transformed = helper.decorateWithSignedUrl(merged, ['photo', 'photos']);
  return helper.decorateWithPaginatedResponse(transformed, lo, total);
}

// joi validation schema for getMyFeeds
getMyFeeds.schema = {
  auth: joi.object().keys({
    userId: joi.string().required(),
    accessToken: joi.string(),
  }).required(),
  criteria: joi.object().keys({
    limit: joi.number().integer().min(0).default(config.pagination.limit),
    offset: joi.number().integer().min(0).default(config.pagination.offset),
  }).required(),
};

/**
 * Get a user's profile feeds
 * Profile feeds includes those activities that are authored by user
 *
 * @param   {Object}    auth          currently logged in user auth context
 * @param   {String}    userId        the specified user id
 * @param   {Object}    criteria      optional get query params, currently supported params are limit and offset
 * @return  {Array}                   Array of ProfileFeed objects. See ProfileFeeds swagger model definition
 */
function* getProfileFeeds(auth, userId, criteria) {
  // parse limit and offset
  const lo = helper.parseLimitAndOffset(criteria);

  const now = moment().valueOf();

  const total = yield r.table(Activity.getTableName())
    .filter(doc => r.branch(
      r.eq(auth.userId, userId),
      r.expr(doc('author')).eq(userId),
      r.expr(doc('author')).eq(userId).and(r.expr(doc('start')).add(doc('duration')).ge(now))))
    .count()
    .run();

  const docs = yield r.table(Activity.getTableName())
    .filter(doc => r.branch(
      r.eq(auth.userId, userId),
      r.expr(doc('author')).eq(userId),
      r.expr(doc('author')).eq(userId).and(r.expr(doc('start')).add(doc('duration')).ge(now))))
    .orderBy(r.desc('updatedAt'))
    .skip(lo.offset)
    .limit(lo.limit)
    .map((item) => {
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
              const prcount = r.table(ActivityRsvp.getTableName())
                .getAll(pitem('id'), { index: 'activityId' }).count();
              return pitem.merge({
                rsvp: { total: prcount },
                author: r.table(User.getTableName()).get(pitem('author')).without('password'),
              });
            }), null),
        currentUserRsvp,
        currentUserLike,
      });
    })
    .run();

  const transformed = helper.decorateWithSignedUrl(docs, ['photo', 'photos']);
  return helper.decorateWithPaginatedResponse(transformed, lo, total);
}

// joi validation schema for getProfileFeeds
getProfileFeeds.schema = {
  auth: joi.object().keys({
    userId: joi.string().required(),
    accessToken: joi.string(),
  }).required(),
  userId: joi.string().uuid(4).required(),
  criteria: joi.object().keys({
    limit: joi.number().integer().min(0).default(config.pagination.limit),
    offset: joi.number().integer().min(0).default(config.pagination.offset),
  }).required(),
};

/**
 * Get a user's upcoming feeds
 * Upcoming feeds are those activities for which the expiry time is in future and
 * which are authored by user or user rsvp to the activity.
 *
 * @param   {Object}    auth          currently logged in user auth context
 * @param   {String}    userId        the specified user id
 * @param   {Object}    criteria      optional get query params, currently supported params are limit and offset
 * @return  {Array}                   Array of ProfileFeed objects. See ProfileFeeds swagger model definition
 */
function* getUpcomingFeeds(auth, userId, criteria) {
  // parse limit and offset
  const lo = helper.parseLimitAndOffset(criteria);

  const timestamp = moment().subtract(config.UPCOMING_FEEDS_PAST_N_DAYS, 'day').valueOf();

  // get all the activity ids
  const authorActivityIds = yield r.table(Activity.getTableName())
    .filter(doc => r.expr(doc('author')).eq(userId).and(r.expr(doc('start')).add(doc('duration')).ge(timestamp)))
    .map(item => item('id'));

  // rsvp activity ids
  const rsvpActivityIds = yield r.table(ActivityRsvp.getTableName())
    .getAll(userId, { index: 'userId' })
    .eqJoin('activityId', r.table(Activity.getTableName()))
    .filter(doc => r.expr(doc('right')('start')).add(doc('right')('duration')).ge(timestamp))
    .map(item => item('right')('id'));

  const activityIds = _.union(authorActivityIds, rsvpActivityIds);

  const docs = yield getActivityFeed(auth, activityIds, lo.limit, lo.offset);

  const transformed = helper.decorateWithSignedUrl(docs, ['photo', 'photos']);
  return helper.decorateWithPaginatedResponse(transformed, lo, activityIds.length);
}

// joi validation schema for getUpcomingFeeds
getUpcomingFeeds.schema = {
  auth: joi.object().keys({
    userId: joi.string().required(),
    accessToken: joi.string(),
  }).required(),
  userId: joi.string().uuid(4).required(),
  criteria: joi.object().keys({
    limit: joi.number().integer().min(0).default(config.pagination.limit),
    offset: joi.number().integer().min(0).default(config.pagination.offset),
  }).required(),
};

module.exports = {
  getPublicFeeds,
  getMyFeeds,
  getProfileFeeds,
  getUpcomingFeeds,
};
