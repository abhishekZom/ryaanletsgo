/*
 * Copyright (C) 2017 lets., All Rights Reserved.
 */

'use strict';

/**
 * Logger for workers
 *
 * @author      TSCCODER
 * @version     1.0.0
 */

const winston = require('winston');
const config = require('config');

const transports = [new (winston.transports.File)({
  timestamp: true,
  filename: config.LOG_FILE_NAME,
  maxsize: config.LOG_FILE_MAX_SIZE,
  maxFiles: config.LOG_MAX_FILES,
  tailable: true,
  level: config.LOG_LEVEL,
})];

// console log not added in production
if (process.env.NODE_ENV !== 'production') {
  transports.push(new (winston.transports.Console)({
    timestamp: true,
    stderrLevels: ['error'],
    level: config.LOG_LEVEL,
  }));
}

const logger = new (winston.Logger)({ transports });

module.exports = logger;
