/*
 * Copyright (C) 2017 lets., All Rights Reserved.
 */

'use strict';

/**
 * The executor for the send forgot password mail message
 * Must export consume method
 * Some of the modules this module depends on will be resolved at deployment time.
 *
 * @author      TSCCODER
 * @version     1.0.0
 */

const nodemailer = require('nodemailer');
const config = require('config');
const EmailTemplate = require('email-templates').EmailTemplate;
const path = require('path');
const uuid = require('uuid');
const co = require('co');
const _ = require('lodash');
const logger = require('../common/Logger');
const helper = require('../common/Helper');

const models = require('../models').getDatasource({           // eslint-disable-line import/no-unresolved
  db: _.extend(config.db, { max: 5 }),
  logger,
});
const moment = require('moment');

const UserResetPassword = models.UserResetPassword;

const templateDir = path.join(process.cwd(), 'templates', 'forgot-password');

const transporter = nodemailer.createTransport(config.smtp.transport);

/**
 * Consume the message
 *
 * @param  {Object}       content           the parsed message content
 * @param  {Object}       msg               the message that is received on the queue
 * @param  {Object}       channel           the connection channel
 * @return {Void}                           this function returns anything.
 */
function consume(content, msg, channel) {
  if (!_.has(content, 'user')) {
    logger.warn('user is not defined, skip forgot password processing');
    channel.ack(msg);
  } else {
    co(function* consumeWrapped() {
      // generate a unique token for reset password
      const userResetPasswordRecord = yield UserResetPassword.save({
        userId: content.user.id,
        email: content.user.email,
        token: uuid.v4(),
        expires: moment().add(config.RESET_PASSWORD_EXPIRES, 'hours').valueOf(),
        // the hashed password for history
        password: content.user.password,
      });
      const link = config.RESET_PASSWORD_LINK.replace(':token', userResetPasswordRecord.token);
      const payload = { user: content.user, link, hours: config.RESET_PASSWORD_EXPIRES };
      const forgotPassword = new EmailTemplate(templateDir);

      // render the template
      const rendered = yield forgotPassword.render(payload);
      const response = yield transporter.sendMail({
        from: config.smtp.FROM_EMAIL,
        to: content.user.email,
        subject: 'Reset your password',
        html: rendered.html,
      });
      logger.debug('Forgot passowrd mail send response', helper.stringify(response));
    }).then(() => {
      logger.info('forgot password mail successfully sent', helper.stringify(content));
      channel.ack(msg);
    }).catch((err) => {
      logger.error(`Error consuming message, deliveryTag ${msg.fields.deliveryTag}`, helper.stringify(err));
      channel.nack(msg, false, !msg.fields.redelivered);
    });
  }
}

module.exports = {
  consume,
};
