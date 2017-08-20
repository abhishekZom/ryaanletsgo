/*
 * Copyright (C) 2017 lets., All Rights Reserved.
 */

'use strict';

/**
 * The executor for the activity created message
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

const r = models.r;
const Action = models.Action;

const feedManager = new FeedManager(models);

/**
 * Consume the message
 * TODO: Do we need to add following actions to feeds
 * 1. author joined the activity
 * 2. Publich this action to all of the author's followers.
 *
 * This depend on whether we need to shown "author joined the activity" feed in author's followers feed
 *
 *
 * @param  {Object}       content           the parsed message content
 * @param  {Object}       msg               the message that is received on the queue
 * @param  {Object}       channel           the connection channel
 * @return {Void}                           this function returns anything.
 */
function consume(content, msg, channel) {
  if (_.isObjectLike(content.auth) && _.isString(content.activityId) && _.isString(content.action)) {
    co(function* consumeWrapped() {
      // check if there is already an action created for specified object
      const existing = yield r.table(Action.getTableName())
        .getAll([content.activityId, content.action], { index: 'object_verb' }).nth(0)
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
    }).then(() => {
      logger.info('activity created message successfully processed', helper.stringify(content));
      channel.ack(msg);
    }).catch((err) => {
      logger.error(`Error consuming activity created message, deliveryTag ${msg.fields.deliveryTag}`, helper.stringify(err));
      channel.nack(msg);
    });
  } else {
    logger.warn('skip activity created message processing, mandatory arguments missing');
    channel.ack(msg);
  }
}

module.exports = {
  consume,
};
