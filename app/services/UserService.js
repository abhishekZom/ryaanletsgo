/*
 * Copyright (C) 2017 lets., All Rights Reserved.
 */

'use strict';

/**
 * User resource service contract
 * Some of the modules this service depends on will be resolved at deployment time.
 *
 * @author      TSCCODER
 * @version     1.0.0
 */

const errors = require('common-errors');
const config = require('config');
const joi = require('joi');
const _ = require('lodash');
const moment = require('moment');
const rp = require('request-promise');
const Random = require('random-js');
const httpStatus = require('http-status');
const google = require('googleapis');

const logger = require('../common/Logger');
const ErrorCodes = require('../ErrorCodes');
const helper = require('../common/Helper');

const models = require('../models').getDatasource({       // eslint-disable-line import/no-unresolved
  db: _.extend(config.db, { max: 10 }),
  logger,
});

const constants = require('../constants');          // eslint-disable-line import/no-unresolved
const RabbitMQService = require('./RabbitMQService');

const DEVICE_TYPES = constants.DEVICE_TYPES;
const SOCIAL_CONNECTION_TYPES = constants.SOCIAL_CONNECTION_TYPES;
const CALENDAR_TYPES = constants.CALENDAR_TYPES;
const CONTACT_TYPES = constants.CONTACT_TYPES;

const r = models.r;
const thinky = models.thinky;

const AccessToken = models.AccessToken;
const Action = models.Action;
const Activity = models.Activity;
const ActivityInvitee = models.ActivityInvitee;
const ActivityLike = models.ActivityLike;
const ActivityRsvp = models.ActivityRsvp;

const Comment = models.Comment;
const CommentLike = models.CommentLike;

const Group = models.Group;
const GroupMember = models.GroupMember;
const Feed = models.Feed;

const User = models.User;
const UserEmailVerification = models.UserEmailVerification;
const UserNotificationPreference = models.UserNotificationPreference;
const UserPhoneNumber = models.UserPhoneNumber;
const UserPhoneNumberVerification = models.UserPhoneNumberVerification;
const UserResetPassword = models.UserResetPassword;
const UserSocialConnection = models.UserSocialConnection;
const UserFollower = models.UserFollower;
const UserSetting = models.UserSetting;
const UserLinkedCalendar = models.UserLinkedCalendar;
const UserBlock = models.UserBlock;
const UserContact = models.UserContact;
const UserFriend = models.UserFriend;

// initiates a new rabbitmq service
const rabbitmqService = new RabbitMQService({ url: config.rabbitmq.url, logger });

// random number generation engine
const random = new Random(Random.engines.mt19937().autoSeed());

const NULL = null;
const EMPTY = '';
// constant for production environment
const PRODUCTION = 'production';

// google oauth2 client
const googleOauth2Client = new google.auth.OAuth2(config.oauth2.google.CLIENT_ID,
  config.oauth2.google.CLIENT_SECRET, config.oauth2.google.REDIRECT_URI);

// google people api client
const people = google.people('v1');

/**
 * Get a user by either username or email
 * Undefined values are not handled as expected. This is a bug in rethinkdb
 * Because of this I have to pass null if username is undefined
 * @see  https://github.com/rethinkdb/rethinkdb/issues/663
 * @private
 *
 * @param   {String}      username          the user's username
 * @param   {String}      email             the user's email
 * @return  {Array}                         the users matching username or email
 */
function* getByUsernameOrEmail(username, email) {
  const users = yield User.filter(r.row('username').eq(username || NULL).or(r.row('email').eq(email || NULL)));
  return users;
}

/**
 * Generate the access and refresh tokens
 * @private
 *
 * @param   {Object}      user              the user for which to generate the tokens
 * @return  {Object}                        the tokens payload
 */
function* generateTokens(user) {
  const accessToken = yield helper.generateToken({
    userId: user.id,
  }, {
    expiresIn: user.status & 2 === 0 ? config.TEMP_JWT_EXPIRES_IN : config.JWT_EXPIRES_IN,          // eslint-disable-line no-bitwise
  });
  const refToken = yield helper.generateToken({ userId: user.id });

  if (user.status & 2 !== 0) {                        // eslint-disable-line no-bitwise
    // save the access token only if user is phone verified
    yield AccessToken.save({
      token: accessToken,
      userId: user.id,
    });
  }

  return {
    accessToken,
    refreshToken: refToken,
  };
}

/**
 * Send verification code to the to number with given reference id
 * This method must return the SendVerificationCodeRes model definition
 * @private
 *
 * @param   {Object}      user              the user for which to send verification code
 * @param   {String}      to                the to number
 * @param   {String}      referenceId       the reference id
 * @return  {Object}                        the SendVerificationCodeRes payload
 */
function* doSendVerificationCode(user, to, referenceId) {
  const flag = user.username.startsWith(config.user.SKIP_VERIFICATION_PREFIX) &&
    process.env.NODE_ENV !== PRODUCTION;

  const code = (flag === true) ? config.user.SKIP_VERIFICATION_CODE : random.integer(1000, 9999);
  // send sms verification only if flag is false

  if (flag === false) {
    const response = yield helper.sendSms({
      from: config.twilio.TWILIO_FROM_NUMBER,
      to,
      body: config.twilio.MESSAGE_BODY.replace(':code', code),
    });
    logger.debug('send sms success, response', helper.stringify(response));
  }

  const phoneVerificationRecord = yield UserPhoneNumberVerification.save({
    referenceId,
    code: code.toString(),
  });
  return {
    id: phoneVerificationRecord.id,
  };
}

/**
 * Get a user's linked calendars details. This includes user settings of default activity duration.
 *
 * @param   {Object}      auth              currently logged in user auth identification
 * @param   {String}      id                the id of the user
 * @return  {Object}                        the UserLinkedCalendarDetail payload
 */
function* getUserLinkedCalendars(auth, id) {
  if (auth.userId !== id) {
    throw new errors.NotPermittedError('user can only view self linked calendars',
      new Error(ErrorCodes.OPERATION_NOT_PERMITTED));
  }
  const user = yield helper.fetch(User, id, thinky);
  if (!user) {
    throw new errors.NotFoundError('user not found with specified id',
      new Error(ErrorCodes.RESOURCE_NOT_FOUND));
  }
  const settings = yield r.table(UserSetting.getTableName())
    .getAll(id, { index: 'userId' })
    .nth(0)
    .default(null)
    .run();

  if (!settings) {
    // race condition should never happen
    throw new errors.data.DataError('corrupt user settings state',
      new Error(ErrorCodes.CORRUPT_USER_SETTINGS_STATE));
  }
  const calendars = yield UserLinkedCalendar.filter({ userId: id });
  return {
    settings,
    calendars: helper.getRawObject(calendars, ['accessToken', 'refreshToken', 'userId', 'id']),
  };
}

// joi validation schema for getUserLinkedCalendars
getUserLinkedCalendars.schema = {
  auth: joi.object().keys({
    userId: joi.string().required(),
    accessToken: joi.string(),
  }).required(),
  id: joi.string().required(),
};

/**
 * Fetch the profile from specified social network
 * @private
 *
 * @param   {String}      accessToken       the social network access token
 * @param   {String}      type              the social network type, can be facebook/google
 * @return  {Object}                        the social profile of user
 */
function* fetchSocialProfile(accessToken, type) {
  let uri;

  switch (type) {
    case SOCIAL_CONNECTION_TYPES.google:
      uri = `${config.SOCIAL_CONNECTIONS.GOOGLE_PROFILE_ENDPOINT}/me`;
      break;
    case SOCIAL_CONNECTION_TYPES.facebook:
      uri = `${config.SOCIAL_CONNECTIONS.FACEBOOK_PROFILE_ENDPOINT}/me?fields=email,first_name,name,last_name`;
      break;
    default:
      throw new errors.ArgumentError('invalid social connection type',
        new Error(ErrorCodes.GENERIC_VALIDATION_ERROR));
  }

  const payload = {
    url: uri,
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    json: true,
    simple: true,
  };

  try {
    return yield rp(payload);
  } catch (err) {
    logger.error(`fetch ${type} profile failed`, helper.stringify(err));
    throw new errors.AuthenticationRequiredError(`invalid ${type} access token`,
      new Error((type === SOCIAL_CONNECTION_TYPES.google) ? ErrorCodes.INVALID_GOOGLE_ACCESS_TOKEN :
        ErrorCodes.INVALID_FACEBOOK_ACCESS_TOKEN));
  }
}

/**
 * To enable server side offline access the server auth code has to be exchanged with
 * access tokens and refresh tokens.
 * @private
 *
 * @param   {String}      serverAuthCode    the server auth code to exchange with access/refresh tokens
 * @return  {Object}                        the access token and refresh token array
 */
function* exchangeGoogleServerAuthCode(serverAuthCode) {
  const tokens = yield Promise.fromCallback(cb => googleOauth2Client.getToken(serverAuthCode, cb));
  if (!_.isString(tokens.access_token) || !_.isString(tokens.refresh_token)) {
    logger.error('invalid google token response, access_token or refresh_token is missing', helper.stringify(tokens));
    throw new errors.data.DataError('invalid google token response', new Error(ErrorCodes.GENERIC_DATA_ERROR));
  }
  return { accessToken: tokens.access_token, refreshToken: tokens.refresh_token };
}

/**
 * Get a user's linked social accounts.
 *
 * @param   {Object}      auth              currently logged in user auth identification
 * @param   {String}      id                the id of the user
 * @return  {Array}                         array of UserSocialConnection models (see api spec for details)
 */
function* getUserSocialConnections(auth, id) {
  if (auth.userId !== id) {
    throw new errors.NotPermittedError('user can only view self social connections',
      new Error(ErrorCodes.OPERATION_NOT_PERMITTED));
  }
  const user = yield helper.fetch(User, id, thinky);
  if (!user) {
    throw new errors.NotFoundError('user not found with specified id',
      new Error(ErrorCodes.RESOURCE_NOT_FOUND));
  }
  const connections = yield UserSocialConnection.filter({ userId: id });
  return helper.getRawObject(connections, ['accessToken', 'refreshToken']);
}

/**
 * Add a new social connection to user's account.
 * The client ios app must initiate the oauth2 flow with the corresponding social provider and must
 * finish the oauth2 flow before consuming this api. Social access token is mandatory for this api.
 * NOTE: This access token will be verified at server.
 *
 * @param   {Object}      auth              currently logged in user auth identification
 * @param   {String}      id                the id of the user
 * @param   {Object}      entity            the request payload, UserSocialConnection model definition
 * @return  {Void}                          this function doesn't return anything
 */
function* addUserSocialConnection(auth, id, entity) {
  if (auth.userId !== id) {
    throw new errors.NotPermittedError('user can only add social connection to self account',
      new Error(ErrorCodes.OPERATION_NOT_PERMITTED));
  }
  const user = yield helper.fetch(User, id, thinky);
  if (!user) {
    throw new errors.NotFoundError('user not found with specified id',
      new Error(ErrorCodes.RESOURCE_NOT_FOUND));
  }

  if (entity.type === SOCIAL_CONNECTION_TYPES.google) {
    // exchange server auth code with access and refresh tokens
    const tokens = yield exchangeGoogleServerAuthCode(entity.serverAuthCode);
    entity.accessToken = tokens.accessToken;
    entity.refreshToken = tokens.refreshToken;
  }

  const socialProfile = yield fetchSocialProfile(entity.accessToken, entity.type);
  if (!socialProfile) {
    // this is race condition should never happen, if we get 2xx from google than this variable should not be undefined
    throw new errors.data.DataError('invalid social profile data', new Error(ErrorCodes.GENERIC_DATA_ERROR));
  }

  // check if there is already a social connection
  const existing = yield UserSocialConnection.getAll([socialProfile.id, entity.type], { index: 'socialId_type' }).run();

  if (existing && existing.length > 1) {
    throw new errors.data.DataError('multiple social connection records',
      new Error(ErrorCodes.MULTIPLE_DATABASE_RECORDS));
  } else if (existing && existing.length === 1 && existing[0].userId !== id) {
    throw new errors.ArgumentError('this social connection is already associated with some different user',
      new Error(ErrorCodes.SOCIAL_CONNECTION_EXISTS_FOR_OTHER_USER));
  }

  if (existing && existing.length > 0) {
    // update the existing record
    yield existing[0].merge({
      profile: socialProfile,
      accessToken: entity.accessToken,
      refreshToken: entity.refreshToken,
      socialId: socialProfile.id,
    }).save();
  } else {
    // no existing record create new one
    yield UserSocialConnection.save({
      accessToken: entity.accessToken,
      refreshToken: entity.refreshToken,
      socialId: socialProfile.id,
      profile: socialProfile,
      type: entity.type,
      userId: id,
    });
  }
  return yield getUserSocialConnections(auth, id);
}

addUserSocialConnection.schema = {
  auth: joi.object().keys({
    userId: joi.string().required(),
    accessToken: joi.string(),
  }).required(),
  id: joi.string().required(),
  entity: joi.object().keys({
    accessToken: joi.when('type', {
      is: SOCIAL_CONNECTION_TYPES.facebook,
      then: joi.string().required(),
      otherwise: joi.any().forbidden(),
    }),
    serverAuthCode: joi.when('type', {
      is: SOCIAL_CONNECTION_TYPES.google,
      then: joi.string().required(),
      otherwise: joi.any().forbidden(),
    }),
    refreshToken: joi.string(),
    type: joi.string().valid(_.values(SOCIAL_CONNECTION_TYPES)).required(),
  }),
};

/**
 * Perform login checks for the user
 * @private
 *
 * @param   {Object}      user              the user for which to perform checks
 * @param   {String}      deviceId          the device hardware id from which user is logging in
 * @param   {String}      password          the plain text password to verify against user's password
 *
 * @return  {Object}                        appropriate response based on the login check conditions
 */
function* processLoginChecks(user, deviceId, password) {
  // verify the password
  const isPasswordValid = _.isString(password) ? yield helper.validateHash(user.password, password) : true;
  if (isPasswordValid === false) {
    throw new errors.AuthenticationRequiredError('username or password does not match',
      ErrorCodes.AUTH_INVALID_CREDENTIALS);
  }

  const existingPhoneRecords = yield UserPhoneNumber.filter({ userId: user.id });

  const plain = helper.getRawObject(user, 'password');

  const phoneNumbers = existingPhoneRecords.map(single => helper.getRawObject(single,
    ['id', 'userId', 'deviceToken']));

  const lc = yield getUserLinkedCalendars({ userId: user.id }, user.id);

  const profile = _.extend(plain, {
    phoneNumbers,
    settings: lc.settings,
    calendars: lc.calendars,
  });

  if (!existingPhoneRecords || existingPhoneRecords.length === 0) {
    // it means that user still hasn't added a single phone number
    // generate temp tokens and send 203
    const tokens = yield generateTokens(user);
    return {
      status: httpStatus.NON_AUTHORITATIVE_INFORMATION,
      model: {
        tokens,
        user: profile,
      },
    };
  }

  // if this device id is not found in any existing verified device ids than send verification code
  // Also if user hasn't yet verified the phone number than also send verification code
  const deviceIds = existingPhoneRecords.map(single => single.deviceId);

  if (deviceIds.indexOf(deviceId) === -1 || user.status & 2 === 0) {        // eslint-disable-line no-bitwise
    const primaryNumbers = existingPhoneRecords.filter(single => single.primary === 1);
    const ppnl = (primaryNumbers && primaryNumbers.length > 0) ? primaryNumbers.length : 0;
    if (ppnl !== 1) {
      // race condition should never happen
      // either user has no phone record which is handled up in function
      // otherwise user have only one primary number at a time
      // if not than throw error that data is not consistent
      throw new errors.data.DataError('user has multiple primary phone numbers',
        new Error(ErrorCodes.MULTIPLE_PRIMARY_NUMBERS));
    }
    const to = `${primaryNumbers[0].countryCode}${primaryNumbers[0].phoneNumber}`;
    const verification = yield doSendVerificationCode(plain, to, primaryNumbers[0].id);

    const tokens = yield generateTokens(user);

    return {
      status: httpStatus.NON_AUTHORITATIVE_INFORMATION,
      model: {
        tokens,
        user: profile,
        verification,
      },
    };
  }

  // password is validated, generate tokens
  const tokens = yield generateTokens(user);

  return {
    status: httpStatus.OK,
    model: {
      tokens,
      user: profile,
    },
  };
}

/**
 * Authenticate the user and generate bearer access token
 *
 * @param   {Object}      entity            the request payload
 * @return  {Object}                        the LoginRes payload
 */
function* login(entity) {
  // find a user by username, phone or email
  const users = yield getByUsernameOrEmail(entity.username, entity.username);
  /**
   * Undefined values are not handled as expected. This is a bug in rethinkdb
   * Because of this I have to pass null if username is undefined
   * @see  https://github.com/rethinkdb/rethinkdb/issues/663
   */
  const phoneRecords = yield UserPhoneNumber.filter({ phoneNumber: entity.username || EMPTY });

  const pnl = phoneRecords ? phoneRecords.length : 0;
  const ul = users ? users.length : 0;

  // still the user is not found, throw error
  if (pnl === 0 && ul === 0) {
    throw new errors.NotFoundError(`user not found with specified [${entity.username}] username, email or phoneNumber`,
      new Error(ErrorCodes.AUTH_USER_NOT_FOUND));
  } else if ((pnl | ul) > 1) {            // eslint-disable-line no-bitwise
    // this race condition should never happen in the application
    throw new errors.data.DataError('user not uniquely identified',
      new Error(ErrorCodes.MULTIPLE_DATABASE_RECORDS));
  }

  let user = users[0];
  if (!users || users.length === 0) {
    // user is login using phone number
    user = yield User.get(phoneRecords[0].userId);
  }
  const doc = yield processLoginChecks(user, entity.deviceId, entity.password);
  return helper.decorateWithSignedUrl(doc, ['photo', 'photos']);
}

// the joi validation schema for login
login.schema = {
  entity: joi.object().keys({
    username: joi.string().required(),
    password: joi.string().required(),
    deviceId: joi.string().required(),
  }).required(),
};


/**
 * Post Process the user signup
 * @private
 *
 * @param   {Object}      user              the created user
 * @return  {Void}                          this method doesn't return anything
 */
function* processUserSignup(user) {
  // publish user signup event
  yield rabbitmqService.publish(config.ROUTING_KEYS.USER_SIGNUP.key, {
    user: helper.getRawObject(user, 'password'),
  });
}

/**
 * Clean up the data for force signup
 *
 * @param   {String}      userId            the forced signed up user id
 * @return  {Void}                          this function does not return anything
 */
function* cleanUpForceSignupData(userId) {
  yield r.table(AccessToken.getTableName()).getAll(userId, { index: 'userId' }).delete().run();
  yield r.table(Action.getTableName()).getAll(userId, { index: 'actor' }).delete().run();
  yield r.table(Activity.getTableName()).getAll(userId, { index: 'author' }).delete().run();
  yield r.table(ActivityInvitee.getTableName()).getAll(userId, { index: 'inviteeId' }).delete().run();
  yield r.table(ActivityLike.getTableName()).getAll(userId, { index: 'userId' }).delete().run();
  yield r.table(ActivityRsvp.getTableName()).getAll(userId, { index: 'userId' }).delete().run();
  yield r.table(Comment.getTableName()).getAll(userId, { index: 'author' }).delete().run();
  yield r.table(CommentLike.getTableName()).getAll(userId, { index: 'userId' }).delete().run();
  yield r.table(Feed.getTableName()).getAll(userId, { index: 'userId' }).delete().run();
  yield r.table(Group.getTableName()).getAll(userId, { index: 'owner' }).delete().run();
  yield r.table(GroupMember.getTableName()).getAll(userId, { index: 'memberId' }).delete().run();
  yield r.table(UserBlock.getTableName()).getAll(userId, { index: 'userId' }).delete().run();
  yield r.table(UserContact.getTableName()).getAll(userId, { index: 'userId' }).delete().run();
  yield r.table(UserEmailVerification.getTableName()).getAll(userId, { index: 'userId' }).delete().run();
  yield r.table(UserFollower.getTableName()).getAll(userId, { index: 'userId' }).delete().run();
  yield r.table(UserFriend.getTableName()).getAll(userId, { index: 'userId' }).delete().run();
  yield r.table(UserLinkedCalendar.getTableName()).getAll(userId, { index: 'userId' }).delete().run();
  yield r.table(UserNotificationPreference.getTableName()).getAll(userId, { index: 'userId' }).delete().run();
  yield r.table(UserPhoneNumber.getTableName()).getAll(userId, { index: 'userId' }).delete().run();
  yield r.table(UserPhoneNumberVerification.getTableName()).getAll(userId, { index: 'userId' }).delete().run();
  yield r.table(UserResetPassword.getTableName()).getAll(userId, { index: 'userId' }).delete().run();
  yield r.table(UserSetting.getTableName()).getAll(userId, { index: 'userId' }).delete().run();
  yield r.table(UserSocialConnection.getTableName()).getAll(userId, { index: 'userId' }).delete().run();
  yield r.table(User.getTableName()).get(userId).delete();
}

/**
 * Signup a user using email flow
 *
 * @param   {Object}      entity            the request payload
 * @param   {boolean}     force             in development mode force the user to re register
 * @return  {Object}                        the User payload
 */
function* signup(entity, force) {
  const isForce = config.ENABLE_FORCE_SIGNUP === 1 && (force || false);
  // validate that the user is unique
  const uusers = yield User.filter({ username: entity.username });

  if (uusers && uusers.length > 0 && isForce === false) {
    throw new errors.ArgumentError('user already present with specified username',
      new Error(ErrorCodes.USERNAME_EXISTS));
  } else if (uusers && uusers.length > 0 && isForce === true) {
    // clean existing user record.
    // we are not cleaning referenced table data here, that will be stable data in development mode
    yield cleanUpForceSignupData(uusers[0].id);
  }

  const eusers = yield User.filter({ email: entity.email });
  if (eusers && eusers.length > 0 && isForce === false) {
    throw new errors.ArgumentError('user already present with specified email',
      new Error(ErrorCodes.EMAIL_EXISTS));
  } else if (eusers && eusers.length > 0 && isForce === true) {
    // clean existing user record.
    // we are not cleaning referenced table data here, that will be stable data in development mode
    yield cleanUpForceSignupData(eusers[0].id);
  }

  const doc = _.pick(entity, 'email', 'username', 'password', 'fullName');
  // hash the password
  doc.password = yield helper.hashString(entity.password);
  const user = yield User.save(doc);
  if (_.has(entity, 'social')) {
    // add user social connection
    try {
      yield addUserSocialConnection({ userId: user.id }, user.id, entity.social);
    } catch (error) {
      logger.error('add social connection error rollback', helper.stringify(error));
      yield user.delete();
      throw error;
    }
  }
  try {
    yield UserNotificationPreference.save({ userId: user.id });
    yield UserSetting.save({ userId: user.id });
  } catch (ignore) {
    logger.error('error saving user settings or user notification preferences rollback', helper.stringify(ignore));
    yield user.delete();
    throw ignore;
  }
  yield processUserSignup(user);
  const plain = helper.getRawObject(user, 'password');
  const tokens = yield generateTokens(plain);

  const merged = {
    tokens,
    user: plain,
  };
  return helper.decorateWithSignedUrl(merged, ['photo', 'photos']);
}

// the joi validation schema for signup
signup.schema = {
  entity: joi.object().keys({
    username: joi.string().required(),
    password: joi.string().required(),
    email: joi.string().email().required(),
    fullName: joi.string().required(),
    social: joi.object().keys({
      accessToken: joi.when('type', {
        is: SOCIAL_CONNECTION_TYPES.facebook,
        then: joi.string().required(),
        otherwise: joi.any().forbidden(),
      }),
      serverAuthCode: joi.when('type', {
        is: SOCIAL_CONNECTION_TYPES.google,
        then: joi.string().required(),
        otherwise: joi.any().forbidden(),
      }),
      refreshToken: joi.string(),
      type: joi.string().valid(_.values(SOCIAL_CONNECTION_TYPES)).required(),
    }),
  }).required(),
  force: joi.boolean().default(false, 'by default force is false'),
};

/**
 * Resolve the social login user based on the social profile or socialId and type
 * @private
 *
 * @param   {Object}      profile           the parsed social profile
 * @param   {String}      socialId          the social network id
 * @param   {String}      type              the social network type
 * @return  {Object}                        the User resource or throw error if not found
 */
function* resolveSocialLoginUser(profile, socialId, type) {
  // validate that the user is unique
  const users = yield getByUsernameOrEmail(profile.username, profile.email);

  // try to get user from social connections
  const susers = yield UserSocialConnection.getAll([socialId, type], { index: 'socialId_type' }).run();

  const ul = users ? users.length : 0;
  const sul = susers ? susers.length : 0;

  if ((ul | sul) === 0) {             // eslint-disable-line no-bitwise
    // if user does not exist send 404 error
    throw new errors.NotFoundError('user not found', new Error(ErrorCodes.AUTH_USER_NOT_FOUND));
  } else if (ul > 1 || sul > 1) {
    throw new errors.data.DataError('user not uniquely identified',
      new Error(ErrorCodes.MULTIPLE_DATABASE_RECORDS));
  }

  // if user exists behave like login endpoint
  let user;
  if (ul === 1) {
    user = users[0];
  } else if (sul === 1) {
    user = yield helper.fetch(User, susers[0].userId, thinky);
  }

  if (!user) {
    // race condition should never happen
    throw new errors.data.DataError('data is corrupt', new Error(ErrorCodes.GENERIC_DATA_ERROR));
  }
  return user;
}

/**
 * Signup a user using google social network
 *
 * @param   {Object}      entity            the request payload
 * @return  {Object}                        the User payload
 */
function* googleLogin(entity) {
  // get google profile information
  const googleProfile = yield fetchSocialProfile(entity.token, SOCIAL_CONNECTION_TYPES.google);

  if (!googleProfile) {
    // this is race condition should never happen, if we get 2xx from google than this variable should not be undefined
    throw new errors.data.DataError('invalid google profile data', new Error(ErrorCodes.GENERIC_DATA_ERROR));
  }
  // extract username/email from google profile
  const parsed = {
    email: googleProfile.emails[0].type === 'account' ? googleProfile.emails[0].value : null,
    username: `${googleProfile.name.givenName}${googleProfile.name.familyName}`,
  };

  const user = yield resolveSocialLoginUser(parsed, googleProfile.id, SOCIAL_CONNECTION_TYPES.google);

  const doc = yield processLoginChecks(user, entity.deviceId);
  return helper.decorateWithSignedUrl(doc, ['photo', 'photos']);
}

// the joi validation schema for googleSignup
googleLogin.schema = {
  entity: joi.object().keys({
    token: joi.string().required(),
    deviceId: joi.string().required(),
  }).required(),
};

/**
 * Signup a user using facebook social network
 *
 * @param   {Object}      entity            the request payload
 * @return  {Object}                        the User payload
 */
function* facebookLogin(entity) {
  // get facebook profile information
  const facebookProfile = yield fetchSocialProfile(entity.token, SOCIAL_CONNECTION_TYPES.facebook);

  if (!facebookProfile) {
    // this is race condition should never happen, if we get 2xx from facebook than this variable should not be undefined
    throw new errors.data.DataError('invalid facebook profile data', new Error(ErrorCodes.GENERIC_DATA_ERROR));
  }
  // merge user profile with facebook profile
  const parsed = {
    email: facebookProfile.email,
    username: `${facebookProfile.first_name}${facebookProfile.last_name}`,
  };

  const user = yield resolveSocialLoginUser(parsed, facebookProfile.id, SOCIAL_CONNECTION_TYPES.facebook);

  const doc = yield processLoginChecks(user, entity.deviceId);
  return helper.decorateWithSignedUrl(doc, ['photo', 'photos']);
}

// the joi validation schema for googleSignup
facebookLogin.schema = {
  entity: joi.object().keys({
    token: joi.string().required(),
    deviceId: joi.string().required(),
  }).required(),
};

/**
 * Initiates forgot password and send forgot password password email to user
 *
 * @param   {Object}      entity            the request payload
 * @return  {Void}                          the function doesn't return anything
 */
function* forgotPassword(entity) {
  // check if user exists or not
  const users = yield User.filter({ email: entity.email });
  if (!users || users.length === 0) {
    throw new errors.NotFoundError('user not found with specified email',
      new Error(ErrorCodes.RESOURCE_NOT_FOUND));
  } else if (users.length !== 1) {
    // race condition should never happen
    throw new errors.data.DataError('user not uniquely identified',
      new Error(ErrorCodes.MULTIPLE_DATABASE_RECORDS));
  }
  // publish the forgot password event
  rabbitmqService.publish(config.ROUTING_KEYS.SEND_FORGOT_PASSWORD_MAIL.key, {
    user: helper.getRawObject(users[0]),
  });
}

// joi validation schema for forgot password
forgotPassword.schema = {
  entity: joi.object().keys({
    email: joi.string().email().required(),
  }).required(),
};

/**
 * Verify the reset password token and if valid reset the user's password
 *
 * @param   {Object}      entity            the request payload
 * @return  {Void}                          the function doesn't return anything
 */
function* resetPassword(entity) {
  const userResetPasswordRecords = yield UserResetPassword.filter({ token: entity.code });
  if (!userResetPasswordRecords || userResetPasswordRecords.length === 0) {
    throw new errors.NotFoundError('Invalid reset password code',
      new Error(ErrorCodes.INVALID_RESET_PASSWORD_TOKEN_NOT_EXIST));
  } else if (moment().valueOf() >= userResetPasswordRecords[0].expires) {
    throw new errors.ArgumentError('Reset password code expired',
      new Error(ErrorCodes.INVALID_RESET_PASSWORD_TOKEN_EXPIRED));
  }

  const user = yield User.get(userResetPasswordRecords[0].userId);
  // update the user password
  const hashedPassowrd = yield helper.hashString(entity.password);
  yield user.merge({ password: hashedPassowrd }).save();
  // update reset password record
  // we can't delete this record as we want to keep reset password history for future reference
  yield userResetPasswordRecords[0].merge({ token: undefined, expires: undefined }).save();
}

// joi validation schema for resetPassword
resetPassword.schema = {
  entity: joi.object().keys({
    code: joi.string().required(),
    password: joi.string().required(),
  }).required(),
};

/**
 * Compute follow state relationship between current logged in user
 * and specified users. The followerIds are the unique primary keys of the followers of the users.
 * We have to search current user followers in these followers ids.
 * @private
 *
 *
 * @param   {Object}      auth              currently logged in user auth identification
 * @param   {Array}       users             the specified users list
 * @return  {Array}                         the new array consisting of follow state relationship
 *                                          between current user and specified users.
 */
function* computeFollowStates(auth, users) {
  const followersIds = users.map(single => single.id);
  // get the current user followers, we have to construct the follow state relationship between
  // currently logged in user and all the specified user
  const currentUserFollowers = yield UserFollower.filter(doc => r.expr(followersIds)
    .contains(doc('followerId')).and(doc('userId').eq(auth.userId)));

  // users blocked by current user
  const currentUserBlockedUsers = yield UserBlock.getAll(auth.userId, { index: 'userId' }).run();
  const cubuids = currentUserBlockedUsers.map(single => single.blockedId);
  // users that blocked current user
  const usersBlockedCurrentUser = yield UserBlock.getAll(auth.userId, { index: 'blockedId' }).run();
  const ubcuids = usersBlockedCurrentUser.map(single => single.userId);

  const response = users.map((single) => {
    const cufdoc = _.filter(currentUserFollowers, { userId: auth.userId, followerId: single.id })[0];
    const cubui = cubuids.indexOf(single.id);
    const ubcui = ubcuids.indexOf(single.id);
    let state = 0;
    if (single.id === auth.userId) {
      state |= 64;                                   // eslint-disable-line no-bitwise
    }
    if (ubcui !== -1) {
      state |= 32;                                  // eslint-disable-line no-bitwise
    }
    if (cubui !== -1) {
      state |= 16;                                  // eslint-disable-line no-bitwise
    }
    if (cufdoc && cufdoc.status === 2) {
      // the request was rejected
      state |= 8;                                   // eslint-disable-line no-bitwise
    }
    if (cufdoc && cufdoc.status === 0) {
      // the request is in pending state
      state |= 4;                                   // eslint-disable-line no-bitwise
    }
    if (cufdoc && cufdoc.status === 1) {
      // the follow request is accepted
      state |= 2;                                   // eslint-disable-line no-bitwise
    }
    return {
      user: single,
      followState: state,
    };
  });

  return response;
}

/**
 * Get the users followers
 * NOTE: The followers list is returned keeping in mind the current logged in user context.
 * For detailed understanding see swagger model definition `FollowState`
 *
 *
 * @param   {Object}      auth              currently logged in user auth identification
 * @param   {String}      id                the id of the user
 * @param   {Object}      criteria          the filter criteria
 * @return  {Array}                         the currently logged in user's followers
 *                                          each follower is User payload
 */
function* getUserFollowers(auth, id, criteria) {
  const filter = { userId: id, status: 1 };
  if (_.has(criteria, 'status')) {
    // only actual followers
    filter.status = criteria.status;
  }

  const lo = helper.parseLimitAndOffset(criteria);

  let chain = r.table(UserFollower.getTableName())
    .getAll([filter.userId, filter.status], { index: 'userId_status' });

  const total = yield r.table(UserFollower.getTableName())
    .getAll([filter.userId, filter.status], { index: 'userId_status' })
    .count()
    .run();

  if (criteria.direction === config.SORT_DIRECTION.DESC) {
    chain = chain.orderBy(r.desc(criteria.sort));
  } else {
    chain = chain.orderBy(r.asc(criteria.sort));
  }

  const docs = yield chain
    .skip(lo.offset)
    .limit(lo.limit)
    .eqJoin('followerId', r.table(User.getTableName()), { ordered: true })
    .map(item => item('right').without('password'))
    .run();

  const merged = yield computeFollowStates(auth, docs);
  const transformed = helper.decorateWithSignedUrl(merged, ['photo', 'photos']);
  return helper.decorateWithPaginatedResponse(transformed, lo, total);
}

// the joi validation schema for getUserFollowers
getUserFollowers.schema = {
  auth: joi.object().keys({
    userId: joi.string().required(),
    accessToken: joi.string(),
  }).required(),
  id: joi.string().required(),
  criteria: joi.object().keys({
    status: joi.number().integer().valid([0]),
    limit: joi.number().integer().min(0).default(config.pagination.limit),
    offset: joi.number().integer().min(0).default(config.pagination.offset),
    direction: joi.string().valid(_.values(config.SORT_DIRECTION)).default(config.SORT_DIRECTION.DESC),
    sort: joi.string().valid(['createdAt', 'updatedAt', 'followerId', 'userId', 'id']).default('updatedAt'),
  }).required(),
};

/**
 * Compute the single user follow state relationship between current user (auth) and specified user `userId`
 *
 * @param   {Object}      auth              currently logged in user auth identification
 * @param   {String}      userId            the id of the user
 * @return  {Object}                        The FollowState model definition
 */
function* computeSingleUserFollowState(auth, userId) {
  const currentUserFollower = yield r.table(UserFollower.getTableName())
    .getAll([auth.userId, userId], { index: 'userId_followerId' })
    .nth(0)
    .default(null)
    .run();

  const currentUserBlockedUser = yield r.table(UserBlock.getTableName())
    .getAll([auth.userId, userId], { index: 'userId_blockedId' })
    .nth(0)
    .default(null)
    .run();

  const userBlockedCurrentUser = yield r.table(UserBlock.getTableName())
    .getAll([userId, auth.userId], { index: 'userId_blockedId' })
    .nth(0)
    .default(null)
    .run();

  let state = 0;
  if (userId === auth.userId) {
    state |= 64;                                   // eslint-disable-line no-bitwise
  } else if (userBlockedCurrentUser) {
    state |= 32;                                  // eslint-disable-line no-bitwise
  } else if (currentUserBlockedUser) {
    state |= 16;                                  // eslint-disable-line no-bitwise
  } else if (currentUserFollower && currentUserFollower.status === 2) {
    state |= 8;                                   // eslint-disable-line no-bitwise
  } else if (currentUserFollower && currentUserFollower.status === 0) {
    state |= 4;                                   // eslint-disable-line no-bitwise
  } else if (currentUserFollower && currentUserFollower.status === 1) {
    state |= 2;                                   // eslint-disable-line no-bitwise
  }
  return {
    followState: state,
  };
}

/**
 * Add users as followers
 * The list of user ids are added as current auth user followers
 *
 * @param   {Object}      auth              currently logged in user auth identification
 * @param   {String}      userId            the id of the user
 * @param   {Object}      entity            the request payload
 * @return  {Void}                          this method doesn't return anything
 */
function* addUserFollower(auth, userId, entity) {
  if (auth.userId !== userId) {
    throw new errors.NotPermittedError('user can only add followers to self account',
      new Error(ErrorCodes.OPERATION_NOT_PERMITTED));
  }
  const settings = yield r.table(UserSetting.getTableName())
    .getAll(entity.userId, { index: 'userId' }).nth(0).default(null)
    .run();

  if (!settings) {
    throw new errors.data.DataError('corrupt user settings state', new Error(ErrorCodes.CORRUPT_USER_SETTINGS_STATE));
  }

  const existing = yield r.table(UserFollower.getTableName())
    .getAll([entity.userId, userId], { index: 'userId_followerId' })
    .nth(0)
    .default(null)
    .run();

  const status = settings.approveFollowers === 1 ? 0 : 1;

  if (!existing) {
    yield UserFollower.save({ userId: entity.userId, followerId: userId, status });
  }
  return yield computeSingleUserFollowState(auth, entity.userId);
}

// the joi validation schema for addUserFollower
addUserFollower.schema = {
  auth: joi.object().keys({
    userId: joi.string().required(),
    accessToken: joi.string(),
  }).required(),
  userId: joi.string().required(),
  entity: joi.object().keys({
    userId: joi.string().guid({ version: 'uuidv4' }).required(),
  }).required(),
};

/**
 * Remove users from followers list
 * The list of user ids are removed as current auth user followers
 *
 * @param   {Object}      auth              currently logged in user auth identification
 * @param   {String}      userId            the id of the user
 * @param   {Object}      entity            the request payload
 * @return  {Void}                          this method doesn't return anything
 */
function* deleteUserFollower(auth, userId, entity) {
  if (auth.userId !== userId) {
    throw new errors.NotPermittedError('user can only remove followers from self account',
      new Error(ErrorCodes.OPERATION_NOT_PERMITTED));
  }
  yield r.table(UserFollower.getTableName())
    .getAll([entity.userId, userId], { index: 'userId_followerId' }).delete().run();

  return yield computeSingleUserFollowState(auth, entity.userId);
}

// the joi validation schema for deleteUserFollower
deleteUserFollower.schema = {
  auth: joi.object().keys({
    userId: joi.string().required(),
    accessToken: joi.string(),
  }).required(),
  userId: joi.string().required(),
  entity: joi.object().keys({
    userId: joi.string().guid({ version: 'uuidv4' }).required(),
  }).required(),
};

/**
 * Approve a user follower request
 * If the user has turned on approveFollower setting than each of the follower requests must be explicitly approved
 *
 * @param   {Object}      auth              currently logged in user auth identification
 * @param   {String}      userId            the id of the user
 * @param   {Object}      entity            the request payload
 * @return  {Void}                          this method doesn't return anything
 */
function* approveFollowerRequest(auth, userId, entity) {
  if (auth.userId !== userId) {
    throw new errors.NotPermittedError('user can only approve followers for self account',
      new Error(ErrorCodes.OPERATION_NOT_PERMITTED));
  }

  const existing = yield UserFollower
    .getAll([entity.userId, userId], { index: 'userId_followerId' })
    .nth(0)
    .default(null)
    .run();

  if (existing) {
    yield existing.merge({ status: 1 }).save();
  }
  return yield computeSingleUserFollowState(auth, entity.userId);
}

// the joi validation schema for approveFollowerRequest
approveFollowerRequest.schema = {
  auth: joi.object().keys({
    userId: joi.string().required(),
    accessToken: joi.string(),
  }).required(),
  userId: joi.string().required(),
  entity: joi.object().keys({
    userId: joi.string().guid({ version: 'uuidv4' }).required(),
  }).required(),
};

/**
 * Reject a user follower request
 * If the user has turned on approveFollower setting than each of the follower requests
 * must be explicitly approved or rejected
 *
 * @param   {Object}      auth              currently logged in user auth identification
 * @param   {String}      userId            the id of the user
 * @param   {Object}      entity            the request payload
 * @return  {Void}                          this method doesn't return anything
 */
function* rejectFollowerRequest(auth, userId, entity) {
  if (auth.userId !== userId) {
    throw new errors.NotPermittedError('user can only reject followers for self account',
      new Error(ErrorCodes.OPERATION_NOT_PERMITTED));
  }

  const existing = yield UserFollower
    .getAll([entity.userId, userId], { index: 'userId_followerId' })
    .nth(0)
    .default(null)
    .run();

  if (existing) {
    yield existing.merge({ status: 2 }).save();
  }
  return yield computeSingleUserFollowState(auth, entity.userId);
}

// the joi validation schema for rejectFollowerRequest
rejectFollowerRequest.schema = {
  auth: joi.object().keys({
    userId: joi.string().required(),
    accessToken: joi.string(),
  }).required(),
  userId: joi.string().required(),
  entity: joi.object().keys({
    userId: joi.string().guid({ version: 'uuidv4' }).required(),
  }).required(),
};

/**
 * Get the users followings
 *
 * @param   {Object}      auth              currently logged in user auth identification
 * @param   {String}      id                the id of the user
 * @param   {Object}      criteria          the filter criteria
 * @return  {Array}                         the currently logged in user's followings
 *                                          each follower is User payload
 */
function* getUserFollowings(auth, id, criteria) {
  let filter = { followerId: id, status: 1 };

  if (_.has(criteria, 'status')) {
    filter.status = criteria.status;
  }
  if (auth.userId === id) {
    // if current user is requesting following list return all
    filter = _.omit(filter, 'status');
  }

  const lo = helper.parseLimitAndOffset(criteria);

  const total = yield r.table(UserFollower.getTableName())
    .filter(filter)
    .count()
    .run();

  let chain = r.table(UserFollower.getTableName())
    .filter(filter);

  if (criteria.direction === config.SORT_DIRECTION.DESC) {
    chain = chain.orderBy(r.desc(criteria.sort));
  } else {
    chain = chain.orderBy(r.asc(criteria.sort));
  }

  const docs = yield chain
    .skip(lo.offset)
    .limit(lo.limit)
    .eqJoin('userId', r.table(User.getTableName()), { ordered: true })
    .map(item => item('right').without('password'))
    .run();

  const merged = yield computeFollowStates(auth, docs);
  const transformed = helper.decorateWithSignedUrl(merged, ['photo', 'photos']);
  return helper.decorateWithPaginatedResponse(transformed, lo, total);
}

// the joi validation schema for getUserFollowings
getUserFollowings.schema = {
  auth: joi.object().keys({
    userId: joi.string().required(),
    accessToken: joi.string(),
  }).required(),
  id: joi.string().required(),
  criteria: joi.object().keys({
    status: joi.number().integer().valid([0, 1, 2]),
    limit: joi.number().integer().min(0).default(config.pagination.limit),
    offset: joi.number().integer().min(0).default(config.pagination.offset),
    direction: joi.string().valid(_.values(config.SORT_DIRECTION)).default(config.SORT_DIRECTION.DESC),
    sort: joi.string().valid(['createdAt', 'updatedAt', 'followerId', 'userId', 'id']).default('updatedAt'),
  }).required(),
};


/**
 * Get the user info
 * User info returns some less fields than user profile
 *
 * @param   {Object}      auth              currently logged in user auth identification
 * @param   {String}      id                the id of the user
 * @return  {Object}                        the currently logged in user's profile
 */
function* getUserInfo(auth, id) {
  const user = yield helper.fetch(User, id, thinky);
  const plain = helper.getRawObject(user, 'password');
  const phoneNumbers = yield UserPhoneNumber.filter({ userId: id });
  const lc = yield getUserLinkedCalendars({ userId: id }, id);

  const info = _.extend(plain, {
    phoneNumbers,
    settings: lc.settings,
    calendars: lc.calendars,
  });
  return helper.decorateWithSignedUrl(info, ['photo', 'photos']);
}

// the joi validation schema for getUserInfo
getUserInfo.schema = {
  auth: joi.object().keys({
    userId: joi.string().required(),
    accessToken: joi.string(),
  }).required(),
  id: joi.string().required(),
};

/**
 * Get the full user profile
 * Full user profile does include no of followers, activities, current activities etc.
 *
 * @param   {Object}      auth              currently logged in user auth identification
 * @param   {String}      id                the id of the user
 * @return  {Object}                        the currently logged in user's profile
 */
function* getUserProfile(auth, id) {            // eslint-disable-line no-unused-vars
  const plain = yield getUserInfo(auth, id);
  const connections = yield UserSocialConnection.filter({ userId: id });

  const now = moment().valueOf();

  const followers = yield r.table(UserFollower.getTableName())
    .getAll([id, 1], { index: 'userId_status' }).count().run();

  const followings = yield r.table(UserFollower.getTableName())
    .getAll([id, 1], { index: 'followerId_status' }).count().run();

  // all the activities for the user
  const activities = yield r.table(Activity.getTableName())
    .getAll(id, { index: 'author' }).count().run();

  // the activities which are not expired
  const current = yield r.table(Activity.getTableName())
    .between(now, Number.MAX_SAFE_INTEGER, { index: 'start_duration' }).count().run();

  const currentUserFollowers = yield r.table(UserFollower.getTableName())
    .getAll([auth.userId, id], { index: 'userId_followerId' }).run();

  const currentUserFollowings = yield r.table(UserFollower.getTableName())
    .getAll([id, auth.userId], { index: 'userId_followerId' }).run();

  const currentUserBlockedUsers = yield r.table(UserBlock.getTableName())
    .getAll([auth.userId, id], { index: 'userId_blockedId' }).run();

  const userBlockedUsers = yield r.table(UserBlock.getTableName())
    .getAll([id, auth.userId], { index: 'userId_blockedId' }).run();

  let status = 0;

  if (currentUserFollowers && currentUserFollowers.length > 0) {
    status |= 4;                              // eslint-disable-line no-bitwise
  }
  if (currentUserFollowings && currentUserFollowings.length > 0) {
    status |= 2;                              // eslint-disable-line no-bitwise
  }
  if (currentUserBlockedUsers && currentUserBlockedUsers.length > 0) {
    status |= 8;                              // eslint-disable-line no-bitwise
  }
  if (userBlockedUsers && userBlockedUsers.length > 0) {
    status |= 16;                              // eslint-disable-line no-bitwise
  }
  if (auth.userId === id) {
    status |= 32;                             // eslint-disable-line no-bitwise
  }

  const profile = _.extend(plain, {
    stats: { followers, followings, activities, current },
    followState: { status },
    connections: helper.getRawObject(connections, ['accessToken', 'refreshToken']),
  });
  return helper.decorateWithSignedUrl(profile, ['photo', 'photos']);
}

// the joi validation schema for getUserProfile
getUserProfile.schema = {
  auth: joi.object().keys({
    userId: joi.string().required(),
    accessToken: joi.string(),
  }).required(),
  id: joi.string().required(),
};

/**
 * Send the verification code to user's phone number
 *
 * @param   {Object}      auth              currently logged in user auth identification
 * @param   {Object}      entity            the request payload
 * @param   {String}      id                the id of the user to send the verification code
 * @return  {Object}                        a unique id that represents this verification code request
 *                                          this id is mandatory while verifying the code
 *                                          SendVerificationCodeRes payload
 */
function* sendVerificationCode(auth, entity, id) {
  if (auth.userId !== id) {
    throw new errors.NotPermittedError('user can only send verification code to self account',
      new Error(ErrorCodes.OPERATION_NOT_PERMITTED));
  }

  const user = yield helper.fetch(User, id, thinky);

  if (!user) {
    throw new errors.NotFoundError('user not found with specified id',
      new Error(ErrorCodes.RESOURCE_NOT_FOUND));
  }

  const phoneRecords = yield UserPhoneNumber.filter({ userId: id });

  // if user already has existing phone number than this number will be secondary.
  let primary = 1;
  if (phoneRecords && phoneRecords.length > 0) {
    primary = 0;
  }

  if (_.has(entity, 'countryCode') && _.has(entity, 'phoneNumber') &&
    _.has(entity, 'deviceId') && _.has(entity, 'device')) {
    // check that this number is associated with any other account

    const existingRecords = yield UserPhoneNumber.filter({ countryCode: entity.countryCode,
      phoneNumber: entity.phoneNumber });

    if (existingRecords && existingRecords.length > 0) {
      throw new errors.ArgumentError('This number is associated with existing user account, ' +
        `userId ${existingRecords[0].userId}, status ${existingRecords[0].status}`,
        new Error(ErrorCodes.PHONE_NUMBER_LINKED_WITH_OTHER_ACCOUNT));
    }
    const userPhoneRecord = yield UserPhoneNumber.save({
      userId: id,
      countryCode: entity.countryCode,
      phoneNumber: entity.phoneNumber,
      deviceId: entity.deviceId,
      deviceType: entity.device,
      primary,
    });
    try {
      return yield doSendVerificationCode(user, `${entity.countryCode}${entity.phoneNumber}`, userPhoneRecord.id);
    } catch (err) {
      logger.error('send sms error, rollback', helper.stringify(err));
      yield userPhoneRecord.delete();
      throw err;
    }
  }
  // if entity is not valid send code to existing primary number
  const primaryNumber = phoneRecords.filter(single => single.primary === 1);
  if (!primaryNumber || primaryNumber.length !== 1) {
    // race condition should never happen
    throw new errors.data.DataError('multiple primary numbers',
      new Error(ErrorCodes.MULTIPLE_PRIMARY_NUMBERS));
  }
  // send sms
  return yield doSendVerificationCode(user, `${primaryNumber[0].countryCode}${primaryNumber[0].phoneNumber}`,
    primaryNumber[0].id);
}

sendVerificationCode.schema = {
  auth: joi.object().keys({
    userId: joi.string().required(),
    accessToken: joi.string(),
  }).required(),
  id: joi.string().required(),
  entity: joi.object().keys({
    countryCode: joi.string(),
    phoneNumber: joi.string(),
    deviceId: joi.string(),
    device: joi.string().valid(_.values(DEVICE_TYPES)),
  }).required(),
};

/**
 * Verify the verification code sent earlier
 *
 * @param   {Object}      auth              currently logged in user auth identification
 * @param   {Object}      entity            the request payload
 * @param   {String}      id                the id of the user to send the verification code
 * @return  {Void}                          the function doesn't return anything
 */
function* verifyCode(auth, entity, id) {
  if (auth.userId !== id) {
    throw new errors.NotPermittedError('user can only verify code for self account',
      new Error(ErrorCodes.OPERATION_NOT_PERMITTED));
  }
  const phoneVerificationRecord = yield helper.fetch(UserPhoneNumberVerification, entity.id, thinky);

  if (!phoneVerificationRecord) {
    throw new errors.NotFoundError('invalid phone verification id',
      new Error(ErrorCodes.INVALID_PHONE_VERIFICATION_ID_RECORD_NOT_EXIST));
  } else if (phoneVerificationRecord.code !== entity.code) {
    throw new errors.ArgumentError('invalid verification code',
      new Error(ErrorCodes.INVALID_PHONE_VERIFICATION_CODE));
  }

  const userPhoneNumber = yield UserPhoneNumber.get(phoneVerificationRecord.referenceId);

  // mark user phone as verified
  const user = yield User.get(userPhoneNumber.userId);
  if (user.id !== id) {
    throw new errors.NotPermittedError('code generated for different user',
      new Error(ErrorCodes.OPERATION_NOT_PERMITTED));
  }

  // verify the phone change status
  yield userPhoneNumber.merge({ status: 1 }).save();
  yield user.merge({ status: user.status | 2 }).save();           // eslint-disable-line no-bitwise
  yield phoneVerificationRecord.delete();

  const profile = yield getUserInfo({ userId: id }, id);
  const tokens = yield generateTokens(user);

  const doc = {
    tokens,
    user: profile,
  };
  return helper.decorateWithSignedUrl(doc, ['photo', 'photos']);
}

// joi validation schema for verifyCode
verifyCode.schema = {
  auth: joi.object().keys({
    userId: joi.string().required(),
    accessToken: joi.string(),
  }).required(),
  entity: joi.object().keys({
    id: joi.string().required(),
    code: joi.string().required(),
  }).required(),
  id: joi.string().required(),
};

/**
 * Verify the user's email address
 *
 * @param   {Object}      entity            the request payload
 * @return  {Void}                          the function doesn't return anything
 */
function* verifyEmail(entity) {
  // identify the user with specified verify email token
  const userEmailRecords = yield UserEmailVerification.filter({ token: entity.token });

  if (!userEmailRecords || userEmailRecords.length === 0) {
    throw new errors.ArgumentError('invalid verification token',
      new Error(ErrorCodes.INVALID_EMAIL_VERIFICATION_TOKEN_NOT_EXIST));
  }

  // check that token is not expired
  if (moment().valueOf() >= userEmailRecords[0].expires) {
    throw new errors.ArgumentError('verification token expired',
      new Error(ErrorCodes.INVALID_EMAIL_VERIFICATION_TOKEN_EXPIRED));
  }

  const user = yield User.get(userEmailRecords[0].userId);
  // change the user status to verified email and user is active
  yield user.merge({ status: user.status | 5 }).save();               // eslint-disable-line no-bitwise
  // delete the verify record
  yield userEmailRecords[0].delete();
}

// joi validation schema for verifyEmail
verifyEmail.schema = {
  entity: joi.object().keys({
    token: joi.string().required(),
  }).required(),
};

/**
 * Refresh the access token issued with the specified refresh token
 *
 * @param   {Object}      entity            the request headers
 * @return  {Object}                        the LoginRes payload
 */
function* refreshToken(entity) {
  const user = yield helper.fetch(User, entity.userId, thinky);
  if (!user) {
    throw new errors.NotFoundError('user not found with specified id', ErrorCodes.RESOURCE_NOT_FOUND);
  }
  // generate a new access token
  const accessToken = yield helper.generateToken({ userId: user.id }, { expiresIn: config.JWT_EXPIRES_IN });

  // save the access token
  yield AccessToken.save({
    token: accessToken,
    userId: user.id,
  });

  const profile = yield getUserInfo({ userId: user.id }, user.id);

  const doc = {
    tokens: {
      accessToken,
      refreshToken: entity.accessToken,
    },
    user: profile,
  };
  return helper.decorateWithSignedUrl(doc, ['photo', 'photos']);
}

// the joi validation schema for refreshToken
refreshToken.schema = {
  entity: joi.object().keys({
    userId: joi.string().required(),
    accessToken: joi.string().required(),
  }).required(),
};


/**
 * Get the logged in user's notification preferences
 *
 * @param   {Object}      auth              currently logged in user auth identification
 * @param   {String}      id                the id of the user
 * @return  {Object}                        the NotificationPreferences payload
 */
function* getUserNotificationPreferences(auth, id) {
  const user = yield helper.fetch(User, auth.userId, thinky);
  if (!user) {
    throw new errors.NotFoundError('user not found with specified id',
      new Error(ErrorCodes.RESOURCE_NOT_FOUND));
  }
  if (auth.userId !== id) {
    // a user can only view his own notification preferences
    throw new errors.NotPermittedError('user not permitted for this operation',
      new Error(ErrorCodes.OPERATION_NOT_PERMITTED));
  }
  const preferences = yield UserNotificationPreference.filter({ userId: user.id });
  if (!preferences || preferences.length === 0) {
    throw new errors.NotFoundError('notification preferences not found for specified user',
      new Error(ErrorCodes.RESOURCE_NOT_FOUND));
  }
  return helper.getRawObject(preferences[0], 'userId');
}

// the joi validation schema for getUserNotificationPreferences
getUserNotificationPreferences.schema = {
  auth: joi.object().keys({
    userId: joi.string().required(),
    accessToken: joi.string(),
  }).required(),
  id: joi.string().required(),
};


/**
 * Update the logged in user's notification preferences
 *
 * @param   {Object}      auth              currently logged in user auth identification
 * @param   {String}      id                the id of the user
 * @param   {Object}      entity            the request payload
 * @return  {Object}                        the NotificationPreferences payload
 */
function* updateUserNotificationPreferences(auth, id, entity) {
  const user = yield helper.fetch(User, auth.userId, thinky);
  if (!user) {
    throw new errors.NotFoundError('user not found with specified id',
      new Error(ErrorCodes.RESOURCE_NOT_FOUND));
  }
  if (auth.userId !== id) {
    // a user can only update his own notification preferences
    throw new errors.NotPermittedError('user not permitted for this operation',
      new Error(ErrorCodes.OPERATION_NOT_PERMITTED));
  }
  const preferences = yield UserNotificationPreference.filter({ userId: user.id });
  if (!preferences || preferences.length === 0) {
    throw new errors.NotFoundError('notification preferences not found for specified user',
      new Error(ErrorCodes.RESOURCE_NOT_FOUND));
  }
  const existing = preferences[0];
  const result = yield existing.merge(entity).save();
  return helper.getRawObject(result, 'userId');
}

// the joi validation schema for updateUserNotificationPreferences
updateUserNotificationPreferences.schema = {
  auth: joi.object().keys({
    userId: joi.string().required(),
    accessToken: joi.string(),
  }).required(),
  id: joi.string().required(),
  entity: joi.object().keys({
    preferences: joi.number().integer().min(0).required(),
  }).required(),
};

/**
 * Update the user's profile. User profile includes bio, name etc
 *
 * @param   {Object}      auth              currently logged in user auth identification
 * @param   {String}      id                the id of the user
 * @param   {Object}      entity            the request payload
 * @return  {Object}                        the User payload
 */
function* updateUserProfile(auth, id, entity) {
  if (auth.userId !== id) {
    throw new errors.NotPermittedError('user can only update self profile',
      new Error(ErrorCodes.OPERATION_NOT_PERMITTED));
  }
  const user = yield helper.fetch(User, id, thinky);
  if (!user) {
    throw new errors.NotFoundError('user not found with specified id',
      new Error(ErrorCodes.RESOURCE_NOT_FOUND));
  }
  if (_.has(entity, 'approveFollowers')) {
    const settingRecords = yield UserSetting.filter({ userId: id });
    if (!settingRecords || settingRecords.length !== 1) {
      // race condition should never happen
      throw new errors.data.DataError('corrupt user settings state',
        new Error(ErrorCodes.CORRUPT_USER_SETTINGS_STATE));
    }
    yield settingRecords[0].merge({ approveFollowers: entity.approveFollowers }).save();
  }

  yield user.merge({
    fullName: _.has(entity, 'fullName') ? entity.fullName : user.fullName,
    bio: _.has(entity, 'bio') ? entity.bio : user.bio,
  }).save();
}

// joi validation schema for updateUserProfile
updateUserProfile.schema = {
  auth: joi.object().keys({
    userId: joi.string().required(),
    accessToken: joi.string(),
  }).required(),
  id: joi.string().required(),
  entity: joi.object().keys({
    fullName: joi.string(),
    bio: joi.string().allow(null),
    approveFollowers: joi.number().min(0).max(1),
  }).required(),
};

/**
 * Update a single calendar object.
 * @private
 *
 * @param   {String}      userId            the id of the user
 * @param   {Object}      entity            the request payload, UserLinkedCalendar model definition
 * @return  {Void}                          this function doesn't return anything
 */
function* updateSingleCalendar(userId, entity) {
  const records = yield UserLinkedCalendar.filter({ userId, type: entity.type });

  if (!records || records.length === 0) {
    // create a new record
    yield UserLinkedCalendar.save({
      userId,
      type: entity.type,
      autoUpdate: entity.autoUpdate,
      accessToken: entity.accessToken,
      refreshToken: entity.refreshToken,
      metadata: entity.metadata,
    });
  } else if (records && records.length > 1) {
    throw new errors.data.DataError('corrupt user linked calendars state',
      new Error(ErrorCodes.CORRUPT_USER_LINKED_CALENDARS_STATE));
  } else {
    yield records[0].merge({
      autoUpdate: entity.autoUpdate,
      accessToken: entity.accessToken,
      refreshToken: entity.refreshToken,
      metadata: entity.metadata,
    }).save();
  }
}

/**
 * Add a new linked calendar to user's account.
 * Initially when user is first created there won't be any linked calendars.
 * This API adds a new linked calendar to user account
 * See the request/response payload in api definition
 *
 * @param   {Object}      auth              currently logged in user auth identification
 * @param   {String}      id                the id of the user
 * @param   {Object}      entity            the request payload, UserLinkedCalendarDetail model definition
 * @return  {Void}                          this function doesn't return anything
 */
function* addUserLinkedCalendar(auth, id, entity) {
  if (auth.userId !== id) {
    throw new errors.NotPermittedError('user can only add linked calendars to self account',
      new Error(ErrorCodes.OPERATION_NOT_PERMITTED));
  }
  const user = yield helper.fetch(User, id, thinky);
  if (!user) {
    throw new errors.NotFoundError('user not found with specified id',
      new Error(ErrorCodes.RESOURCE_NOT_FOUND));
  }

  if (entity.type === SOCIAL_CONNECTION_TYPES.google) {
    const tokens = yield exchangeGoogleServerAuthCode(entity.serverAuthCode);
    entity.accessToken = tokens.accessToken;
    entity.refreshToken = tokens.refreshToken;
  }

  // if required, update default activity duration
  if (_.has(entity, 'defaultActivityDuration')) {
    const settingRecords = yield UserSetting.filter({ userId: id });
    if (!settingRecords || settingRecords.length !== 1) {
      // race condition should never happen
      throw new errors.data.DataError('corrupt user settings state',
        new Error(ErrorCodes.CORRUPT_USER_SETTINGS_STATE));
    }
    yield settingRecords[0].merge({ defaultActivityDuration: entity.defaultActivityDuration }).save();
  }

  if (_.has(entity, 'calendars')) {
    // update calendars
    const promises = entity.calendars.map(single => helper.executeWrapped(updateSingleCalendar, id, single));
    yield Promise.all(promises);
  }
  return yield getUserLinkedCalendars(auth, id);
}

addUserLinkedCalendar.schema = {
  auth: joi.object().keys({
    userId: joi.string().required(),
    accessToken: joi.string(),
  }).required(),
  id: joi.string().required(),
  entity: joi.object().keys({
    calendars: joi.array().items(joi.object().keys({
      accessToken: joi.when('type', {
        is: CALENDAR_TYPES.apple,
        then: joi.string(),
        otherwise: joi.any().forbidden(),
      }),
      serverAuthCode: joi.when('type', {
        is: CALENDAR_TYPES.google,
        then: joi.string().required(),
        otherwise: joi.any().forbidden(),
      }),
      refreshToken: joi.string(),
      type: joi.string().valid(_.values(CALENDAR_TYPES)).required(),
      autoUpdate: joi.number().integer().min(0).max(1),
      metadata: joi.object(),
    }).required()).min(1),
    defaultActivityDuration: joi.number().integer().min(1),
  }),
};

/**
 * Add a photo to a user profile
 * The files to uploaded and resized.
 * The server only supports single file for the API.
 *
 * @param   {Object}      auth              currently logged in user auth identification
 * @param   {String}      id                the id of the user
 * @param   {Object}      entity            the request payload, Multer file object
 * @return  {Object}                        MediaUploadRes modeil definition (see api sepc for details)
 */
function* addUserProfilePhoto(auth, id, entity) {
  if (auth.userId !== id) {
    throw new errors.NotPermittedError('user can only upload media to self account',
      new Error(ErrorCodes.OPERATION_NOT_PERMITTED));
  }
  const user = yield helper.fetch(User, id, thinky);
  if (!user) {
    throw new errors.NotFoundError('user not found with specified id',
      new Error(ErrorCodes.RESOURCE_NOT_FOUND));
  }

  const uphotos = yield helper.processAndUploadImagesToS3(auth.userId, [entity], config.resize.PROFILE);

  yield user.merge({ photo: uphotos[0] }).save();
}

// joi validation schema for addUserProfilePhoto
addUserProfilePhoto.schema = {
  auth: joi.object().keys({
    userId: joi.string().required(),
    accessToken: joi.string(),
  }).required(),
  id: joi.string().required(),
  entity: joi.object().required(),
};

/**
 * Transform the group into GroupWithFollowState response model definition
 * @private
 *
 * @param   {Object}      auth              currently logged in user auth identification
 * @param   {Object}      group             the group document
 * @return  {Object}                        GroupWithFollowState swagger model definition
 */
function* transformGroup(auth, group) {
  const members = group.members.map(single => _.omit(single.right, 'password'));
  const mfs = yield computeFollowStates(auth, members);
  return _.extend(group, {
    owner: _.omit(group.owner, 'password'),
    members: mfs,
  });
}


/**
 * The user can sync his contacts using `/contacts/sync` API.
 * This API returns previously synced contacts and is very fast than sync api.
 *
 * @param   {Object}      auth              currently logged in user auth identification
 * @param   {String}      userId            the id of the user
 * @return  {Object}                        UserContacts swagger model definition
 */
function* getUserFriends(auth, userId) {
  if (auth.userId !== userId) {
    throw new errors.NotPermittedError('user can only view self friends',
      new Error(ErrorCodes.OPERATION_NOT_PERMITTED));
  }
  // get groups and members
  const rgroups = yield r.table(Group.getTableName())
    .getAll(userId, { index: 'owner' })
    .map((group) => {
      const owner = r.table(User.getTableName()).get(group('owner'));
      return group.merge(group, { owner });
    })
    .map((group) => {
      const docs = r.table(GroupMember.getTableName()).getAll(group('id'), { index: 'groupId' })
        .orderBy(r.desc('createdAt'))
        .eqJoin('memberId', r.table(User.getTableName()));
      return group.merge(group, { members: docs });
    })
    .run();

  const gpromises = rgroups.map(group => helper.executeWrapped(transformGroup, auth, group));

  const groups = yield Promise.all(gpromises);

  // get all contacts
  const rcontacts = yield r.table(UserContact.getTableName())
    .getAll(userId, { index: 'userId' }).run();

  const contacts = helper.getRawObject(rcontacts, 'userId');

  // get current user followers
  const rfo = yield r.table(UserFollower.getTableName())
    .getAll([userId, 1], { index: 'userId_status' })
    .orderBy(r.desc('createdAt'))
    .eqJoin('followerId', r.table(User.getTableName()))
    .run();

  // user followers plain objects
  const rfop = rfo.map(single => helper.getRawObject(single.right, 'password'));
  // user followers ids
  const rfopids = rfop.map(single => single.id);
  // get user friends which are not user followers
  const rf = yield r.table(UserFriend.getTableName())
    .filter(doc => r.expr(rfopids).contains(doc('friendId')).not().and(doc('userId').eq(userId)))
    .orderBy(r.desc('createdAt'))
    .eqJoin('friendId', r.table(User.getTableName()))
    .run();

  const rfp = rf.map(single => helper.getRawObject(single.right, 'password'));

  const users = yield computeFollowStates(auth, rfop.concat(rfp));

  const merged = { groups, contacts, users };
  return helper.decorateWithSignedUrl(merged, ['photo', 'photos']);
}

/**
 * Get all the facebook friends for the specified access token
 * @private
 *
 * @param   {String}      accessToken       the user scope access token
 * @return  {Promise}                       returns a promise which is resolve after all friends are fetched
 */
function getAllFacebookFriends(accessToken) {
  return new Promise((accept, reject) => {
    let friends = [];
    /**
     * Function to call facebook list contacts api recursively to get list of all friends
     *
     * @param   {String}        apiUrl                  the api url to call
     * @return  {Void}                                  this function doesn't return anything
     */
    function recursiveAPICall(apiUrl) {
      rp({
        url: apiUrl,
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        json: true,
        simple: true,
      }).then((response) => {
        if (_.has(response, 'data')) {
          friends = friends.concat(response.data);
        }
        if (_.has(response, 'paging.next')) {
          recursiveAPICall(response.paging.next);
        } else {
          accept(friends);
        }
      }).catch(reject);
    }
    const apiUrl = `${config.SOCIAL_CONNECTIONS.FACEBOOK_PROFILE_ENDPOINT}/me/friends`;
    recursiveAPICall(apiUrl);
  });
}

/**
 * Helper method to sync a single facebook contact
 * @private
 *
 * @param   {String}      userId            the specified user id
 * @param   {Object}      friend            the single facebook friend object
 * @return  {Promise}                       returns a promise which is resolve after sync completes
 */
function* syncFacebookContact(userId, friend) {
  // check if there is an app user with specified facebook friend
  const connection = yield r.table(UserSocialConnection.getTableName())
    .getAll([friend.id, SOCIAL_CONNECTION_TYPES.facebook], { index: 'socialId_type' }).nth(0)
    .default(null)
    .run();

  if (connection) {
    // if there is a connection save it in friends table if not already saved
    const ufriend = yield r.table(UserFriend.getTableName())
      .getAll([userId, connection.userId], { index: 'userId_friendId' }).nth(0)
      .default(null)
      .run();

    if (!ufriend) {
      yield UserFriend.save({ userId, friendId: connection.userId });
    }
  } else {
    // there is no app user with the specified friend, create a user contact
    const existing = yield r.table(UserContact.getTableName())
      .getAll([userId, CONTACT_TYPES.facebook, friend.id], { index: 'userId_type_facebookId' }).nth(0)
      .default(null)
      .run();

    if (!existing) {
      yield UserContact.save({
        userId,
        type: CONTACT_TYPES.facebook,
        facebookId: friend.id,
      });
    }
  }
}

/**
 * Sync the facebook contacts for the specified user id
 * @private
 *
 * @param   {String}      userId            the specified user id
 * @return  {Promise}                       returns a promise which is resolve after sync completes
 */
function* syncFacebook(userId) {
  // first get the user facebook social connection
  const connection = yield r.table(UserSocialConnection.getTableName())
    .getAll([userId, SOCIAL_CONNECTION_TYPES.facebook], { index: 'userId_type' }).nth(0)
    .default(null)
    .run();

  if (connection) {
    // first get all facebook friends
    const friends = yield getAllFacebookFriends(connection.accessToken);
    // sync all of these friends, try to find app user for these friends and
    // if app user not found than these will become user contact
    const promises = friends.map(single => helper.executeWrapped(syncFacebookContact, userId, single));

    yield Promise.all(promises);
  }
}

/**
 * Get all the google friends for the specified access token
 * @private
 *
 * @return  {Promise}                       returns a promise which is resolve after all friends are fetched
 */
function getAllGoogleContacts() {
  return new Promise((accept, reject) => {
    let friends = [];
    /**
     * Function to call google list people api recursively to get list of all peoples
     *
     * @param   {Object}        params                  the googleapis people connections list method params
     * @return  {Void}                                  this function doesn't return anything
     */
    function recursiveAPICall(params) {
      Promise.fromCallback(cb => people.people.connections.list(params, cb)).then((response) => {
        if (_.has(response, 'connections')) {
          friends = friends.concat(response.connections);
        }
        if (_.has(response, 'nextPageToken')) {
          const nparams = _.extend(params, { pageToken: response.nextPageToken });
          recursiveAPICall(nparams);
        } else {
          accept(friends);
        }
      }).catch(reject);
    }
    const params = {
      requestSyncToken: false,
      resourceName: config.SOCIAL_CONNECTIONS.GOOGLE_PEOPLE_API_RESOURCE_NAME,
      pageSize: 500,
      auth: googleOauth2Client,
    };
    recursiveAPICall(params);
  });
}


/**
 * Helper method to sync a single google contact
 * @private
 *
 * @param   {String}      userId            the specified user id
 * @param   {String}      person            the single google Person object
 * @return  {Promise}                       returns a promise which is resolve after sync completes
 */
function* syncGoogleContact(userId, person) {
  // get the google profile id from person object
  const googleId = helper.getGoogleProfileIdFromPerson(person);

  if (_.isString(googleId)) {
    // check if there is an app user with specified googleId
    const connection = yield r.table(UserSocialConnection.getTableName())
      .getAll([googleId, SOCIAL_CONNECTION_TYPES.google], { index: 'socialId_type' }).nth(0)
      .default(null)
      .run();

    if (connection) {
      // if there is a connection save it in friends table if not already saved
      const friend = yield r.table(UserFriend.getTableName())
        .getAll([userId, connection.userId], { index: 'userId_friendId' }).nth(0)
        .default(null)
        .run();

      if (!friend) {
        yield UserFriend.save({ userId, friendId: connection.userId });
      }
    } else {
      // there is no app user with the specified contact, create a user contact
      const existing = yield r.table(UserContact.getTableName())
        .getAll([userId, CONTACT_TYPES.google, googleId], { index: 'userId_type_googleId' }).nth(0)
        .default(null)
        .run();

      if (!existing) {
        yield UserContact.save({
          userId,
          type: CONTACT_TYPES.google,
          googleId,
        });
      }
    }
  }
}


/**
 * Sync the google contacts for the specified user id
 * @private
 *
 * @param   {String}      userId            the specified user id
 * @return  {Promise}                       returns a promise which is resolve after sync completes
 */
function* syncGoogle(userId) {
  const connection = yield r.table(UserSocialConnection.getTableName())
    .getAll([userId, SOCIAL_CONNECTION_TYPES.google], { index: 'userId_type' }).nth(0)
    .default(null)
    .run();

  if (connection) {
    // set google oauth2 client credentials
    // for each individual app user these credentials are different and hence we have to set
    // them for every app user
    // refresh token is mandatory if access token is expired.
    googleOauth2Client.setCredentials({ access_token: connection.accessToken,
      refresh_token: connection.refreshToken });

    // first get all google friends
    const friends = yield getAllGoogleContacts();
    // sync all of these friends, try to find app user for these friends and
    // if app user not found than these will become user contact
    const promises = friends.map(single => helper.executeWrapped(syncGoogleContact, userId, single));

    yield Promise.all(promises);
  }
}

/**
 * Sync a user phonebook email
 * @private
 *
 * @param   {String}      userId            the specified user id
 * @param   {String}      email             the email address to sync
 * @return  {Promise}                       returns a promise which is resolve after sync completes
 */
function* syncPhonebookEmail(userId, email) {
  const existing = yield r.table(User.getTableName())
    .getAll(email, { index: 'email' }).nth(0)
    .default(null)
    .run();

  if (existing) {
    // if there is a existing user save it in friends table if not already saved
    const friend = yield r.table(UserFriend.getTableName())
      .getAll([userId, existing.id], { index: 'userId_friendId' }).nth(0)
      .default(null)
      .run();

    if (!friend) {
      yield UserFriend.save({ userId, friendId: existing.id });
    }
  } else {
    // there is no app user with the specified contact, create a user contact
    const contact = yield r.table(UserContact.getTableName())
      .getAll([userId, CONTACT_TYPES.email, email], { index: 'userId_type_email' }).nth(0)
      .default(null)
      .run();

    if (!contact) {
      yield UserContact.save({
        userId,
        type: CONTACT_TYPES.email,
        email,
      });
    }
  }
}

/**
 * Sync a user phonebook phone number
 * @private
 *
 * @param   {String}      userId            the specified user id
 * @param   {String}      phoneNumber       the phone number to sync. The phone number is complete
 *                                          phone number including country code
 * @return  {Promise}                       returns a promise which is resolve after sync completes
 */
function* syncPhonebookPhoneNumber(userId, phoneNumber) {
  const existing = yield r.table(UserPhoneNumber.getTableName())
    .getAll(phoneNumber, { index: 'number' }).nth(0)
    .default(null)
    .run();

  if (existing) {
    // if there is a existing user save it in friends table if not already saved
    const friend = yield r.table(UserFriend.getTableName())
      .getAll([userId, existing.userId], { index: 'userId_friendId' }).nth(0)
      .default(null)
      .run();

    if (!friend) {
      yield UserFriend.save({ userId, friendId: existing.userId });
    }
  } else {
    // there is no app user with the specified contact, create a user contact
    const contact = yield r.table(UserContact.getTableName())
      .getAll([userId, CONTACT_TYPES.phone, phoneNumber], { index: 'userId_type_phoneNumber' }).nth(0)
      .default(null)
      .run();

    if (!contact) {
      yield UserContact.save({
        userId,
        type: CONTACT_TYPES.phone,
        phoneNumber,
      });
    }
  }
}

/**
 * Sync a user phonebook phone numbers and emails
 * @private
 *
 * @param   {String}      userId            the specified user id
 * @param   {Array}       phonebook         the array of phone numbers
 * @param   {Array}       emails            the array of email addresses
 * @return  {Promise}                       returns a promise which is resolve after sync completes
 */
function* syncPhonebook(userId, phonebook, emails) {
  const epromises = emails.map(single => helper.executeWrapped(syncPhonebookEmail, userId, single));
  yield Promise.all(epromises);
  const ppromises = phonebook.map(single => helper.executeWrapped(syncPhonebookPhoneNumber, userId, single));
  yield Promise.all(ppromises);
}

/**
 * Sync user external contacts with app users data
 * Request payload specify user phonebook data
 * Server will fetch user contacts from facebook/google combine phonebook data with social contacts
 * and resolve references to app users if there is any
 *
 * @param   {Object}      auth              currently logged in user auth identification
 * @param   {String}      id                the id of the user
 * @param   {Object}      entity            the request payload, MediaUploadReq model definition
 * @return  {Object}                        UserContacts swagger model definition
 */
function* syncUserContacts(auth, id, entity) {
  if (auth.userId !== id) {
    throw new errors.NotPermittedError('user can only sync self contacts',
      new Error(ErrorCodes.OPERATION_NOT_PERMITTED));
  }
  yield syncPhonebook(id, entity.phonebook, entity.emails);
  try {
    yield syncFacebook(id);
  } catch (error) {
    logger.error('facebook sync contacts failed', helper.stringify(error));
  }
  try {
    yield syncGoogle(id);
  } catch (error) {
    logger.error('google sync contacts failed', helper.stringify(error));
  }

  // get all contacts
  const rcontacts = yield r.table(UserContact.getTableName())
    .getAll(id, { index: 'userId' }).run();

  const contacts = helper.getRawObject(rcontacts, 'userId');

  // get current user followers
  const rfo = yield r.table(UserFollower.getTableName())
    .getAll([id, 1], { index: 'userId_status' })
    .orderBy(r.desc('createdAt'))
    .eqJoin('followerId', r.table(User.getTableName()))
    .run();

  // user followers plain objects
  const rfop = rfo.map(single => helper.getRawObject(single.right, 'password'));
  // user followers ids
  const rfopids = rfop.map(single => single.id);
  // get user friends which are not user followers
  const rf = yield r.table(UserFriend.getTableName())
    .filter(doc => r.expr(rfopids).contains(doc('friendId')).not().and(doc('userId').eq(id)))
    .orderBy(r.desc('createdAt'))
    .eqJoin('friendId', r.table(User.getTableName()))
    .run();

  const rfp = rf.map(single => helper.getRawObject(single.right, 'password'));

  const users = yield computeFollowStates(auth, rfop.concat(rfp));

  const merged = { users, contacts };
  return helper.decorateWithSignedUrl(merged, ['photo', 'photos']);
}

// the joi validation schema for syncUserContacts
syncUserContacts.schema = {
  auth: joi.object().keys({
    userId: joi.string().required(),
    accessToken: joi.string(),
  }).required(),
  id: joi.string().required(),
  entity: joi.object().keys({
    phonebook: joi.array().items(joi.string().required()).min(1).required(),
    emails: joi.array().items(joi.string().required()).min(1).required(),
  }),
};

/**
 * Add users to current auth user block list
 * The list of user ids are added in current auth user block list
 *
 * @param   {Object}      auth              currently logged in user auth identification
 * @param   {String}      userId            the id of the user
 * @param   {Object}      entity            the request payload
 * @return  {Void}                          this method doesn't return anything
 */
function* addToBlockList(auth, userId, entity) {
  if (auth.userId !== userId) {
    throw new errors.NotPermittedError('user can only add users to block list for self account',
      new Error(ErrorCodes.OPERATION_NOT_PERMITTED));
  }
  const existing = yield r.table(UserBlock.getTableName())
    .getAll([userId, entity.blockedId], { index: 'userId_blockedId' })
    .nth(0)
    .default(null)
    .run();

  if (!existing) {
    yield UserBlock.save({ userId, blockedId: entity.blockedId });
  }
  return yield computeSingleUserFollowState(auth, entity.blockedId);
}

// the joi validation schema for addToBlockList
addToBlockList.schema = {
  auth: joi.object().keys({
    userId: joi.string().required(),
    accessToken: joi.string(),
  }).required(),
  userId: joi.string().required(),
  entity: joi.object().keys({
    blockedId: joi.string().guid({ version: 'uuidv4' }).required(),
  }).required(),
};

/**
 * Remove users from block list
 * The list of user ids are removed from current auth user block list
 *
 * @param   {Object}      auth              currently logged in user auth identification
 * @param   {String}      userId            the id of the user
 * @param   {Object}      entity            the request payload
 * @return  {Void}                          this method doesn't return anything
 */
function* deleteFromBlockList(auth, userId, entity) {
  if (auth.userId !== userId) {
    throw new errors.NotPermittedError('user can only remove user from block list for self account',
      new Error(ErrorCodes.OPERATION_NOT_PERMITTED));
  }
  yield r.table(UserBlock.getTableName())
    .getAll([userId, entity.blockedId], { index: 'userId_blockedId' }).delete().run();

  return yield computeSingleUserFollowState(auth, entity.blockedId);
}

// the joi validation schema for deleteFromBlockList
deleteFromBlockList.schema = {
  auth: joi.object().keys({
    userId: joi.string().required(),
    accessToken: joi.string(),
  }).required(),
  userId: joi.string().required(),
  entity: joi.object().keys({
    blockedId: joi.string().guid({ version: 'uuidv4' }).required(),
  }).required(),
};

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
