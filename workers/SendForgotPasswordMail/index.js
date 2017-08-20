/*
 * Copyright (C) 2017 lets., All Rights Reserved.
 */

'use strict';

/**
 * The send forgot password mail worker
 *
 * @author      TSCCODER
 * @version     1.0.0
 */
require('../bootstrap.js');
const amqplib = require('amqplib');
const co = require('co');
const config = require('config');
const executor = require('./Executor');
const helper = require('../common/Helper');
const logger = require('../common/Logger');

const CHANNEL_STATE = helper.CHANNEL_STATE;
const CONNECTION_STATE = helper.CONNECTION_STATE;

const states = { };

co(function* initWrapped() {
  const connection = yield amqplib.connect(config.rabbitmq.url);
  /**
   * Emitted if the connection closes for a reason other than #close being called or
   * a graceful server-initiated close.
   * A graceful close may be initiated by an operator (e.g., with an admin tool),
   * or if the server is shutting down; in this case, no 'error' event will be emitted.
   * 'close' will also be emitted, after 'error'.
   */
  connection.on('error', (err) => {
    logger.error('amqp connection error', helper.stringify(err));
    states.connection = CONNECTION_STATE.ERRORED;
  });
  /**
   * Emitted once the closing handshake initiated by #close() has completed; or,
   * if server closed the connection, once the client has sent the closing handshake; or,
   * if the underlying stream (e.g., socket) has closed.
   * In the case of a server-initiated shutdown or an error, the 'close' handler will be
   * supplied with an error indicating the cause.
   */
  connection.on('close', (err) => {
    logger.info('amqp connection closed', helper.stringify(err));
    states.connection = CONNECTION_STATE.CLOSED;
  });
  /**
   * Emitted when a RabbitMQ server (after version 3.2.0) decides to block the connection.
   * Typically it will do this if there is some resource shortage, e.g., memory,
   * and messages are published on the connection.
   */
  connection.on('blocked', (reason) => {
    logger.warn('amqp connection blocked, [serialized]', helper.stringify(reason));
    states.connection = CONNECTION_STATE.BLOCKED;
  });

  /**
   * Emitted at some time after 'blocked', once the resource shortage has alleviated.
   */
  connection.on('unblocked', () => {
    logger.info('amqp connection unblocked');
    states.connection = CONNECTION_STATE.ACTIVE;
  });
  // create a channel, a channel is a lightweight connection
  const channel = yield connection.createConfirmChannel();
  /**
   * A channel will emit 'close' once the closing handshake (possibly initiated by #close())
   * has completed; or, if its connection closes.
   * When a channel closes, any unresolved operations on the channel will be abandoned
   * (and the returned promises rejected).
   */
  channel.on('close', () => {
    logger.info('amqp channel closed');
    states.channel = CHANNEL_STATE.CLOSED;
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
  channel.on('error', (err) => {
    logger.error('amqp channel error', helper.stringify(err));
    states.channel = CHANNEL_STATE.ERRORED;
  });
  // assert the exchange
  const ok = yield channel.assertExchange(config.DEFAULT_EXCHANGE, 'direct');
  logger.debug('Assert Exchange response', helper.stringify(ok));
  // assert the queue
  const qok = yield channel.assertQueue(config.ROUTING_KEYS.SEND_FORGOT_PASSWORD_MAIL.queueName);
  logger.debug('Assert Queue response', helper.stringify(qok));
  // bind the queue to exchange
  yield channel.bindQueue(config.ROUTING_KEYS.SEND_FORGOT_PASSWORD_MAIL.queueName,
    config.DEFAULT_EXCHANGE, config.ROUTING_KEYS.SEND_FORGOT_PASSWORD_MAIL.key);
  return channel;
}).then((channel) => {
  states.connection = CONNECTION_STATE.ACTIVE;
  states.channel = CHANNEL_STATE.ACTIVE;
  // wait for any messages on the queue
  channel.consume(config.ROUTING_KEYS.SEND_FORGOT_PASSWORD_MAIL.queueName, (msg) => {
    logger.debug(`received message with deliveryTag ${msg.fields.deliveryTag}, consumerTag ${msg.fields.consumerTag}`);
    const decoded = helper.decodeMessageContent(msg);
    executor.consume(decoded, msg, channel);
  });
}).catch((err) => {
  logger.error('Unexpected amqp error', helper.stringify(err));
});
