/*
 * Copyright (C) 2017 lets., All Rights Reserved.
 */

'use strict';

/**
 * Exposes user API's
 *
 * @author      TSCCODER
 * @version     1.0.0
 */

const httpStatus = require('http-status');
const userService = require('../services/UserService');

/**
 * Authenticate a user and issue bearer access token
 *
 * @param   {Object}    req           express request instance
 * @param   {Object}    res           express response instance
 * @return  {Void}                    this method doesn't return anything
 */
function* login(req, res) {
  const response = yield userService.login(req.body);
  res.status(response.status || httpStatus.OK).json(response.model);
}

/**
 * Signup a user using normal email flow
 *
 * @param   {Object}    req           express request instance
 * @param   {Object}    res           express response instance
 * @return  {Void}                    this method doesn't return anything
 */
function* signup(req, res) {
  res.status(httpStatus.CREATED).json(yield userService.signup(req.body, req.query.force));
}

/**
 * Login a user using google oauth2 flow
 *
 * @param   {Object}    req           express request instance
 * @param   {Object}    res           express response instance
 * @return  {Void}                    this method doesn't return anything
 */
function* googleLogin(req, res) {
  const response = yield userService.googleLogin(req.body);
  res.status(response.status || httpStatus.OK).json(response.model);
}

/**
 * Login a user using facebook oauth2 flow
 *
 * @param   {Object}    req           express request instance
 * @param   {Object}    res           express response instance
 * @return  {Void}                    this method doesn't return anything
 */
function* facebookLogin(req, res) {
  const response = yield userService.facebookLogin(req.body);
  res.status(response.status || httpStatus.OK).json(response.model);
}

/**
 * Send forgot password email to user email address.
 * This API is used to initiate forgot password flow
 *
 * @param   {Object}    req           express request instance
 * @param   {Object}    res           express response instance
 * @return  {Void}                    this method doesn't return anything
 */
function* forgotPassword(req, res) {
  res.json(yield userService.forgotPassword(req.body));
}

/**
 * Reset forgotten password.
 * This API is used to set the new password using password reset code sent to user's email address
 *
 * @param   {Object}    req           express request instance
 * @param   {Object}    res           express response instance
 * @return  {Void}                    this method doesn't return anything
 */
function* resetPassword(req, res) {
  res.json(yield userService.resetPassword(req.body));
}

/**
 * Get the currently logged in user followers
 *
 * @param   {Object}    req           express request instance
 * @param   {Object}    res           express response instance
 * @return  {Void}                    this method doesn't return anything
 */
function* getUserFollowers(req, res) {
  res.json(yield userService.getUserFollowers(req.auth, req.params.id, req.query));
}

/**
 * Add users as followers
 * The list of user ids are added as current auth user followers
 *
 * @param   {Object}    req           express request instance
 * @param   {Object}    res           express response instance
 * @return  {Void}                    this method doesn't return anything
 */
function* addUserFollower(req, res) {
  res.json(yield userService.addUserFollower(req.auth, req.params.id, req.body));
}

/**
 * Remove users from followers list
 * The list of user ids are removed as current auth user followers
 *
 * @param   {Object}    req           express request instance
 * @param   {Object}    res           express response instance
 * @return  {Void}                    this method doesn't return anything
 */
function* deleteUserFollower(req, res) {
  res.json(yield userService.deleteUserFollower(req.auth, req.params.id, req.body));
}

/**
 * Approve a user follower request
 * If the user has turned on approveFollower setting than each of the follower requests must be explicitly approved
 *
 * @param   {Object}    req           express request instance
 * @param   {Object}    res           express response instance
 * @return  {Void}                    this method doesn't return anything
 */
function* approveFollowerRequest(req, res) {
  res.json(yield userService.approveFollowerRequest(req.auth, req.params.id, req.body));
}

/**
 * Reject a user follower request
 * If the user has turned on approveFollower setting than each of the follower requests
 * must be explicitly approved or rejected
 *
 * @param   {Object}    req           express request instance
 * @param   {Object}    res           express response instance
 * @return  {Void}                    this method doesn't return anything
 */
function* rejectFollowerRequest(req, res) {
  res.json(yield userService.rejectFollowerRequest(req.auth, req.params.id, req.body));
}

/**
 * Get currently logged in users followings
 *
 * @param   {Object}    req           express request instance
 * @param   {Object}    res           express response instance
 * @return  {Void}                    this method doesn't return anything
 */
function* getUserFollowings(req, res) {
  res.json(yield userService.getUserFollowings(req.auth, req.params.id, req.query));
}

/**
 * Get a user info
 * Get user info returns lesser details than the get user profile API
 *
 * @param   {Object}    req           express request instance
 * @param   {Object}    res           express response instance
 * @return  {Void}                    this method doesn't return anything
 */
function* getUserInfo(req, res) {
  res.json(yield userService.getUserInfo(req.auth, req.params.id));
}

/**
 * Get currently logged in user profile
 *
 * @param   {Object}    req           express request instance
 * @param   {Object}    res           express response instance
 * @return  {Void}                    this method doesn't return anything
 */
function* getUserProfile(req, res) {
  res.json(yield userService.getUserProfile(req.auth, req.params.id));
}

/**
 * Send verification code to user's phone number
 *
 * @param   {Object}    req           express request instance
 * @param   {Object}    res           express response instance
 * @return  {Void}                    this method doesn't return anything
 */
function* sendVerificationCode(req, res) {
  res.json(yield userService.sendVerificationCode(req.auth, req.body, req.params.id));
}

/**
 * Verify the verification code send to user's phone number
 *
 * @param   {Object}    req           express request instance
 * @param   {Object}    res           express response instance
 * @return  {Void}                    this method doesn't return anything
 */
function* verifyCode(req, res) {
  res.json(yield userService.verifyCode(req.auth, req.body, req.params.id));
}

/**
 * Verify the user's email address
 *
 * @param   {Object}    req           express request instance
 * @param   {Object}    res           express response instance
 * @return  {Void}                    this method doesn't return anything
 */
function* verifyEmail(req, res) {
  res.json(yield userService.verifyEmail(req.body));
}

/**
 * Refresh the bearer access token abd issue a new bearer access token
 *
 * @param   {Object}    req           express request instance
 * @param   {Object}    res           express response instance
 * @return  {Void}                    this method doesn't return anything
 */
function* refreshToken(req, res) {
  res.json(yield userService.refreshToken(req.auth));
}

/**
 * Get logged in user notification preferences
 *
 * @param   {Object}    req           express request instance
 * @param   {Object}    res           express response instance
 * @return  {Void}                    this method doesn't return anything
 */
function* getUserNotificationPreferences(req, res) {
  res.json(yield userService.getUserNotificationPreferences(req.auth, req.params.id));
}

/**
 * Update the logged in user notification preferences
 *
 * @param   {Object}    req           express request instance
 * @param   {Object}    res           express response instance
 * @return  {Void}                    this method doesn't return anything
 */
function* updateUserNotificationPreferences(req, res) {
  res.json(yield userService.updateUserNotificationPreferences(req.auth, req.params.id, req.body));
}

/**
 * Update the user's profile. User profile includes bio, name etc
 *
 * @param   {Object}    req           express request instance
 * @param   {Object}    res           express response instance
 * @return  {Void}                    this method doesn't return anything
 */
function* updateUserProfile(req, res) {
  res.json(yield userService.updateUserProfile(req.auth, req.params.id, req.body));
}

/**
 * Get a user's linked calendars details. This includes user settings of default activity duration.
 *
 * @param   {Object}    req           express request instance
 * @param   {Object}    res           express response instance
 * @return  {Void}                    this method doesn't return anything
 */
function* getUserLinkedCalendars(req, res) {
  res.json(yield userService.getUserLinkedCalendars(req.auth, req.params.id));
}

/**
 * Add a new linked calendar to user's account.
 * Initially when user is first created there won't be any linked calendars.
 * This API add a new linked calendar to user account if calendar does not already added.
 * If the calendar with specified type already added than update the existing record.
 * See the request/response payload in api definition
 *
 * @param   {Object}    req           express request instance
 * @param   {Object}    res           express response instance
 * @return  {Void}                    this method doesn't return anything
 */
function* addUserLinkedCalendar(req, res) {
  res.json(yield userService.addUserLinkedCalendar(req.auth, req.params.id, req.body));
}

/**
 * Get a user's linked social accounts.
 *
 * @param   {Object}    req           express request instance
 * @param   {Object}    res           express response instance
 * @return  {Void}                    this method doesn't return anything
 */
function* getUserSocialConnections(req, res) {
  res.json(yield userService.getUserSocialConnections(req.auth, req.params.id));
}


/**
 * Add a new social connection to user's account.
 * The client ios app must initiate the oauth2 flow with the corresponding social provider and must
 * finish the oauth2 flow before consuming this api. Social access token is mandatory for this api.
 * NOTE: This access token will be verified at server.
 *
 * @param   {Object}    req           express request instance
 * @param   {Object}    res           express response instance
 * @return  {Void}                    this method doesn't return anything
 */
function* addUserSocialConnection(req, res) {
  res.status(httpStatus.CREATED).json(yield userService.addUserSocialConnection(req.auth, req.params.id, req.body));
}

/**
 * Add a photo to a user profile
 * The files to uploaded and resized.
 * The server only supports single file for the API.
 *
 * @param   {Object}    req           express request instance
 * @param   {Object}    res           express response instance
 * @return  {Void}                    this method doesn't return anything
 */
function* addUserProfilePhoto(req, res) {
  res.json(yield userService.addUserProfilePhoto(req.auth, req.params.id, req.file));
}

/**
 * The user can sync his contacts using `/contacts/sync` API.
 * This API returns previously synced contacts and is very fast than sync api.
 *
 * @param   {Object}    req           express request instance
 * @param   {Object}    res           express response instance
 * @return  {Void}                    this method doesn't return anything
 */
function* getUserFriends(req, res) {
  res.json(yield userService.getUserFriends(req.auth, req.params.id));
}

/**
 * Sync user external contacts with app users data
 * Request payload specify user phonebook data
 * Server will fetch user contacts from facebook/google combine phonebook data with social contacts
 * and resolve references to app users if there is any
 *
 * @param   {Object}    req           express request instance
 * @param   {Object}    res           express response instance
 * @return  {Void}                    this method doesn't return anything
 */
function* syncUserContacts(req, res) {
  res.json(yield userService.syncUserContacts(req.auth, req.params.id, req.body));
}

/**
 * Add users to current auth user block list
 * The list of user ids are added in current auth user block list
 *
 * @param   {Object}    req           express request instance
 * @param   {Object}    res           express response instance
 * @return  {Void}                    this method doesn't return anything
 */
function* addToBlockList(req, res) {
  res.json(yield userService.addToBlockList(req.auth, req.params.id, req.body));
}

/**
 * Remove users from block list
 * The list of user ids are removed from current auth user block list
 *
 * @param   {Object}    req           express request instance
 * @param   {Object}    res           express response instance
 * @return  {Void}                    this method doesn't return anything
 */
function* deleteFromBlockList(req, res) {
  res.json(yield userService.deleteFromBlockList(req.auth, req.params.id, req.body));
}

module.exports = {
  login,
  googleLogin,
  facebookLogin,
  signup,
  forgotPassword,
  resetPassword,
  getUserFollowers,
  addUserFollower,
  deleteUserFollower,
  approveFollowerRequest,
  rejectFollowerRequest,
  getUserFollowings,
  getUserInfo,
  getUserProfile,
  sendVerificationCode,
  verifyCode,
  verifyEmail,
  refreshToken,
  getUserNotificationPreferences,
  updateUserNotificationPreferences,
  updateUserProfile,
  getUserLinkedCalendars,
  addUserLinkedCalendar,
  getUserSocialConnections,
  addUserSocialConnection,
  addUserProfilePhoto,
  getUserFriends,
  syncUserContacts,
  addToBlockList,
  deleteFromBlockList,
};
