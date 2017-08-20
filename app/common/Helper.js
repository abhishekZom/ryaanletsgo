/*
 * Copyright (C) 2017 lets., All Rights Reserved.
 */

'use strict';

/**
 * This module exposes some generic helper methods
 *
 * @author      TSCCODER
 * @version     1.0.0
 */

const _ = require('lodash');
const co = require('co');
const bcrypt = require('bcryptjs');
const Joi = require('joi');
const config = require('config');
const getParams = require('get-parameter-names');
const jwt = require('jsonwebtoken');
const Errio = require('errio');
const twilio = require('twilio');
const AWS = require('aws-sdk');
const sharp = require('sharp');
const path = require('path');
const uuid = require('uuid');
const fs = require('fs');

Promise.promisifyAll(bcrypt);
Promise.promisifyAll(jwt);

// Use bluebird implementation of Promise
AWS.config.setPromisesDependency(require('bluebird'));

// create a new twilio client
const twilioClient = new twilio.RestClient(config.twilio.TWILIO_ACCOUNT_SID, config.twilio.TWILIO_AUTH_TOKEN);

// construct a new instance of s3 client
const s3 = new AWS.S3({ apiVersion: config.aws.s3.API_VERSION, region: config.aws.s3.REGION });

const PRODUCTION = 'production';

/**
 * Wrap generator function to standard express function
 *
 * @param   {Function}    fn          the generator function
 * @return  {Function}                the wrapped function
 */
function wrapExpress(fn) {
  return function expressWrappedFunction(req, res, next) {
    co(fn(req, res, next)).catch(next);
  };
}

/**
 * Wrap all generators from object
 *
 * @param   {Object}      obj         the object (controller exports)
 * @return  {Object|Array}            the wrapped object
 */
function autoWrapExpress(obj) {
  if (_.isArray(obj)) {
    return obj.map(autoWrapExpress);
  }
  if (_.isFunction(obj)) {
    if (obj.constructor.name === 'GeneratorFunction') {
      return wrapExpress(obj);
    }
    return obj;
  }
  _.each(obj, (value, key) => {
    obj[key] = autoWrapExpress(value);
  });
  return obj;
}

/**
 * Validate that the hash is actually the hashed value of plain text
 *
 * @param   {String}    hash          the hash to validate
 * @param   {String}    text          the text to validate against
 * @return  {Boolean}                 true if plain text equals to hash otherwise false
 */
function* validateHash(hash, text) {
  return yield bcrypt.compareAsync(text, hash);
}

/**
 * Hash the plain text using the specified number of rounds
 *
 * @param   {String}    text          the text to hash
 * @param   {Integer}   rounds        the number of rounds
 * @return  {String}                  the hashed string of plain text string
 */
function* hashString(text, rounds) {
  return yield bcrypt.hashAsync(text, rounds || config.PASSWORD_HASH_STRENGTH);
}

/**
 * Generate jwt token for the specified payload
 *
 * @param  {Object}   payload       the jwt payload
 * @param  {Object}   options       the jwt sign options
 * @return {Object}                 the generated jwt token
 */
function* generateToken(payload, options) {
  return yield jwt.signAsync(payload, config.JWT_SECRET, options);
}

/**
 * Convert array with arguments to object
 *
 * @param  {Object}   params        the params
 * @param  {Array}    arr           the array to combine with params
 * @return {Object}                 the combined object
 */
function combineObject(params, arr) {
  const ret = {};
  _.each(arr, (arg, i) => {
    ret[params[i]] = arg;
  });
  return ret;
}

/**
 * Remove invalid properties from the object and hide long arrays
 *
 * @param   {Object}    obj         the object
 * @return  {Object}                the sanitized object
 */
function sanitizeObject(obj) {
  try {
    return JSON.parse(JSON.stringify(obj, (name, value) => {
      // Array of field names that should not be logged
      // add field if necessary (password, tokens etc)
      const removeFields = config.DEFAULT_SANITIZED_PROPERTIES || [];
      if (_.contains(removeFields, name)) {
        return '<removed>';
      }
      if (_.isArray(value) && value.length > 30 && process.env.NODE_ENV === PRODUCTION) {
        return `Array(${value.length})`;
      }
      return value;
    }));
  } catch (e) {
    return obj;
  }
}

/**
 * Decorate all functions of a service and validate input values
 * and replace input arguments with sanitized result form Joi
 * Service method must have a `schema` property with Joi schema
 *
 * @param  {Object}   service       the service to decorate with validators
 * @return {void}                   function doesn't return anything.
 */
function decorateWithValidators(service) {
  _.each(service, (method, name) => {
    if (!method.schema) {
      return;
    }
    const params = getParams(method);
    service[name] = function* decoratedValidationGeneratorFunction() {
      const args = Array.prototype.slice.call(arguments);               // eslint-disable-line prefer-rest-params
      const value = combineObject(params, args);
      const normalized = Joi.attempt(value, method.schema);

      const newArgs = [];
      // Joi will normalize values
      // for example string number '1' to 1
      // if schema type is number
      _.each(params, (param) => {
        newArgs.push(normalized[param]);
      });
      return yield method.apply(this, newArgs);
    };
    service[name].params = params;
  });
}

/**
 * Get the plain javascript object from the thinky Document
 *
 * @param  {Object/Array}   record        the thinky document or array of documents to convert
 * @param  {Array}          skipKeys      the keys to skip
 * @return {Object}                       the plain javascript object
 */
function getRawObject(record, skipKeys) {
  if (_.isArray(record)) {
    const records = record.map((single) => {
      const srt = { };
      _.each(_.keys(single), (key) => {
        srt[key] = single[key];
      });
      return _.omit(srt, skipKeys);
    });
    return records;
  }
  const transformed = { };
  _.each(_.keys(record), (key) => {
    transformed[key] = record[key];
  });
  return _.omit(transformed, skipKeys);
}

/**
 * Serializes the given object, the object can be plain object or an error
 *
 * @param  {Object}         obj           the object/error to serialize
 * @return {Object}                       the serialized string representation
 */
function stringify(obj) {
  if (_.isError(obj)) {
    return Errio.stringify(obj);
  }
  return JSON.stringify(obj);
}

/**
 * The helper function to send sms to any number using twilio api
 *
 * @param  {Object}         entity        the twilio api request payload
 * @return {Object}                       the twilio api response
 */
function* sendSms(entity) {
  return yield twilioClient.messages.create(entity);
}

/**
 * Get a unique document from model by the specified id
 * NOTE: The default behaviour of think is to throw DocumentNotFound error if no document
 * is found, this method overrides that behaviour and if no document is found will return null
 *
 * @param   {Object}        model         the specified model
 * @param   {String}        id            the specified primary key
 * @param   {Object}        thinky        the instance of thinky
 * @return  {Object}                      model instance if model is found otherwise null
 */
function* fetch(model, id, thinky) {
  try {
    return yield model.get(id);
  } catch (error) {
    if (error instanceof thinky.Errors.DocumentNotFound) {
      return null;
    }
    throw error;
  }
}

/**
 * Parses limit and offset values from the crteria object
 *
 * @param  {Object}         criteria      the criteria object to parse
 * @return {Object}                       the limit and offset values
 */
function parseLimitAndOffset(criteria) {
  const lo = { limit: config.pagination.limit, offset: config.pagination.offset };

  if (_.isObject(criteria) && _.isNumber(criteria.limit)) {
    lo.limit = criteria.limit;
  }
  if (_.isObject(criteria) && _.isNumber(criteria.offset)) {
    lo.offset = criteria.offset;
  }
  return lo;
}

/**
 * Get s3 signed url for the specified operation and payload.
 * AWS sdk s3.getSignedUrl doesn't support promises yet.
 * This method promisify getSignedUrl method.
 *
 * @param   {String}      operation         the id of the user
 * @param   {Object}      payload           the operation payload
 * @return  {Promise}                       promise which is resolved with signed url
 */
function getS3SignedUrl(operation, payload) {
  return new Promise((accept, reject) => {
    s3.getSignedUrl(operation, payload, (err, response) => {
      if (err) {
        reject(err);
      } else {
        accept(response);
      }
    });
  });
}

/**
 * Sync version of getSignedUrl
 * Before using sync version of getSignedUrl aws credentials have to be resolved
 *
 * @param   {String}      operation         the id of the user
 * @param   {Object}      payload           the operation payload
 * @return  {String}                        the signed url
 */
function getS3SignedUrlSync(operation, payload) {
  return s3.getSignedUrl(operation, payload);
}

/**
 * Private helper method to get signed url for single resolution object
 * @private
 *
 * @param   {Object}      resolution        the application resolution object
 * @param   {Number}      expires           the optional number of seconds after the url is expired
 * @return  {Object}                        resolution object with signed url
 */
function* getSignedUrlSingleResolution(resolution, expires) {
  const signedUrl = yield getS3SignedUrl('getObject', {
    Bucket: resolution.bucket,
    Key: resolution.key,
    Expires: expires || config.aws.s3.SIGNED_URL_EXPIRES,
  });
  return _.extend(resolution, { signedUrl });
}

/**
 * Sync version of #getObjectSignedUrl
 *
 * @param   {Object}      photo             the application photo object
 * @param   {Number}      expires           the optional number of seconds after the url is expired
 * @return  {String}                        the signed url
 */
function getS3GetObjectSignedUrlSync(photo, expires) {
  if (!_.isArray(photo.resolutions)) {
    return photo;
  }
  const resolutions = photo.resolutions.map(single => _.extend(single, {
    signedUrl: getS3SignedUrlSync('getObject', {
      Bucket: single.bucket,
      Key: single.key,
      Expires: expires || config.aws.s3.SIGNED_URL_EXPIRES,
    }),
  }));

  return _.extend(photo, { resolutions });
}

/**
 * Get the google profile id from person object. This object must have metadata from combined sources
 *
 * @param   {Object}      person            the google person object
 * @return  {String}                        the profile id or null if id not found
 */
function getGoogleProfileIdFromPerson(person) {
  if (_.has(person, 'metadata.sources')) {
    const profileSource = _.filter(person.metadata.sources, { type: 'PROFILE' });
    if (profileSource && profileSource.length > 0) {
      return profileSource[0].id;
    }
  }
  return null;
}

/**
 * Wrap the generator function, execute the generator and return promise
 *
 * @param   {Function}    fn                the generator function to wrap
 * @param   {Array}       args              the variable arguments to pass to wrapped function
 * @return  {Promise}                       the promise which is resolved from return value of generator function
 */
function executeWrapped(fn, ...args) {
  const wrapped = co.wrap(fn);
  return wrapped(...args);
}

/**
 * Divides the records into chunks of specified size and return insert promises for all of them
 *
 * @param  {Object}         model         the thinky resource to process the batch insert
 * @param  {Array}          records       the array of records to process batch wise with specified size.
 *                                        The number of records can be millions or even billions
 *                                        The only limitation is heap memory.
 * @param  {Number}         size          the size of each batch
 * @return {Promise}                      Promise which is resolved after operation completes
 */
function batchInsert(model, records, size) {
  const chunks = _.chunk(records, size);
  const promises = chunks.map(single => model.save(single));
  return Promise.all(promises);
}

/**
 * Process a single file, resize to single resolutions and upload to s3
 * @private
 *
 * @param  {String}         userId        the current auth user id
 * @param  {Object}         file          the single multer file object
 * @param  {Object}         resolution    the resolution to resize to
 * @return {Object}                       photo object
 */
function* processSingleFileAndResolution(userId, file, resolution) {
  const pathdetails = path.parse(file.path);
  const outputPath = path.join(file.destination, `${pathdetails.name}_${resolution.width}_${resolution.height}${pathdetails.ext}`);
  // first resize and than upload
  let info;
  if (resolution.ignoreAspectRatio === true) {
    info = yield sharp(file.path).resize(resolution.width, resolution.height)
      .ignoreAspectRatio()
      .toFile(outputPath);
  } else {
    info = yield sharp(file.path).resize(resolution.width, resolution.height)
      .max()
      .toFile(outputPath);
  }
  const fstream = fs.createReadStream(outputPath);
  const params = {
    Bucket: config.aws.s3.buckets.USER_UPLOADED_MEDIA,
    Key: `${userId}/${pathdetails.name}_${resolution.width}_${resolution.height}${pathdetails.ext}`,
    Body: fstream,
  };
  // upload to s3
  yield s3.putObject(params).promise();
  return {
    bucket: params.Bucket,
    key: params.Key,
    name: `${resolution.width}_${resolution.height}`,
    filename: file.originalname,
    height: info.height,
    width: info.width,
  };
}

/**
 * Process a single file, resize to multiple resolutions and upload to s3
 * @private
 *
 * @param  {String}         userId        the current auth user id
 * @param  {Object}         file          the single multer file object
 * @param  {Array}          resolutions   the array of resolutions to convert the file to
 * @return {Object}                       photo object
 */
function* processSingleFile(userId, file, resolutions) {
  const promises = resolutions.map(resolution =>
    executeWrapped(processSingleFileAndResolution, userId, file, resolution));

  const response = yield Promise.all(promises);

  const info = yield sharp(file.path).metadata();

  // upload the original file
  const fstream = fs.createReadStream(file.path);
  const params = {
    Bucket: config.aws.s3.buckets.USER_UPLOADED_MEDIA,
    Key: `${userId}/${uuid.v4()}_${file.originalname}`,
    Body: fstream,
  };
  yield s3.putObject(params).promise();

  response.push({
    bucket: params.Bucket,
    key: params.Key,
    name: 'original',
    filename: file.originalname,
    height: info.height,
    width: info.width,
  });
  return { resolutions: response };
}

/**
 * Resize the specified images in the desired resolutions than upload each one of these files to s3.
 *
 * @param  {String}         userId        the current auth user id
 * @param  {Array}          files         the array of multer file objects
 * @param  {Array}          resolutions   the array of resolutions to convert the file to
 * @return {Array}                        array of photos object
 */
function* processAndUploadImagesToS3(userId, files, resolutions) {
  const promises = files.map(file => executeWrapped(processSingleFile, userId, file, resolutions));
  return yield Promise.all(promises);
}

/**
 * Get s3 signed url for the getObject operation.
 * This method first decodes the given url into bucket and key and than generate a signed url
 * from those decoded values
 * AWS sdk s3.getSignedUrl doesn't support promises yet.
 * This method promisify getSignedUrl method.
 *
 * @param   {Object}      photo             the application photo object
 * @param   {Number}      expires           the optional number of seconds after the url is expired
 * @return  {Promise}                       promise which is resolved with signed url
 */
function getS3GetObjectSignedUrl(photo, expires) {
  return co(function* fnWrapped() {
    if (!_.isArray(photo.resolutions)) {
      return photo;
    }
    const promises = photo.resolutions.map(single => executeWrapped(getSignedUrlSingleResolution, single, expires));
    const resolutions = yield Promise.all(promises);

    return _.extend(photo, { resolutions });
  });
}

/**
 * Decorate the specified keys with signed url, The specified keys values should be photo object or array of photo object
 * NOTE: This uses JSON.stringiy approach and will fail if there are circular references.
 * This method does not mofidy the original object
 *
 * @param   {Object}      obj               the object/array to modify
 * @param   {Array}       keys              the key names to modify
 * @return  {Object}                        the modified object/array
 */
function decorateWithSignedUrl(obj, keys) {
  const json = JSON.stringify(obj, (key, value) => {
    if (keys.indexOf(key) !== -1 && _.isArray(value)) {
      return value.map(photo => getS3GetObjectSignedUrlSync(photo));
    } else if (keys.indexOf(key) !== -1 && _.isObjectLike(value)) {
      return getS3GetObjectSignedUrlSync(value);
    }
    return value;
  });

  return JSON.parse(json);
}

/**
 * Decorate the items for the paginated response
 *
 * @param   {Array}       items             the items to return
 * @param   {Object}      lo                the limit/offset object
 * @param   {Number}      total             the total number of records for specified criteria
 * @return  {Object}                        the paginated response
 */
function decorateWithPaginatedResponse(items, lo, total) {
  const response = { data: items, paging: { total } };
  const current = lo.limit + lo.offset;
  if (current < total) {
    response.paging.next = current;
  }
  return response;
}

module.exports = {
  wrapExpress,
  autoWrapExpress,
  validateHash,
  hashString,
  combineObject,
  sanitizeObject,
  decorateWithValidators,
  generateToken,
  getRawObject,
  stringify,
  sendSms,
  fetch,
  parseLimitAndOffset,
  getS3SignedUrl,
  getS3SignedUrlSync,
  getS3GetObjectSignedUrl,
  getS3GetObjectSignedUrlSync,
  getGoogleProfileIdFromPerson,
  executeWrapped,
  batchInsert,
  processAndUploadImagesToS3,
  decorateWithSignedUrl,
  decorateWithPaginatedResponse,
};
