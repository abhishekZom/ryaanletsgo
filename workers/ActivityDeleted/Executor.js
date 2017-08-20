/*
 * Copyright (C) 2017 lets., All Rights Reserved.
 */

'use strict';

/**
 * The executor for the activity deleted message
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

const r = models.r;
const ActivityInvitee = models.ActivityInvitee;
const ActivityLike = models.ActivityLike;
const ActivityPhoto = models.ActivityPhoto;
const ActivityRsvp = models.ActivityRsvp;
const Action = models.Action;
const Comment = models.Comment;
const Feed = models.Feed;

/**
 * Delete the activity data
 * @private
 *
 * @param  {String}        activityId       the activity id which is deleted
 * @return {Void}                           this function returns anything.
 */
function* deleteActivityData(activityId) {
  yield r.table(ActivityInvitee.getTableName()).getAll(activityId, { index: 'activityId' }).delete().run();
  yield r.table(ActivityLike.getTableName()).getAll(activityId, { index: 'activityId' }).delete().run();
  yield r.table(ActivityPhoto.getTableName()).getAll(activityId, { index: 'activityId' }).delete().run();
  yield r.table(ActivityRsvp.getTableName()).getAll(activityId, { index: 'activityId' }).delete().run();
  yield r.table(Comment.getTableName()).getAll(activityId, { index: 'activityId' }).delete().run();
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
  if (_.isObjectLike(content.auth) && _.isString(content.activityId) && _.isString(content.action)) {
    co(function* consumeWrapped() {
      // get all the photo comments for activity
      const commentIds = yield r.table(Comment.getTableName())
        .getAll(content.activityId, { index: 'activityId' }).hasFields('photos')
        .map(item => item('id'))
        .run();

      // get all the actions for the activity object
      const actionIds = yield r.table(Action.getTableName())
        .getAll(content.activityId, { index: 'object' }).pluck('id')
        .map(item => item('id'))
        .run();

      // get all the actions for specified comment ids
      const commentActionIds = yield r.table(Action.getTableName())
        .getAll(commentIds, { index: 'object' }).pluck('id')
        .map(item => item('id'))
        .run();

      // delete all the feeds for the specified action ids
      yield r.table(Feed.getTableName()).getAll(actionIds, { index: 'referenceId' }).delete().run();
      yield r.table(Feed.getTableName()).getAll(commentActionIds, { index: 'referenceId' }).delete().run();

      // delete the actions
      yield r.table(Action.getTableName()).getAll(content.activityId, { index: 'object' }).delete().run();
      yield r.table(Action.getTableName()).getAll(commentIds, { index: 'object' }).delete().run();

      // delete any referenced data
      yield deleteActivityData(content.activityId);
    }).then(() => {
      logger.info('activity deleted message successfully processed', helper.stringify(content));
      channel.ack(msg);
    }).catch((err) => {
      logger.error(`Error consuming activity updated message, deliveryTag ${msg.fields.deliveryTag}`, helper.stringify(err));
      channel.nack(msg);
    });
  } else {
    logger.warn('skip activity deleted message processing, mandatory arguments missing');
    channel.ack(msg);
  }
}

module.exports = {
  consume,
};
