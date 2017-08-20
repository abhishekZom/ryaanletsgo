/*
 * Copyright (C) 2017 lets., All Rights Reserved.
 */

'use strict';

/**
 * Helper module for the tests.
 *
 * @author      TSCCODER
 * @version     1.0.0
 */

const fs = require('fs');
const uuid = require('uuid');
const YAML = require('js-yaml');
const spec = require('swagger-tools').specs.v2;
const path = require('path');
const _ = require('lodash');
const expect = require('chai').expect;

const data = require('./data/test_data.json');
const constants = require('./constants');

const swaggerObject = YAML.safeLoad(fs.readFileSync(path.join(process.cwd(), 'api', 'swagger.yml'), 'utf8'));
const TABLE_NAMES = constants.TABLE_NAMES;

/**
 * Validate the given object/array against the swagger api specification
 *
 * @param   {String}          ref             the model definition reference
 * @param   {Object/Array}    obj             the object/array to validate
 * @param   {Function}        done            the callback to pass the validation result
 *                                            for tests directly pass the done callback of mocha
 * @return  {Void}                            this function does not return anything
 */
exports.validateModel = function (ref, obj, done) {
  spec.validateModel(swaggerObject, ref, obj, (err, result) => {
    if (err) {
      done(err);
    } else if (result) {
      // swagger model is not valid
      done(new Error(JSON.stringify(result)));
    } else {
      // swagger model is valid
      done();
    }
  });
};

/**
 * Assert the existence of error with the required message contains in error.message property
 *
 * @param   {Error}           error           the error to assert
 * @param   {String}          message         the message to assert
 * @param   {Function}        done            the callback to pass the validation result
 *                                            for tests directly pass the done callback of mocha
 * @return  {Void}                            this function does not return anything
 */
exports.assertError = function (error, message, done) {
  try {
    expect(error).to.exist();
    expect(error.message).to.have.string(message);
    // if this line is executing means that everything is success and test pass
    done();
  } catch (ae) {
    done(ae);
  }
};

/**
 * Get dummy google profile for specified email
 *
 * @param   {String}          email           the google user email
 * @param   {String}          userId          the id of the user
 * @return  {Object}                          this function returns the dummy test google profile
 */
exports.getDummyGoogleProfile = function (email, userId) {
  const connections = _.filter(data.userSocialConnections, { userId });
  return {
    id: connections[0] ? connections[0].socialId : '3423452545436565',
    name: {
      givenName: 'John',
      familyName: 'Doe',
    },
    emails: [{ type: 'account', value: email }],
  };
};


/**
 * Get dummy facebook profile for specified email
 *
 * @param   {String}          email           the facebook user email
 * @return  {Object}                          this function returns the dummy test google profile
 */
exports.getDummyFacebookProfile = function (email) {
  return {
    id: '1076734175679327',
    first_name: 'John',
    last_name: 'Doe',
    email,
  };
};

/**
 * Get dummy google oauth2 token response.
 *
 * @return  {Object}                          the google oauth 2 token response
 */
exports.getDummyGoogleTokenResponse = function () {
  return {
    access_token: uuid.v4(),
    refresh_token: uuid.v4(),
    expires_in: 3600,
  };
};

/**
 * Get the test data for the specified table name
 *
 * @param   {String}          name            the table name
 * @return  {Array}                           get the test data for the specified table name
 */
exports.getData = function (name) {
  switch (name) {
    case TABLE_NAMES.User:
      return data.users;
    case TABLE_NAMES.UserContact:
      return data.userContacts;
    case TABLE_NAMES.UserPhoneNumber:
      return data.phoneNumbers;
    case TABLE_NAMES.UserResetPassword:
      return data.resetPassword;
    case TABLE_NAMES.UserFollower:
      return data.followers;
    case TABLE_NAMES.UserEmailVerification:
      return data.emailVerification;
    case TABLE_NAMES.UserLinkedCalendar:
      return data.userLinkedCalendars;
    case TABLE_NAMES.UserNotificationPreference:
      return data.notificationPreferences;
    case TABLE_NAMES.UserSetting:
      return data.settings;
    case TABLE_NAMES.UserSocialConnection:
      return data.userSocialConnections;
    case TABLE_NAMES.Activity:
      return data.activities;
    case TABLE_NAMES.ActivityInvitee:
      return data.activityInvitees;
    case TABLE_NAMES.ActivityLike:
      return data.activityLikes;
    case TABLE_NAMES.ActivityPhoto:
      return data.activityPhotos;
    case TABLE_NAMES.ActivityRsvp:
      return data.activityRsvp;
    case TABLE_NAMES.Comment:
      return data.comments;
    case TABLE_NAMES.CommentLike:
      return data.commentLikes;
    default:
      throw new Error('invalid table name');
  }
};
