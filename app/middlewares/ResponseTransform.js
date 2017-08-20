/*
 * Copyright (C) 2017 lets., All Rights Reserved.
 */

'use strict';

/**
 * Transform the express response body before sending to client.
 * This middleware remove any null values from the response body
 *
 * @author      TSCCODER
 * @version     1.0.0
 */


const _ = require('lodash');

/**
 * The middleware function
 *
 * @param   {Object}     req       the express request instance
 * @param   {Object}     res       the express response instance
 * @param   {Function}   next      the next middleware in the chain
 * @return  {Void}                 this function doesn't return anything
 */
function middleware(req, res, next) {
  if (_.isObject(res.body)) {
    res.body = _.omitBy(res.body, _.isNil);
  } else if (_.isArray(res.body)) {
    res.body = res.body.map((single) => {
      if (_.isObject(single)) {
        return _.omitBy(single, _.isNil);
      }
      return single;
    });
  }
  next();
}

module.exports = function exportMiddleware() {
  return middleware;
};
