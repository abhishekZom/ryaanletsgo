/*
 * Copyright (C) 2017 lets., All Rights Reserved.
 */

'use strict';

/**
 * This module exposes some generic helper methods for workers
 *
 * @author      TSCCODER
 * @version     1.0.0
 */
const _ = require('lodash');
const Errio = require('errio');
const StringDecoder = require('string_decoder').StringDecoder;
const mime = require('mime-types');

const decoder = new StringDecoder('utf8');

// various states of connection and channel
const CHANNEL_STATE = {
  CLOSED: 'CLOSED',
  ERRORED: 'ERRORED',
  ACTIVE: 'ACTIVE',
};

const CONNECTION_STATE = {
  CLOSED: 'CLOSED',
  ERRORED: 'ERRORED',
  BLOCKED: 'BLOCKED',
  ACTIVE: 'ACTIVE',
};

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
 * Decode the message content. The msg is received on the rabbitmq queue
 *
 * @param  {Object}         msg           the message received on the queue
 * @return {Object}                       the decoded message content
 */
function decodeMessageContent(msg) {
  let stringMessage = decoder.end(msg.content);
  if (msg.properties.contentType === mime.types.json) {
    stringMessage = JSON.parse(stringMessage);
  }
  return stringMessage;
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

module.exports = {
  stringify,
  decodeMessageContent,
  batchInsert,
  CONNECTION_STATE,
  CHANNEL_STATE,
};
