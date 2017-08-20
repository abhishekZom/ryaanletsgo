/*
 * Copyright (C) 2017 lets., All Rights Reserved.
 */

'use strict';

/**
 * Exposes activities API's
 *
 * @author      TSCCODER
 * @version     1.0.0
 */

const httpStatus = require('http-status');
const activityService = require('../services/ActivityService');

/**
 * Create an activity, the currently logged in user is the author of activity
 *
 * @param   {Object}    req           express request instance
 * @param   {Object}    res           express response instance
 * @return  {Void}                    this method doesn't return anything
 */
function* createActivity(req, res) {
  res.status(httpStatus.CREATED).json(yield activityService.createActivity(req.auth, req.body));
}

/**
 * Get an activity detail
 *
 * @param   {Object}    req           express request instance
 * @param   {Object}    res           express response instance
 * @return  {Void}                    this method doesn't return anything
 */
function* getActivityDetail(req, res) {
  res.status(httpStatus.OK).json(yield activityService.getActivityDetail(req.auth, req.params.activityId));
}

/**
 * Delete an activity.
 * User can only delete self authored activities
 *
 * @param   {Object}    req           express request instance
 * @param   {Object}    res           express response instance
 * @return  {Void}                    this method doesn't return anything
 */
function* deleteActivity(req, res) {
  res.status(httpStatus.NO_CONTENT).json(yield activityService.deleteActivity(req.auth,
    req.params.activityId));
}

/**
 * Edit an activity details.
 * User can only edit self authored activities details
 *
 * @param   {Object}    req           express request instance
 * @param   {Object}    res           express response instance
 * @return  {Void}                    this method doesn't return anything
 */
function* updateActivity(req, res) {
  res.status(httpStatus.OK).json(yield activityService.updateActivity(req.auth,
    req.params.activityId, req.body));
}

/**
 * Modify activity invitees list.
 * Modify activity invitees list.
 * This api supports invitees and removals parameters, specify the user id's in removals if you want to remove
 * a user from the list
 *
 * @param   {Object}    req           express request instance
 * @param   {Object}    res           express response instance
 * @return  {Void}                    this method doesn't return anything
 */
function* addInvitees(req, res) {
  res.status(httpStatus.OK).json(yield activityService.addInvitees(req.auth,
    req.params.activityId, req.body));
}

/**
 * Get activity invitees list
 * Get list of users invitied to the specified activity
 *
 * @param   {Object}    req           express request instance
 * @param   {Object}    res           express response instance
 * @return  {Void}                    this method doesn't return anything
 */
function* getInvitees(req, res) {
  res.status(httpStatus.OK).json(yield activityService.getInvitees(req.auth, req.params.activityId, req.query));
}

/**
 * Add additional photos to the activity
 *
 * @param   {Object}    req           express request instance
 * @param   {Object}    res           express response instance
 * @return  {Void}                    this method doesn't return anything
 */
function* addPhotos(req, res) {
  res.status(httpStatus.OK).json(yield activityService.addPhotos(req.auth,
    req.params.activityId, req.files));
}

/**
 * Get all activity photos
 * Get all the photos uploaded for the specified activity, this includes comment photos
 *
 * @param   {Object}    req           express request instance
 * @param   {Object}    res           express response instance
 * @return  {Void}                    this method doesn't return anything
 */
function* getPhotos(req, res) {
  res.status(httpStatus.OK).json(yield activityService.getPhotos(req.auth, req.params.activityId, req.query));
}

/**
 * RSVP to the activity
 * Add currently logged in user to the list of rsvp'd users list
 *
 * @param   {Object}    req           express request instance
 * @param   {Object}    res           express response instance
 * @return  {Void}                    this method doesn't return anything
 */
function* addRsvp(req, res) {
  res.status(httpStatus.OK).json(yield activityService.addRsvp(req.auth, req.params.activityId));
}

/**
 * Undo RSVP to the activity
 * Remove currently logged in user from the list of rsvp'd users.
 *
 * @param   {Object}    req           express request instance
 * @param   {Object}    res           express response instance
 * @return  {Void}                    this method doesn't return anything
 */
function* removeRsvp(req, res) {
  res.status(httpStatus.OK).json(yield activityService.removeRsvp(req.auth, req.params.activityId));
}

/**
 * Share an activity
 * Share an activity, the activity that is shared is the parent activity of newly created activity.
 * Current user is the author of shared activity.
 *
 * @param   {Object}    req           express request instance
 * @param   {Object}    res           express response instance
 * @return  {Void}                    this method doesn't return anything
 */
function* shareActivity(req, res) {
  res.status(httpStatus.CREATED).json(yield activityService.shareActivity(req.auth,
    req.params.activityId, req.body));
}

/**
 * Like an activity
 * Like an activity, the activity is liked by the current logged in user.
 *
 * @param   {Object}    req           express request instance
 * @param   {Object}    res           express response instance
 * @return  {Void}                    this method doesn't return anything
 */
function* likeActivity(req, res) {
  res.status(httpStatus.OK).json(yield activityService.likeActivity(req.auth, req.params.activityId));
}

/**
 * Dislike an activity
 * Dislike an activity, the activity is disliked by the current logged in user.
 *
 * @param   {Object}    req           express request instance
 * @param   {Object}    res           express response instance
 * @return  {Void}                    this method doesn't return anything
 */
function* dislikeActivity(req, res) {
  res.status(httpStatus.OK).json(yield activityService.dislikeActivity(req.auth, req.params.activityId));
}

/**
 * Get comments for an activity
 * Get all the comments for an activity.
 * This API supports paginated response
 *
 * @param   {Object}    req           express request instance
 * @param   {Object}    res           express response instance
 * @return  {Void}                    this method doesn't return anything
 */
function* getComments(req, res) {
  res.status(httpStatus.OK).json(yield activityService.getComments(req.auth, req.params.activityId, req.query));
}

/**
 * Get an activity likes
 * Get all the likes for an activity.
 * This API supports paginated response
 *
 * @param   {Object}    req           express request instance
 * @param   {Object}    res           express response instance
 * @return  {Void}                    this method doesn't return anything
 */
function* getLikes(req, res) {
  res.status(httpStatus.OK).json(yield activityService.getLikes(req.auth, req.params.activityId, req.query));
}

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
