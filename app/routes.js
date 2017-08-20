/*
 * Copyright (C) 2017 lets., All Rights Reserved.
 */

'use strict';

/**
 * Exposes the application routes
 *
 * @author      TSCCODER
 * @version     1.0.0
 */

const auth = require('./middlewares/Auth.js');
const uuid = require('uuid');

const multer = require('multer');

const storage = multer.diskStorage({
  filename: (req, file, cb) => {
    cb(null, `${uuid.v4()}_${file.originalname}`);
  },
});

const upload = multer({ storage });

module.exports = {
  '/login': {
    post: {
      controller: 'UserController',
      method: 'login',
    },
  },
  '/login/social/google': {
    post: {
      controller: 'UserController',
      method: 'googleLogin',
    },
  },
  '/login/social/facebook': {
    post: {
      controller: 'UserController',
      method: 'facebookLogin',
    },
  },
  '/signup': {
    post: {
      controller: 'UserController',
      method: 'signup',
    },
  },
  // send the forgot password email to the user, to let him/her reset the password
  '/forgot-password': {
    post: {
      controller: 'UserController',
      method: 'forgotPassword',
    },
  },
  // reset forgotten password, after the user received the forgotten password
  '/reset-password': {
    post: {
      controller: 'UserController',
      method: 'resetPassword',
    },
  },
  '/users/:id': {
    get: {
      controller: 'UserController',
      middleware: [auth()],
      method: 'getUserInfo',
    },
  },
  // get my followers, users who are following the following
  '/users/:id/followers': {
    get: {
      controller: 'UserController',
      middleware: [auth()],
      method: 'getUserFollowers',
    },
    post: {
      controller: 'UserController',
      middleware: [auth()],
      method: 'addUserFollower',
    },
    delete: {
      controller: 'UserController',
      middleware: [auth()],
      method: 'deleteUserFollower',
    },
  },
  '/users/:id/followers/approve': {
    post: {
      controller: 'UserController',
      middleware: [auth()],
      method: 'approveFollowerRequest',
    },
  },
  '/users/:id/followers/reject': {
    post: {
      controller: 'UserController',
      middleware: [auth()],
      method: 'rejectFollowerRequest',
    },
  },
  // get my followings, users who I am following
  '/users/:id/followings': {
    get: {
      controller: 'UserController',
      middleware: [auth()],
      method: 'getUserFollowings',
    },
  },
  '/users/:id/block-list': {
    post: {
      controller: 'UserController',
      middleware: [auth()],
      method: 'addToBlockList',
    },
    delete: {
      controller: 'UserController',
      middleware: [auth()],
      method: 'deleteFromBlockList',
    },
  },
  '/users/:id/profile': {
    get: {
      controller: 'UserController',
      middleware: [auth()],
      method: 'getUserProfile',
    },
    put: {
      controller: 'UserController',
      middleware: [auth()],
      method: 'updateUserProfile',
    },
  },
  '/users/:id/calendars': {
    get: {
      controller: 'UserController',
      middleware: [auth()],
      method: 'getUserLinkedCalendars',
    },
    post: {
      controller: 'UserController',
      middleware: [auth()],
      method: 'addUserLinkedCalendar',
    },
  },
  '/users/:id/social/accounts': {
    get: {
      controller: 'UserController',
      middleware: [auth()],
      method: 'getUserSocialConnections',
    },
    post: {
      controller: 'UserController',
      middleware: [auth()],
      method: 'addUserSocialConnection',
    },
  },
  '/users/:id/profile/photos': {
    post: {
      controller: 'UserController',
      middleware: [auth(), upload.single('file')],
      method: 'addUserProfilePhoto',
    },
  },
  '/users/:id/send-verification-code': {
    post: {
      controller: 'UserController',
      middleware: [auth()],
      method: 'sendVerificationCode',
    },
  },
  '/users/:id/verify-code': {
    post: {
      controller: 'UserController',
      middleware: [auth()],
      method: 'verifyCode',
    },
  },
  '/users/verify-email': {
    post: {
      controller: 'UserController',
      method: 'verifyEmail',
    },
  },
  '/users/refresh-token': {
    post: {
      controller: 'UserController',
      middleware: [auth()],
      method: 'refreshToken',
    },
  },
  '/users/:id/notification-preferences': {
    get: {
      controller: 'UserController',
      middleware: [auth()],
      method: 'getUserNotificationPreferences',
    },
    put: {
      controller: 'UserController',
      middleware: [auth()],
      method: 'updateUserNotificationPreferences',
    },
  },
  '/users/:id/friends': {
    get: {
      controller: 'UserController',
      middleware: [auth()],
      method: 'getUserFriends',
    },
  },
  '/users/:id/contacts/sync': {
    post: {
      controller: 'UserController',
      middleware: [auth()],
      method: 'syncUserContacts',
    },
  },
  '/activities': {
    post: {
      controller: 'ActivityController',
      middleware: [auth()],
      method: 'createActivity',
    },
  },
  '/activities/:activityId': {
    get: {
      controller: 'ActivityController',
      middleware: [auth()],
      method: 'getActivityDetail',
    },
    delete: {
      controller: 'ActivityController',
      middleware: [auth()],
      method: 'deleteActivity',
    },
    put: {
      controller: 'ActivityController',
      middleware: [auth()],
      method: 'updateActivity',
    },
  },
  '/activities/:activityId/invitees': {
    post: {
      controller: 'ActivityController',
      middleware: [auth()],
      method: 'addInvitees',
    },
    get: {
      controller: 'ActivityController',
      middleware: [auth()],
      method: 'getInvitees',
    },
  },
  '/activities/:activityId/photos': {
    get: {
      controller: 'ActivityController',
      middleware: [auth()],
      method: 'getPhotos',
    },
    post: {
      controller: 'ActivityController',
      middleware: [auth(), upload.any()],
      method: 'addPhotos',
    },
  },
  '/activities/:activityId/rsvp/add': {
    post: {
      controller: 'ActivityController',
      middleware: [auth()],
      method: 'addRsvp',
    },
  },
  '/activities/:activityId/rsvp/remove': {
    post: {
      controller: 'ActivityController',
      middleware: [auth()],
      method: 'removeRsvp',
    },
  },
  '/activities/:activityId/share': {
    post: {
      controller: 'ActivityController',
      middleware: [auth()],
      method: 'shareActivity',
    },
  },
  '/activities/:activityId/comments': {
    post: {
      controller: 'CommentController',
      middleware: [auth()],
      method: 'addComment',
    },
    get: {
      controller: 'ActivityController',
      middleware: [auth()],
      method: 'getComments',
    },
  },
  '/activities/:activityId/likes': {
    post: {
      controller: 'ActivityController',
      middleware: [auth()],
      method: 'likeActivity',
    },
    get: {
      controller: 'ActivityController',
      middleware: [auth()],
      method: 'getLikes',
    },
  },
  '/activities/:activityId/dislikes': {
    post: {
      controller: 'ActivityController',
      middleware: [auth()],
      method: 'dislikeActivity',
    },
  },
  '/activities/:activityId/comments/:commentId/comments': {
    post: {
      controller: 'CommentController',
      middleware: [auth()],
      method: 'addCommentOnComment',
    },
    get: {
      controller: 'CommentController',
      middleware: [auth()],
      method: 'getCommentsForComment',
    },
  },
  '/activities/:activityId/comments/:commentId/likes': {
    post: {
      controller: 'CommentController',
      middleware: [auth()],
      method: 'likeComment',
    },
    get: {
      controller: 'CommentController',
      middleware: [auth()],
      method: 'getLikes',
    },
  },
  '/activities/:activityId/comments/:commentId/dislikes': {
    post: {
      controller: 'CommentController',
      middleware: [auth()],
      method: 'dislikeComment',
    },
  },
  '/activities/:activityId/comments/:commentId/photos': {
    post: {
      controller: 'CommentController',
      middleware: [auth(), upload.any()],
      method: 'addPhotoToComment',
    },
  },
  '/groups': {
    post: {
      controller: 'GroupController',
      middleware: [auth()],
      method: 'createGroup',
    },
  },
  '/groups/:groupId': {
    get: {
      controller: 'GroupController',
      middleware: [auth()],
      method: 'getGroupDetail',
    },
    put: {
      controller: 'GroupController',
      middleware: [auth()],
      method: 'editGroup',
    },
    delete: {
      controller: 'GroupController',
      middleware: [auth()],
      method: 'deleteGroup',
    },
  },
  '/feeds/public': {
    get: {
      controller: 'FeedController',
      middleware: [auth()],
      method: 'getPublicFeeds',
    },
  },
  '/users/me/feeds': {
    get: {
      controller: 'FeedController',
      middleware: [auth()],
      method: 'getMyFeeds',
    },
  },
  '/users/:userId/profile/feeds': {
    get: {
      controller: 'FeedController',
      middleware: [auth()],
      method: 'getProfileFeeds',
    },
  },
  '/users/:userId/upcoming/feeds': {
    get: {
      controller: 'FeedController',
      middleware: [auth()],
      method: 'getUpcomingFeeds',
    },
  },
};
