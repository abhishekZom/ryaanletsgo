/*
 * Copyright (C) 2017 lets., All Rights Reserved.
 */

'use strict';

/**
 * RabbitMQ message queue service.
 * Publish messages to the queue
 * This service is used on the publisher side of the application to publish message to default exchange
 * with different routing keys
 *
 * @author      TSCCODER
 * @version     1.0.0
 */

const _ = require('lodash');
const amqplib = require('amqplib');
const helper = require('../common/Helper');
const config = require('config');
const mime = require('mime-types');
const co = require('co');

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

const DEFAULT_PUBLISH_OPTIONS = {
  persistent: true,
  mandatory: true,
  contentType: mime.types.json,
};

/**
 * Default constructor for service
 *
 * @param   {Object}        options               the constructor options
 * @param   {String}        options.url           the amqp connection URI (mandatory)
 * @param   {Object}        options.logger        the logger instance (mandatory)
 * @return  {Void}                                this doesnot return anything
 */
function RabbitMQService(options) {
  if (!_.has(options, 'url')) {
    throw new Error('options.url is mandatory');
  } else if (!_.has(options, 'logger')) {
    throw new Error('options.logger is mandatory');
  }
  this.states = { };
  this.options = options;
  // after everything is validated init
  this.init();
}

RabbitMQService.prototype.init = function init() {
  const _self = this;                           // eslint-disable-line no-underscore-dangle
  const logger = _self.options.logger;
  co(function* initWrapped() {
    _self.connection = yield amqplib.connect(_self.options.url);
    /**
     * Emitted if the connection closes for a reason other than #close being called or
     * a graceful server-initiated close.
     * A graceful close may be initiated by an operator (e.g., with an admin tool),
     * or if the server is shutting down; in this case, no 'error' event will be emitted.
     * 'close' will also be emitted, after 'error'.
     */
    _self.connection.on('error', (err) => {
      logger.error('amqp connection error', helper.stringify(err));
      _self.states.connection = CONNECTION_STATE.ERRORED;
    });
    /**
     * Emitted once the closing handshake initiated by #close() has completed; or,
     * if server closed the connection, once the client has sent the closing handshake; or,
     * if the underlying stream (e.g., socket) has closed.
     * In the case of a server-initiated shutdown or an error, the 'close' handler will be
     * supplied with an error indicating the cause.
     */
    _self.connection.on('close', (err) => {
      logger.info('amqp connection closed', helper.stringify(err));
      _self.states.connection = CONNECTION_STATE.CLOSED;
    });
    /**
     * Emitted when a RabbitMQ server (after version 3.2.0) decides to block the connection.
     * Typically it will do this if there is some resource shortage, e.g., memory,
     * and messages are published on the connection.
     */
    _self.connection.on('blocked', (reason) => {
      logger.warn('amqp connection blocked, [serialized]', helper.stringify(reason));
      _self.states.connection = CONNECTION_STATE.BLOCKED;
    });

    /**
     * Emitted at some time after 'blocked', once the resource shortage has alleviated.
     */
    _self.connection.on('unblocked', () => {
      logger.info('amqp connection unblocked');
      _self.states.connection = CONNECTION_STATE.ACTIVE;
    });
    // create a channel, a channel is a lightweight connection
    _self.channel = yield _self.connection.createConfirmChannel();
    /**
     * A channel will emit 'close' once the closing handshake (possibly initiated by #close())
     * has completed; or, if its connection closes.
     * When a channel closes, any unresolved operations on the channel will be abandoned
     * (and the returned promises rejected).
     */
    _self.channel.on('close', () => {
      logger.info('amqp channel closed');
      _self.states.channel = CHANNEL_STATE.CLOSED;
    });

    /**
     * A channel will emit 'error' if the server closes the channel for any reason.
     * Such reasons include
     * 1. an operation failed due to a failed precondition
     *    (usually something named in an argument not existing)
     * 2. an human closed the channel with an admin tool
     *
     * A channel will not emit 'error' if its connection closes with an error.
     */
    _self.channel.on('error', (err) => {
      logger.error('amqp channel error', helper.stringify(err));
      _self.states.channel = CHANNEL_STATE.ERRORED;
    });
    // assert the exchange
    const ok = yield _self.channel.assertExchange(config.DEFAULT_EXCHANGE, 'direct');
    logger.debug('Assert Exchange response', helper.stringify(ok));
  }).then(() => {
    _self.states.connection = CONNECTION_STATE.ACTIVE;
    _self.states.channel = CHANNEL_STATE.ACTIVE;
  }).catch((err) => {
    logger.error('Unexpected amqp error', helper.stringify(err));
  });
};

/**
 * Publish a message on the queue
 *
 * @param  {String}         routingKey  the routing key of the message
 * @param  {Object}         content     the content object to be published, this will be serialized to json
 * @param  {Object}         options     the additional options to be merged with default options before publishing
 * @return {Object}                     return the response from rabbit publish method as object
 */
RabbitMQService.prototype.publish = function publish(routingKey, content, options) {
  if (_.isUndefined(content)) {
    throw new Error('content is mandatory');
  } else if (!_.isString(routingKey)) {
    throw new Error('routingKey should be string');
  }
  // if both channel/connection is active
  if (this.states.channel === CHANNEL_STATE.ACTIVE && this.states.connection === CONNECTION_STATE.ACTIVE) {
    // merge the options
    const opts = _.extend(DEFAULT_PUBLISH_OPTIONS, options);
    this.options.logger.info('publishing message to default exchange, options', helper.stringify(opts));
    const buffered = Buffer.from(helper.stringify(content));
    const response = this.channel.publish(config.DEFAULT_EXCHANGE, routingKey, buffered, opts);
    this.options.logger.info('message published to default exchange, response', helper.stringify(response));
    return {
      response,
    };
  }
  return {
    response: false,
  };
};

module.exports = RabbitMQService;
