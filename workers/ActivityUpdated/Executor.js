/*
 * Copyright (C) 2017 lets., All Rights Reserved.
 */

'use strict';

/**
 * The executor for the activity updated message
 * Must export consume method
 * Some of the modules this module depends on will be resolved at deployment time.
 *
 * @author      TSCCODER
 * @version     1.0.0
 */

const config = require('config');
const co = require('co');
const _ = require('lodash');
const logger = require('../common/Logger');
const helper = require('../common/Helper');

const models = require('../models').getDatasource({               // eslint-disable-line import/no-unresolved
  db: _.extend(config.db, { max: 5 }),
  logger,
});
const FeedManager = require('../FeedManager');
const constants = require('../constants');          // eslint-disable-line import/no-unresolved

const USER_ACTIONS_VERBS = constants.USER_ACTIONS_VERBS;

const r = models.r;
const Action = models.Action;
const Feed = models.Feed;

const feedManager = new FeedManager(models);

/**
 * Handle remove_rsvp verb action
 * @private
 *
 * @param  {Object}       content           the parsed message content
 * @return {Void}                           this function returns anything.
 */
function* handleRemoveRsvp(content) {
  // check if there is an action for join
  const existing = yield Action
    .getAll([content.auth.userId, content.activityId, USER_ACTIONS_VERBS.join], { index: 'actor_object_verb' }).nth(0)
    .default(null)
    .run();

  if (existing) {
    // remove feeds for this action
    yield r.table(Feed.getTableName()).getAll(existing.id, { index: 'referenceId' }).delete().run();
    // remove the action
    yield existing.delete();
  }
}

/**
 * Handle join verb action
 * @private
 *
 * @param  {Object}       content           the parsed message content
 * @return {Void}                           this function returns anything.
 */
function* handleAddRsvp(content) {
  // check if there is already an action created for specified object
  const existing = yield r.table(Action.getTableName())
    .getAll([content.auth.userId, content.activityId, content.action], { index: 'actor_object_verb' }).nth(0)
    .default(null)
    .run();

  if (existing) {
    // push to actor feeds
    yield feedManager.pushToFollowers(content.auth.userId, existing.id);
  } else {
    // create user action
    const action = yield Action.save({
      actor: content.auth.userId,
      verb: content.action,
      object: content.activityId,
    });
    // push to actor feeds
    yield feedManager.pushToFollowers(content.auth.userId, action.id);
  }
}

/**
 * Handle photo_comment verb action
 * @private
 *
 * @param  {Object}       content           the parsed message content
 * @return {Void}                           this function returns anything.
 */
function* handleAddPhotoComment(content) {
  // check if there is already an action created for specified object
  const existing = yield r.table(Action.getTableName())
    .getAll([content.commentId, content.action], { index: 'object_verb' }).nth(0)
    .default(null)
    .run();

  if (existing) {
    // push to actor feeds
    yield feedManager.pushToFollowers(content.auth.userId, existing.id);
  } else {
    // create user action
    const action = yield Action.save({
      actor: content.auth.userId,
      verb: content.action,
      object: content.commentId,
    });
    // push to actor feeds
    yield feedManager.pushToFollowers(content.auth.userId, action.id);
  }
}

/**
 * Consume the message
 *
 * @param  {Object}       content           the parsed message content
 * @param  {Object}       msg               the message that is received on the queue
 * @param  {Object}       channel           the connection channel
 * @return {Void}                           this function returns anything.
 */
function consume(content, msg, channel) {
  if (_.isObjectLike(content.auth) && _.isString(content.action) &&
    (_.isString(content.activityId) || _.isString(content.commentId))) {
    co(function* consumeWrapped() {
      switch (content.action) {
        case USER_ACTIONS_VERBS.join:
          yield handleAddRsvp(content, msg, channel);
          break;
        case USER_ACTIONS_VERBS.remove_rsvp:
          yield handleRemoveRsvp(content, msg, channel);
          break;
        case USER_ACTIONS_VERBS.photo_comment:
          yield handleAddPhotoComment(content, msg, channel);
          break;
        default:
          logger.info('skip activity update processing, invalid action specified [%s]', content.action);
      }
    }).then(() => {
      logger.info('activity update message successfully processed', helper.stringify(content));
      channel.ack(msg);
    }).catch((err) => {
      logger.error(`Error consuming activity updated message, deliveryTag ${msg.fields.deliveryTag}`, helper.stringify(err));
      channel.nack(msg);
    });
  } else {
    logger.warn('skip activity updated message processing, mandatory arguments missing');
    channel.ack(msg);
  }
}

module.exports = {
  consume,
};
