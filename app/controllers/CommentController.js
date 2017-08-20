/*
 * Copyright (C) 2017 lets., All Rights Reserved.
 */

'use strict';

/**
 * Exposes comments API's
 *
 * @author      TSCCODER
 * @version     1.0.0
 */

const httpStatus = require('http-status');
const commentService = require('../services/CommentService');

/**
 * Add a comment to an activity
 * Add a comment to an activity. The comment can have photo or text
 *
 * @param   {Object}    req           express request instance
 * @param   {Object}    res           express response instance
 * @return  {Void}                    this method doesn't return anything
 */
function* addComment(req, res) {
  res.status(httpStatus.CREATED).json(yield commentService.addComment(req.auth,
    req.params.activityId, req.body));
}

/**
 * Add a comment to a comment
 * Users can only add additional comments to photo comments
 *
 * @param   {Object}    req           express request instance
 * @param   {Object}    res           express response instance
 * @return  {Void}                    this method doesn't return anything
 */
function* addCommentOnComment(req, res) {
  res.status(httpStatus.CREATED).json(yield commentService.addCommentOnComment(req.auth,
    req.params.activityId, req.params.commentId, req.body));
}

/**
 * Like a comment
 * Like a comment, the comment is liked by the current logged in user.
 *
 * @param   {Object}    req           express request instance
 * @param   {Object}    res           express response instance
 * @return  {Void}                    this method doesn't return anything
 */
function* likeComment(req, res) {
  res.status(httpStatus.OK).json(yield commentService.likeComment(req.auth,
    req.params.activityId, req.params.commentId));
}

/**
 * Dislike a comment
 * Dislike a comment, the comment is disliked by the current logged in user.
 *
 * @param   {Object}    req           express request instance
 * @param   {Object}    res           express response instance
 * @return  {Void}                    this method doesn't return anything
 */
function* dislikeComment(req, res) {
  res.status(httpStatus.OK).json(yield commentService.dislikeComment(req.auth,
    req.params.activityId, req.params.commentId));
}

/**
 * Add photos to a comment
 * The files to uploaded and resized.
 * The current swagger specification does not allow to specify multiple file uploads.
 * This is a limitation for this spec but server does supports multiple file upload.
 *
 * @param   {Object}    req           express request instance
 * @param   {Object}    res           express response instance
 * @return  {Void}                    this method doesn't return anything
 */
function* addPhotoToComment(req, res) {
  res.status(httpStatus.OK).json(yield commentService.addPhotoToComment(req.auth, req.params.activityId,
    req.params.commentId, req.files));
}

/**
 * Get comments for a comment
 * Get all the comments for a comment
 * This API supports paginated response
 *
 * @param   {Object}    req           express request instance
 * @param   {Object}    res           express response instance
 * @return  {Void}                    this method doesn't return anything
 */
function* getCommentsForComment(req, res) {
  res.status(httpStatus.OK).json(yield commentService.getCommentsForComment(req.auth,
    req.params.activityId, req.params.commentId, req.query));
}

/**
 * Get a comment likes
 * Get all the likes for a comment.
 * This API supports paginated response
 *
 * @param   {Object}    req           express request instance
 * @param   {Object}    res           express response instance
 * @return  {Void}                    this method doesn't return anything
 */
function* getLikes(req, res) {
  res.status(httpStatus.OK).json(yield commentService.getLikes(req.auth,
    req.params.activityId, req.params.commentId, req.query));
}

module.exports = {
  addComment,
  addCommentOnComment,
  likeComment,
  dislikeComment,
  addPhotoToComment,
  getCommentsForComment,
  getLikes,
};
