/**
 * Copyright (c) 2017 lets., All rights reserved.
 */

'use strict';

/**
 * Application authentication middleware
 *
 * @author      TCSCODER
 * @version     1.0
 */

const config = require('config');
const _ = require('lodash');
const errors = require('common-errors');
const jwt = require('jsonwebtoken');

Promise.promisifyAll(jwt);

/**
 * Validate the jwt token
 *
 * @param   {Object}    req           the express request instance
 * @param   {Object}    res           the express response instance
 * @param   {Function}  next          the next middleware function in chain
 * @return  {Void}                    the function doesn't return anything
 */
function* jwtCheck(req, res, next) {
  const authorizationHeader = req.get('Authorization');
  if (!authorizationHeader) {
    throw new errors.AuthenticationRequiredError('No Authorization header');
  }
  const splitted = authorizationHeader.split(' ');
  if (splitted.length !== 2 || splitted[0] !== 'Bearer') {
    throw new errors.AuthenticationRequiredError('Invalid Authorization header specified');
  }
  const filtered = _.omit(yield jwt.verifyAsync(splitted[1], config.JWT_SECRET), 'iat', 'exp');
  req.auth = _.extend(filtered, { accessToken: splitted[1] });
  next();
}

/**
 * Export a function
 * @return {Function}       return the middleware function
 */
module.exports = () => jwtCheck;
