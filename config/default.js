/**
 * Copyright (c) 2017, let's., All rights reserved.
 */

'use strict';

/**
 * The default app configuration
 *
 * @author      TCSCODER
 * @version     1.0.0
 */

module.exports = {
  LOG_LEVEL: 'debug',
  LOG_FILE_NAME: '/var/log/lets-api.log',
  LOG_FILE_MAX_SIZE: 2 * 1024 * 1024,         // 2 MB max file size
  UTIL_INSPECT_DEPTH: 10,
  ENABLE_FORCE_SIGNUP: process.env.ENABLE_FORCE_SIGNUP || 0,
  LOG_MAX_FILES: 1000,
  PORT: process.env.PORT || 4000,
  DEFAULT_SANITIZED_PROPERTIES: ['password', 'tokens'],
  PASSWORD_HASH_STRENGTH: 10,
  API_VERSION: 'v1',
  REQUEST_ID_ATTRIBUTE: 'id',
  JWT_SECRET: process.env.JWT_SECRET || 'averylongsecret',
  // the seconds after which jwt is expired, currently it is 60 days
  JWT_EXPIRES_IN: 60 * 24 * 60 * 60,
  // the seconds after which temporary jwt tokens expire
  TEMP_JWT_EXPIRES_IN: 1 * 60 * 60,
  // rethinkdb batch insert size
  BATCH_SIZE: 200,
  pagination: {
    limit: 20,
    offset: 0,
  },
  // dbconnection options
  db: {
    db: 'lets',
    silent: true,
    servers: [
      { host: 'localhost', port: 28015 },
    ],
  },
  rabbitmq: {
    url: 'amqp://localhost:5672/?heartbeat=30',
  },
  // the default exchange, this is a direct exchagne
  DEFAULT_EXCHANGE: 'lets',
  ROUTING_KEYS: {
    USER_SIGNUP: {
      // the routing/binding key
      key: 'user-signup',
      queueName: 'user-signup-queue',
      // the worker module
      module: 'UserSignup',
    },
    SEND_FORGOT_PASSWORD_MAIL: {
      // the routing/binding key
      key: 'send-forgot-password-mail',
      queueName: 'send-forgot-password-mail-queue',
      // the worker module
      module: 'SendForgotPasswordMail',
    },
    ACTIVITY_CREATED: {
      // the routing/binding key
      key: 'activity-created',
      queueName: 'activity-created-queue',
      // the worker module
      module: 'ActivityCreated',
    },
    ACTIVITY_UPDATED: {
      // the routing/binding key
      key: 'activity-updated',
      queueName: 'activity-updated-queue',
      // the worker module
      module: 'ActivityUpdated',
    },
    ACTIVITY_DELETED: {
      // the routing/binding key
      key: 'activity-deleted',
      queueName: 'activity-deleted-queue',
      // the worker module
      module: 'ActivityDeleted',
    },
  },
  SOCIAL_CONNECTIONS: {
    GOOGLE_PROFILE_ENDPOINT: 'https://www.googleapis.com/plus/v1/people',
    FACEBOOK_PROFILE_ENDPOINT: 'https://graph.facebook.com/v2.9',
    GOOGLE_PEOPLE_API_RESOURCE_NAME: 'people/me',
  },
  // twilio api settings
  twilio: {
    TWILIO_FROM_NUMBER: process.env.TWILIO_FROM_NUMBER,
    TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID,
    TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN,
    MESSAGE_BODY: 'Your Lets verification code is: :code',
  },
  aws: {
    s3: {
      REGION: 'us-east-1',
      API_VERSION: '2006-03-01',
      SIGNED_URL_EXPIRES: 259200,       // 72 hours
      buckets: {
        // the bucket for user's media files
        USER_UPLOADED_MEDIA: 'lets-user-media',
      },
    },
  },
  user: {
    SKIP_VERIFICATION_PREFIX: 'u',
    SKIP_VERIFICATION_CODE: '1234',
  },
  aggregation: {
    ACTIVITY_LATEST_LIKES: 10,
    ACTIVITY_LATEST_RSVP: 20,
    ACTIVITY_LATEST_PHOTOS: 10,
    ACTIVITY_LATEST_COMMENTS: 5,
  },
  UPCOMING_FEEDS_PAST_N_DAYS: 7,
  oauth2: {
    google: {
      CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
      CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
      REDIRECT_URI: process.env.GOOGLE_REDIRECT_URI,
    },
  },
  resize: {
    ACTIVITIES: [{
      height: 250,
      width: 250,
      ignoreAspectRatio: true,
    }, {
      height: 60,
      width: 60,
      ignoreAspectRatio: true,
    }, {
      height: 100,
      width: 100,
      ignoreAspectRatio: false,
    }],
    PROFILE: [{
      height: 160,
      width: 160,
      ignoreAspectRatio: true,
    }, {
      height: 80,
      width: 80,
      ignoreAspectRatio: true,
    }],
  },
  SORT_DIRECTION: {
    DESC: 'desc',
    ASC: 'asc',
  },
};
