/*
 * Copyright (C) 2017 lets., All Rights Reserved.
 */

'use strict';

/**
 * This module contains the winston logger configuration.
 *
 * @author      TSCCODER
 * @version     1.0.0
 */

const _ = require('lodash');
const winston = require('winston');
const util = require('util');
const config = require('config');
const getParams = require('get-parameter-names');
const helper = require('./Helper');

const transports = [new (winston.transports.File)({
  timestamp: true,
  filename: config.LOG_FILE_NAME,
  maxsize: config.LOG_FILE_MAX_SIZE,
  maxFiles: config.LOG_MAX_FILES,
  level: config.LOG_LEVEL,
  tailable: true,
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

/**
 * Log error details with signature
 *
 * @param  {Error}    err            the error to log
 * @return {Void}                    this function doesn't return anything
 */
logger.logFullError = function logFullError(err) {
  if (!err) {
    return;
  }
  const args = Array.prototype.slice.call(arguments);           // eslint-disable-line prefer-rest-params
  args.shift();
  logger.error(...args);
  logger.error(util.inspect(err));
  if (!err.logged) {
    logger.error(err.stack);
  }
  err.logged = true;
};

/**
 * Decorate all functions of a service and log debug information if DEBUG is enabled
 *
 * @param   {Object}  service        the service
 * @return  {Void}                   this function doesn't return anything
 */
logger.decorateWithLogging = function decorateWithLogging(service) {
  if (config.LOG_LEVEL !== 'debug') {
    return;
  }
  _.each(service, (method, name) => {
    const params = method.params || getParams(method);
    service[name] = function* decoratedLoggingGeneratorFunction() {
      logger.debug(`ENTER ${name}`);
      logger.debug('input arguments');
      const args = Array.prototype.slice.call(arguments);                 // eslint-disable-line prefer-rest-params
      logger.debug(util.inspect(helper.sanitizeObject(helper.combineObject(params, args)),
        { depth: config.UTIL_INSPECT_DEPTH }));
      try {
        const result = yield* method.apply(this, arguments);              // eslint-disable-line prefer-rest-params
        logger.debug(`EXIT ${name}`);
        logger.debug('output arguments');
        if (result !== null && result !== undefined) {
          logger.debug('output arguments');
          logger.debug(util.inspect(helper.sanitizeObject(result), { depth: config.UTIL_INSPECT_DEPTH }));
        }
        return result;
      } catch (e) {
        logger.logFullError(e, name);
        throw e;
      }
    };
  });
};

module.exports = logger;
