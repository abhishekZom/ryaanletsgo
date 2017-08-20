/*
 * Copyright (C) 2017 lets., All Rights Reserved.
 */

'use strict';

/**
 * The executor for the user signup message
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

const models = require('../models').getDatasource({               // eslint-disable-line import/no-unresolved
  db: _.extend(config.db, { max: 5 }),
  logger,
});
const moment = require('moment');

const UserEmailVerification = models.UserEmailVerification;

const templateDir = path.join(process.cwd(), 'templates', 'verify-email');

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
    logger.warn('user is not defined, skip signup processing');
    channel.ack(msg);
  } else {
    co(function* consumeWrapped() {
      try {
        // create user email verification record
        const userEmailVerificationRecord = yield UserEmailVerification.save({
          userId: content.user.id,
          email: content.user.email,
          token: uuid.v4(),
          expires: moment().add(config.USER_VERIFICATION_EMAIL_EXPIRES, 'days').valueOf(),
        });

        const link = config.VERIFY_EMAIL_LINK.replace(':token', userEmailVerificationRecord.token);
        const payload = { user: content.user, link, days: config.USER_VERIFICATION_EMAIL_EXPIRES };
        const userSignup = new EmailTemplate(templateDir);
        // render the template
        const rendered = yield userSignup.render(payload);
        const response = yield transporter.sendMail({
          from: config.smtp.FROM_EMAIL,
          to: content.user.email,
          subject: 'Welcome to lets',
          html: rendered.html,
        });
        logger.debug('User signup welcome mail sent successfully', helper.stringify(response));
      } catch (ignore) {
        logger.error('send mail error', helper.stringify(ignore));
      }
    }).then(() => {
      logger.info('user signup successfully processed', helper.stringify(content));
      channel.ack(msg);
    }).catch((err) => {
      logger.error(`Error consuming message, deliveryTag ${msg.fields.deliveryTag}`, helper.stringify(err));
      channel.nack(msg, false, true);
    });
  }
}

module.exports = {
  consume,
};
