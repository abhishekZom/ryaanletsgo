/**
 * Copyright (c) 2017, let's., All rights reserved.
 */

'use strict';

/**
 * The test app configuration
 *
 * @author      TCSCODER
 * @version     1.0.0
 */

module.exports = {
  LOG_LEVEL: 'warn',
  LOG_FILE_NAME: '/var/log/lets-api-test.log',
  LOG_FILE_MAX_SIZE: 2 * 1024 * 1024,         // 2 MB max file size
  LOG_MAX_FILES: 1000,
  ENABLE_FORCE_SIGNUP: 1,
  db: {
    db: 'lets_test',
    silent: true,
    servers: [
      { host: 'localhost', port: 28015 },
    ],
  },
  // test tokens for integration tests
  tokens: {
    FACEBOOK_ACCESS_TOKEN: process.env.FACEBOOK_ACCESS_TOKEN,
    GOOGLE_ACCESS_TOKEN: process.env.GOOGLE_ACCESS_TOKEN,
  },
};
