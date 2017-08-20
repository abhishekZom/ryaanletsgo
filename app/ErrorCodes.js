/*
 * Copyright (C) 2017 lets., All Rights Reserved.
 */

'use strict';

/**
 * Define all application level error codes
 *
 * @author      TSCCODER
 * @version     1.0.0
 */

module.exports = {
  // this error code signifies that the cause of the thrown error is unknow, this is top level error code and most critical
  UNKNOWN: 'E1001',
  // this validation error is thrown when joi validation failed, the error details are captured in err.details property
  GENERIC_VALIDATION_ERROR: 'E1010',
  // this error indicates that more than one resource is found for specified unique attribute
  MULTIPLE_DATABASE_RECORDS: 'E1020',
  // generic error that represents specified resource is not found with given primary key
  RESOURCE_NOT_FOUND: 'E1030',
  // generic error when logged in user not permitted for the operation
  OPERATION_NOT_PERMITTED: 'E1040',
  // this error is expected when application encounters some unexpected data
  GENERIC_DATA_ERROR: 'E1050',

  // user specfiec errors
  /**
   * This error code indicates that user is not found with specified username, email or phone number
   * @type {String}
   */
  AUTH_USER_NOT_FOUND: 'E4010',
  /**
   * This error code indicates that user did not enter correct password while login attempt
   * @type {String}
   */
  AUTH_INVALID_CREDENTIALS: 'E4020',
  /**
   * This error code indicates that user has multiple primary numbers
   * This means that DB state is corrupted and this should never happen.
   * This error code indicate that something is critically wrong in the server and should be addressed
   * immediately.
   * @type {String}
   */
  MULTIPLE_PRIMARY_NUMBERS: 'E4050',

  /**
   * This error code indicates that user already exists with specified username
   * @type {String}
   */
  USERNAME_EXISTS: 'E4060',

  /**
   * This error code indicates that user already exists with specified email
   * @type {String}
   */
  EMAIL_EXISTS: 'E4070',

  /**
   * This error code indicates that provided email verification token does not exist
   * @type {String}
   */
  INVALID_EMAIL_VERIFICATION_TOKEN_NOT_EXIST: 'E5010',
  /**
   * This error code indicates that provided email verification token is expired
   * @type {String}
   */
  INVALID_EMAIL_VERIFICATION_TOKEN_EXPIRED: 'E5020',

  /**
   * This error code indicates that provided phone verification id invalid and there is no resource
   * corresponding to provided id
   * @type {String}
   */
  INVALID_PHONE_VERIFICATION_ID_RECORD_NOT_EXIST: 'E5030',

  /**
   * This error code indicates that provided phone verification code does not match with provided phone
   * verification id.
   * For ex: for id 1 the code is 4567 but code provided by client is 3456 and hence would result in this error
   * @type {String}
   */
  INVALID_PHONE_VERIFICATION_CODE: 'E5040',

  /**
   * This error code indicates that provided reset password code is invalid and there is no resource for specified
   * token
   * @type {String}
   */
  INVALID_RESET_PASSWORD_TOKEN_NOT_EXIST: 'E5050',
  /**
   * This error code indicates that provided reset password code is expired.
   * @type {String}
   */
  INVALID_RESET_PASSWORD_TOKEN_EXPIRED: 'E5060',

  /**
   * This error code indicates that google fetch social profile request failed
   * @type {String}
   */
  INVALID_GOOGLE_ACCESS_TOKEN: 'E7010',

  /**
   * This error code indicates that facebook fetch social profile request failed
   * @type {String}
   */
  INVALID_FACEBOOK_ACCESS_TOKEN: 'E7020',

  /**
   * This error code indicates that provided phone number is already linked with some existing account
   * This is thrown when user tries to verify a phone which is already linked with some other existing account.
   * @type {String}
   */
  PHONE_NUMBER_LINKED_WITH_OTHER_ACCOUNT: 'E8010',

  /**
   * This error code indicates that User settings record doesn't exist.
   * When a user signed up than default settings are associated with user
   * This is critical error and must be addressed immediately.
   * @type {String}
   */
  CORRUPT_USER_SETTINGS_STATE: 'E9010',

  /**
   * This error code indicate that user is trying to update linked social calendar which doesn't exist
   * for specified user.
   * @type {String}
   */
  CORRUPT_USER_LINKED_CALENDARS_STATE: 'E9020',

  /**
   * This error code indicate that the specified social connection is already associated with some other user
   * for specified user.
   * @type {String}
   */
  SOCIAL_CONNECTION_EXISTS_FOR_OTHER_USER: 'E10010',

  /**
   * This error code indicate that the activity is shared and user trying to access the activity
   * is not a follower of author of the activity
   * @type {String}
   */
  SHARED_ACTIVITY_ILLEGAL_ACCESS: 'E11010',

  /**
   * This error code indicate that the activity is private and user trying to access the activity
   * is not in invitees list
   * @type {String}
   */
  PRIVATE_ACTIVITY_ILLEGAL_ACCESS: 'E11020',

  /**
   * This error code indicates that user is trying to add a comment on text comment.
   * Practically user can only add text comment on photo comment
   * @type {String}
   */
  COMMENT_INVALID_COMMENT: 'E11030',

  /**
   * This error code indicates that activity author is not allowed to remove himself from rsvp list
   * @type {String}
   */
  ACTIVITY_AUTHOR_UNDO_RSVP_NOT_ALLOWED: 'E11040',
  /**
   * This error code indicates that activity author is not allowed to add himself from rsvp list
   * @type {String}
   */
  ADD_RSVP_AUTHOR_NOT_ALLOWED: 'E11050',
};
