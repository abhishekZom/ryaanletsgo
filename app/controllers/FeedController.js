/*
 * Copyright (C) 2017 lets., All Rights Reserved.
 */

'use strict';

/**
 * Exposes feeds API's
 *
 * @author      TSCCODER
 * @version     1.0.0
 */

const httpStatus = require('http-status');
const feedService = require('../services/FeedService');

/**
 * Get public feeds
 * Get all the public feeds. This API supports pagination response
 *
 * @param   {Object}    req           express request instance
 * @param   {Object}    res           express response instance
 * @return  {Void}                    this method doesn't return anything
 */
function* getPublicFeeds(req, res) {
  res.status(httpStatus.OK).json(yield feedService.getPublicFeeds(req.auth, req.query));
}

/**
 * Get my feeds
 * Get my feeds. This API supports paginated response
 *
 * @param   {Object}    req           express request instance
 * @param   {Object}    res           express response instance
 * @return  {Void}                    this method doesn't return anything
 */
function* getMyFeeds(req, res) {
  res.status(httpStatus.OK).json(yield feedService.getMyFeeds(req.auth, req.query));
}

/**
 * Get a user's profile feeds
 * Profile feeds includes those activities that are authored by user
 *
 * @param   {Object}    req           express request instance
 * @param   {Object}    res           express response instance
 * @return  {Void}                    this method doesn't return anything
 */
function* getProfileFeeds(req, res) {
  res.status(httpStatus.OK).json(yield feedService.getProfileFeeds(req.auth, req.params.userId, req.query));
}

/**
 * Get a user's upcoming feeds
 * Upcoming feeds are those activities for which the expiry time is in future and
 * which are authored by user or user rsvp to the activity.
 *
 * @param   {Object}    req           express request instance
 * @param   {Object}    res           express response instance
 * @return  {Void}                    this method doesn't return anything
 */
function* getUpcomingFeeds(req, res) {
  res.status(httpStatus.OK).json(yield feedService.getUpcomingFeeds(req.auth, req.params.userId, req.query));
}

module.exports = {
  getPublicFeeds,
  getMyFeeds,
  getProfileFeeds,
  getUpcomingFeeds,
};
