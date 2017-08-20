/**
 * Copyright (c) 2017, let's., All rights reserved.
 */

'use strict';

/**
 * The default workers configuration
 *
 * @author      TCSCODER
 * @version     1.0.0
 */

module.exports = {
  LOG_LEVEL: 'debug',
  LOG_FILE_NAME: '/var/log/lets-workers.log',
  LOG_FILE_MAX_SIZE: 2 * 1024 * 1024,         // 2 MB max file size
  LOG_MAX_FILES: 1000,
  // rethinkdb batch insert size
  BATCH_SIZE: 200,
  // no of days after which the user verification email expires
  USER_VERIFICATION_EMAIL_EXPIRES: 2,
  // reset password expiry in hours
  RESET_PASSWORD_EXPIRES: 24,
  RESET_PASSWORD_LINK: 'http://localhost:4000/users/reset-password?token=:token',
  VERIFY_EMAIL_LINK: 'http://localhost:4000/users/verify-email?token=:token',
  // dbconnection options
  db: {
    db: 'lets',
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
  // nodemailer smtp configuration
  smtp: {
    transport: {
      service: 'mailgun',
      auth: {
        user: process.env.SMTP_USERNAME,
        pass: process.env.SMTP_PASSWORD,
      },
    },
    FROM_EMAIL: {
      name: 'lets admin',
      address: 'lets@example.com',
    },
  },
};
