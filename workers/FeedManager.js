/*
 * Copyright (C) 2017 lets., All Rights Reserved.
 */

'use strict';

/**
 * This module exposes API's to manipulate a user's feeds
 *
 * @author      TSCCODER
 * @version     1.0.0
 */
const co = require('co');
const helper = require('./common/Helper');
const config = require('config');

/**
 * Default constructor
 *
 * @param   {Object}          models              the datasource models instance
 * @return  {Void}                                this method does not return anything
 */
function FeedManager(models) {
  this.models = models;
}

/**
 * Push a feed to all user's followers
 * @param   {String}          userId              the user id to push to followers
 * @param   {String}          actionId            the user action reference id to push to followers
 * @return  {Promise}                             Promise which is resolved after operation completes
 */
FeedManager.prototype.pushToFollowers = function pushToFollowers(userId, actionId) {
  const UserFollower = this.models.UserFollower;
  const Feed = this.models.Feed;
  const r = this.models.r;

  return co(function* pushToFollowersWrapped() {
    // get all the users followers
    const followers = yield r.table(UserFollower.getTableName())
      .getAll([userId, 1], { index: 'userId_status' }).run();

    const feeds = followers.map(single => ({ userId: single.followerId, referenceId: actionId }));
    // just to be on safe side to avoid duplicate feeds
    // probably some error occured last time, reprocess feeds again, delete old feeds and reinsert
    yield r.table(Feed.getTableName()).getAll(actionId, { index: 'referenceId' }).delete().run();
    // by default actor should be included in feeds
    feeds.push({ userId, referenceId: actionId });
    // process feeds in batches
    yield helper.batchInsert(Feed, feeds, config.BATCH_SIZE);
  });
};

module.exports = FeedManager;
