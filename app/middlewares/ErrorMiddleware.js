/*
 * Copyright (C) 2017 lets., All Rights Reserved.
 */

'use strict';

/**
 * Common error handling middleware
 *
 * @author      TSCCODER
 * @version     1.0.0
 */

const config = require('config');
const _ = require('lodash');
const errors = require('common-errors');
const httpStatus = require('http-status');
const logger = require('../common/Logger');
const ErrorCodes = require('../ErrorCodes');

const DEFAULT_MESSAGE = 'Internal server error';

/**
 * The error middleware function
 *
 * @param   {Object}     err       the error that is thrown in the application
 * @param   {Object}     req       the express request instance
 * @param   {Object}     res       the express response instance
 * @param   {Function}   next      the next middleware in the chain
 * @return  {Void}                 this function doesn't return anything
 */
function middleware(err, req, res, next) {                        // eslint-disable-line no-unused-vars
  logger.logFullError(err, req.method, req.url);
  let wrappedError;
  if (err.isJoi) {
    wrappedError = {
      requestId: req[config.REQUEST_ID_ATTRIBUTE],
      message: err.details,
      code: ErrorCodes.GENERIC_VALIDATION_ERROR,
      status: httpStatus.BAD_REQUEST,
    };
  } else {
    const httpError = new errors.HttpStatusError(err);
    wrappedError = {
      requestId: req[config.REQUEST_ID_ATTRIBUTE],
      message: err.message || httpError.message || DEFAULT_MESSAGE,
      code: ErrorCodes.UNKNOWN,
      status: _.isNumber(httpError.statusCode) ? httpError.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
    };

    if (_.isError(err.inner_error)) {
      wrappedError.code = err.inner_error.message;
    }
  }

  res.status(wrappedError.status).json(wrappedError);
}

module.exports = function exportMiddleware() {
  return middleware;
};
