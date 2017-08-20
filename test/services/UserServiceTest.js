/*
 * Copyright (C) 2017 lets., All Rights Reserved.
 */

'use strict';

/**
 * Unit tests for UserService.js
 * Since this is unit test the RabbitMQService will be mocked
 *
 * @author      TSCCODER
 * @version     1.0.0
 */

const proxyquire = require('proxyquire');
const co = require('co');
const nock = require('nock');
const expect = require('chai').expect;
const httpStatus = require('http-status');
const uuid = require('uuid');
const _ = require('lodash');

// the mock rabbitmq service
const service = require('../mocks/RabbitMQService');
const datasource = require('../datasource');
const data = require('../data/test_data.json');
const helper = require('../helper');
const constants = require('../constants');

const mocks = {
  './RabbitMQService': service.proxy,
};

const TABLE_NAMES = constants.TABLE_NAMES;

const userService = proxyquire('../../app/services/UserService', mocks);

// the table names for which to init the data
const initTableNames = [TABLE_NAMES.User, TABLE_NAMES.UserPhoneNumber, TABLE_NAMES.UserResetPassword,
  TABLE_NAMES.UserFollower, TABLE_NAMES.UserEmailVerification, TABLE_NAMES.UserNotificationPreference,
  TABLE_NAMES.UserSetting, TABLE_NAMES.UserLinkedCalendar, TABLE_NAMES.UserSocialConnection];

before(function () {
  this.timeout(0);
  // root suite level hook
  // wait for some time to let the service to initialize
  // The service should initialize the database and required tables
  return co(function* () {
    // first delay for some time
    yield datasource.waitForDBReady();
    yield datasource.clearDb();
  });
});

after(function () {
  return datasource.clearDb();
});

describe('unit', function () {

  describe('UserService', function () {

    beforeEach('insert some test data', function () {
      nock.disableNetConnect();
      // mock twilio external api call
      this.twilioApi = nock('https://api.twilio.com')
        .post(/\/2010-04-01\/Accounts\/(.*)\/Messages\.json/)
        .reply(200);

      return datasource.initDb(initTableNames);
    });

    afterEach('clean test data', function () {
      // restore the interceptor
      nock.cleanAll();
      nock.enableNetConnect();
      // reset publish history so that we can assert callCount for each test individually
      service.getInstance().publish.resetHistory();
      return datasource.clearDb();
    });

    it('RabbitMQService should have been instantiated', function (done) {
      expect(service.proxy.callCount).to.equal(3);
      done();
    });

    it('[login] should login with username', function (done) {
      co(function* () {
        return yield userService.login({
          username: data.users[0].username,
          password: '123456',
          deviceId: data.phoneNumbers[0].deviceId,
        });
      }).then((response) => {
        expect(response.status).to.exist();
        helper.validateModel('#/definitions/LoginRes', response.model, done);
      }).catch(done);
    });

    it('[login] should login with email', function (done) {
      co(function* () {
        return yield userService.login({
          username: data.users[0].email,
          password: '123456',
          deviceId: data.phoneNumbers[0].deviceId,
        });
      }).then((response) => {
        expect(response.status).to.exist();
        helper.validateModel('#/definitions/LoginRes', response.model, done);
      }).catch(done);
    });

    it('[login] should login with phone number', function (done) {
      co(function* () {
        return yield userService.login({
          username: data.phoneNumbers[0].phoneNumber,
          password: '123456',
          deviceId: data.phoneNumbers[0].deviceId,
        });
      }).then((response) => {
        expect(response.status).to.exist();
        helper.validateModel('#/definitions/LoginRes', response.model, done);
      }).catch(done);
    });

    it('[login] should throw user not found error for undefined username', function (done) {
      co(function* () {
        return yield userService.login({
          password: '123456',
          deviceId: 'somenewdeviceId',
        });
      }).then(() => {
        done(new Error('should not have been called'));
      }).catch((err) => {
        helper.assertError(err, 'user not found', done);
      });
    });

    it('[login] using phone number, should respond with verification id if login from new device', function (done) {
      co(function* () {
        return yield userService.login({
          username: data.phoneNumbers[0].phoneNumber,
          password: '123456',
          deviceId: 'somenewdeviceId',
        });
      }).then((response) => {
        this.twilioApi.done();
        expect(response.model.verification).to.exist();
        expect(response.model.verification.id).to.exist();
        helper.validateModel('#/definitions/LoginWithVerificationRes', response.model, done);
      }).catch(done);
    });

    it('[login] using username, should respond with verification id if login from new device', function (done) {
      co(function* () {
        return yield userService.login({
          username: data.users[0].username,
          password: '123456',
          deviceId: 'somenewdeviceId',
        });
      }).then((response) => {
        this.twilioApi.done();
        expect(response.model.verification).to.exist();
        expect(response.model.verification.id).to.exist();
        helper.validateModel('#/definitions/LoginWithVerificationRes', response.model, done);
      }).catch(done);
    });

    it('[login] using email, should respond with verification id if login from new device', function (done) {
      co(function* () {
        return yield userService.login({
          username: data.users[0].email,
          password: '123456',
          deviceId: 'somenewdeviceId',
        });
      }).then((response) => {
        this.twilioApi.done();
        expect(response.model.verification).to.exist();
        expect(response.model.verification.id).to.exist();
        helper.validateModel('#/definitions/LoginWithVerificationRes', response.model, done);
      }).catch(done);
    });

    it('[login] should throw error if user does not exist for specified username', function (done) {
      co(function* () {
        return yield userService.login({
          username: 'invalid',
          password: '123456',
          deviceId: data.phoneNumbers[0].deviceId,
        });
      }).then(() => {
        done(new Error('should not have been called'));
      }).catch((err) => {
        helper.assertError(err, 'user not found', done);
      });
    });

    it('[login] should throw error if user does not exist for specified phone number', function (done) {
      co(function* () {
        return yield userService.login({
          username: '4445477556',
          password: '123456',
          deviceId: data.phoneNumbers[0].deviceId,
        });
      }).then(() => {
        done(new Error('should not have been called'));
      }).catch((err) => {
        helper.assertError(err, 'user not found', done);
      });
    });

    it('[login] should throw error if invalid password', function (done) {
      co(function* () {
        return yield userService.login({
          username: data.users[0].username,
          password: 'invalid',
          deviceId: data.phoneNumbers[0].deviceId,
        });
      }).then(() => {
        done(new Error('should not have been called'));
      }).catch((err) => {
        helper.assertError(err, 'username or password does not match', done);
      });
    });

    it('[login] should throw multiple datasource records error for multiple username', function (done) {
      co(function* () {
        yield datasource.bulkCreate(TABLE_NAMES.User, data.extraUsers);
        return yield userService.login({
          username: data.extraUsers[0].username,
          password: 'invalid',
          deviceId: data.phoneNumbers[0].deviceId,
        });
      }).then(() => {
        done(new Error('should not have been called'));
      }).catch((err) => {
        helper.assertError(err, 'user not uniquely identified', done);
      });
    });

    it('[login] should throw multiple datasource records error for multiple emails', function (done) {
      co(function* () {
        yield datasource.bulkCreate(TABLE_NAMES.User, data.extraUsers);
        return yield userService.login({
          username: data.extraUsers[0].email,
          password: 'invalid',
          deviceId: data.phoneNumbers[0].deviceId,
        });
      }).then(() => {
        done(new Error('should not have been called'));
      }).catch((err) => {
        helper.assertError(err, 'user not uniquely identified', done);
      });
    });

    it('[login] should throw multiple datasource records error for multiple phone number', function (done) {
      co(function* () {
        yield datasource.bulkCreate(TABLE_NAMES.UserPhoneNumber, data.extraPhoneNumbers);
        return yield userService.login({
          username: data.extraPhoneNumbers[0].phoneNumber,
          password: 'invalid',
          deviceId: data.phoneNumbers[0].deviceId,
        });
      }).then(() => {
        done(new Error('should not have been called'));
      }).catch((err) => {
        helper.assertError(err, 'user not uniquely identified', done);
      });
    });

    it('[login] should return 203 if user has no verified phone numbers', function (done) {
      co(function* () {
        return yield userService.login({
          username: data.users[2].username,
          password: '123456',
          deviceId: data.phoneNumbers[0].deviceId,
        });
      }).then((response) => {
        expect(response.status).to.equal(httpStatus.NON_AUTHORITATIVE_INFORMATION);
        helper.validateModel('#/definitions/LoginRes', response.model, done);
      }).catch(done);
    });

    it('[login] should return 203 if user phone number is not verified', function (done) {
      co(function* () {
        return yield userService.login({
          username: data.users[2].username,
          password: '123456',
          deviceId: data.phoneNumbers[0].deviceId,
        });
      }).then((response) => {
        expect(response.status).to.equal(httpStatus.NON_AUTHORITATIVE_INFORMATION);
        expect(response.model).to.exist();
        helper.validateModel('#/definitions/LoginRes', response.model, done);
      }).catch(done);
    });

    it('[login] should return 203 with verification id if user phone number is not verified', function (done) {
      co(function* () {
        return yield userService.login({
          username: data.users[1].username,
          password: '123456',
          deviceId: data.phoneNumbers[1].deviceId,
        });
      }).then((response) => {
        expect(response.status).to.equal(httpStatus.NON_AUTHORITATIVE_INFORMATION);
        expect(response.model).to.exist();
        expect(response.model.verification).to.exist();
        expect(response.model.verification.id).to.exist();
        helper.validateModel('#/definitions/LoginRes', response.model, done);
      }).catch(done);
    });

    it('[login] should throw error if user has more than one primary phone numbers', function (done) {
      co(function* () {
        yield datasource.bulkCreate(TABLE_NAMES.UserPhoneNumber, data.extraPrimaryNumbers);
        return yield userService.login({
          username: data.users[1].username,
          password: '123456',
          deviceId: data.phoneNumbers[0].deviceId,
        });
      }).then(() => {
        done(new Error('should not have been called'));
      }).catch((err) => {
        helper.assertError(err, 'user has multiple primary phone numbers', done);
      });
    });

    it('[googleLogin], should throw error if user not present', function (done) {
      // mock google external api call
      const googleApi = nock('https://www.googleapis.com')
        .get('/plus/v1/people/me')
        .reply(200, helper.getDummyGoogleProfile('someveryuniqueuuidemail@someuniquehost.com', uuid.v4()));
      co(function* () {
        return yield userService.googleLogin({
          deviceId: data.phoneNumbers[0].deviceId,
          token: 'somevalidsocialtoken',
        });
      }).then(() => {
        done(new Error('should not have been called'));
      }).catch((err) => {
        googleApi.done();
        helper.assertError(err, 'user not found', done);
      });
    });

    it('[googleLogin], should login if user found', function (done) {
      // mock google external api call
      const googleApi = nock('https://www.googleapis.com')
        .get('/plus/v1/people/me')
        .reply(200, helper.getDummyGoogleProfile(data.users[0].email, data.users[0].id));
      co(function* () {
        return yield userService.googleLogin({
          deviceId: data.phoneNumbers[0].deviceId,
          token: 'somevalidsocialtoken',
        });
      }).then((response) => {
        googleApi.done();
        expect(response.status).to.exist();
        helper.validateModel('#/definitions/LoginRes', response.model, done);
      }).catch(done);
    });

    it('[googleLogin], should respond with verification id if login from new device', function (done) {
      // mock google external api call
      const googleApi = nock('https://www.googleapis.com')
        .get('/plus/v1/people/me')
        .reply(200, helper.getDummyGoogleProfile(data.users[0].email, data.users[0].id));
      co(function* () {
        return yield userService.googleLogin({
          deviceId: uuid.v4(),
          token: 'somevalidsocialtoken',
        });
      }).then((response) => {
        googleApi.done();
        expect(response.model.verification).to.exist();
        expect(response.model.verification.id).to.exist();
        helper.validateModel('#/definitions/LoginWithVerificationRes', response.model, done);
      }).catch(done);
    });

    it('[googleLogin] should return 203 if user has no verified phone numbers', function (done) {
      // mock google external api call
      const googleApi = nock('https://www.googleapis.com')
        .get('/plus/v1/people/me')
        .reply(200, helper.getDummyGoogleProfile(data.users[2].email, data.users[2].id));
      co(function* () {
        return yield userService.googleLogin({
          token: 'somevalidsocialtoken',
          deviceId: data.phoneNumbers[0].deviceId,
        });
      }).then((response) => {
        googleApi.done();
        expect(response.status).to.equal(httpStatus.NON_AUTHORITATIVE_INFORMATION);
        helper.validateModel('#/definitions/LoginRes', response.model, done);
      }).catch(done);
    });

    it('[googleLogin] should return 203 if user phone number is not verified', function (done) {
      // mock google external api call
      const googleApi = nock('https://www.googleapis.com')
        .get('/plus/v1/people/me')
        .reply(200, helper.getDummyGoogleProfile(data.users[2].email, data.users[2].id));
      co(function* () {
        return yield userService.googleLogin({
          token: 'somevalidsocialtoken',
          deviceId: data.phoneNumbers[0].deviceId,
        });
      }).then((response) => {
        googleApi.done();
        expect(response.status).to.equal(httpStatus.NON_AUTHORITATIVE_INFORMATION);
        expect(response.model).to.exist();
        helper.validateModel('#/definitions/LoginRes', response.model, done);
      }).catch(done);
    });

    it('[googleLogin] should return 203 with verification id if user phone number is not verified', function (done) {
      // mock google external api call
      const googleApi = nock('https://www.googleapis.com')
        .get('/plus/v1/people/me')
        .reply(200, helper.getDummyGoogleProfile(data.users[1].email, data.users[1].id));
      co(function* () {
        return yield userService.googleLogin({
          token: 'somevalidsocialtoken',
          deviceId: data.phoneNumbers[1].deviceId,
        });
      }).then((response) => {
        googleApi.done();
        expect(response.status).to.equal(httpStatus.NON_AUTHORITATIVE_INFORMATION);
        expect(response.model).to.exist();
        expect(response.model.verification).to.exist();
        expect(response.model.verification.id).to.exist();
        helper.validateModel('#/definitions/LoginWithVerificationRes', response.model, done);
      }).catch(done);
    });

    it('[googleLogin] should throw error if user has more than one primary phone numbers', function (done) {
      // mock google external api call
      const googleApi = nock('https://www.googleapis.com')
        .get('/plus/v1/people/me')
        .reply(200, helper.getDummyGoogleProfile(data.users[1].email, data.users[1].id));
      co(function* () {
        yield datasource.bulkCreate(TABLE_NAMES.UserPhoneNumber, data.extraPrimaryNumbers);
        return yield userService.googleLogin({
          token: 'somevalidsocialtoken',
          deviceId: data.phoneNumbers[0].deviceId,
        });
      }).then(() => {
        done(new Error('should not have been called'));
      }).catch((err) => {
        googleApi.done();
        helper.assertError(err, 'user has multiple primary phone numbers', done);
      });
    });

    it('[facebookLogin], should throw error if user not present', function (done) {
      // mock google external api call
      const facebookApi = nock('https://graph.facebook.com')
        .get('/v2.9/me')
        .query(true)
        .reply(200, helper.getDummyFacebookProfile('someveryuniqueuuidemail@someuniquehost.com'));
      co(function* () {
        return yield userService.facebookLogin({
          deviceId: data.phoneNumbers[0].deviceId,
          token: 'somevalidsocialtoken',
        });
      }).then(() => {
        done(new Error('should not have been called'));
      }).catch((err) => {
        facebookApi.done();
        helper.assertError(err, 'user not found', done);
      });
    });

    it('[facebookLogin], should login if user found', function (done) {
      // mock google external api call
      const facebookApi = nock('https://graph.facebook.com')
        .get('/v2.9/me')
        .query(true)
        .reply(200, helper.getDummyFacebookProfile(data.users[0].email));
      co(function* () {
        return yield userService.facebookLogin({
          deviceId: data.phoneNumbers[0].deviceId,
          token: 'somevalidsocialtoken',
        });
      }).then((response) => {
        facebookApi.done();
        expect(response.status).to.exist();
        helper.validateModel('#/definitions/LoginRes', response.model, done);
      }).catch(done);
    });

    it('[facebookLogin], should respond with verification id if login from new device', function (done) {
      // mock google external api call
      const facebookApi = nock('https://graph.facebook.com')
        .get('/v2.9/me')
        .query(true)
        .reply(200, helper.getDummyFacebookProfile(data.users[0].email));
      co(function* () {
        return yield userService.facebookLogin({
          deviceId: uuid.v4(),
          token: 'somevalidsocialtoken',
        });
      }).then((response) => {
        facebookApi.done();
        expect(response.model.verification).to.exist();
        expect(response.model.verification.id).to.exist();
        helper.validateModel('#/definitions/LoginWithVerificationRes', response.model, done);
      }).catch(done);
    });


    it('[facebookLogin] should return 203 if user has no verified phone numbers', function (done) {
      // mock google external api call
      const facebookApi = nock('https://graph.facebook.com')
        .get('/v2.9/me')
        .query(true)
        .reply(200, helper.getDummyFacebookProfile(data.users[2].email));
      co(function* () {
        return yield userService.facebookLogin({
          token: 'somevalidsocialtoken',
          deviceId: data.phoneNumbers[0].deviceId,
        });
      }).then((response) => {
        facebookApi.done();
        expect(response.status).to.equal(httpStatus.NON_AUTHORITATIVE_INFORMATION);
        helper.validateModel('#/definitions/LoginRes', response.model, done);
      }).catch(done);
    });

    it('[facebookLogin] should return 203 if user phone number is not verified', function (done) {
      // mock google external api call
      const facebookApi = nock('https://graph.facebook.com')
        .get('/v2.9/me')
        .query(true)
        .reply(200, helper.getDummyFacebookProfile(data.users[2].email));
      co(function* () {
        return yield userService.facebookLogin({
          token: 'somevalidsocialtoken',
          deviceId: data.phoneNumbers[0].deviceId,
        });
      }).then((response) => {
        facebookApi.done();
        expect(response.status).to.equal(httpStatus.NON_AUTHORITATIVE_INFORMATION);
        expect(response.model).to.exist();
        helper.validateModel('#/definitions/LoginRes', response.model, done);
      }).catch(done);
    });

    it('[facebookLogin] should return 203 with verification id if user phone number is not verified', function (done) {
      // mock google external api call
      const facebookApi = nock('https://graph.facebook.com')
        .get('/v2.9/me')
        .query(true)
        .reply(200, helper.getDummyFacebookProfile(data.users[1].email));
      co(function* () {
        return yield userService.facebookLogin({
          token: 'somevalidsocialtoken',
          deviceId: data.phoneNumbers[1].deviceId,
        });
      }).then((response) => {
        facebookApi.done();
        expect(response.status).to.equal(httpStatus.NON_AUTHORITATIVE_INFORMATION);
        expect(response.model).to.exist();
        expect(response.model.verification).to.exist();
        expect(response.model.verification.id).to.exist();
        helper.validateModel('#/definitions/LoginWithVerificationRes', response.model, done);
      }).catch(done);
    });

    it('[facebookLogin] should throw error if user has more than one primary phone numbers', function (done) {
      // mock google external api call
      const facebookApi = nock('https://graph.facebook.com')
        .get('/v2.9/me')
        .query(true)
        .reply(200, helper.getDummyFacebookProfile(data.users[1].email));
      co(function* () {
        yield datasource.bulkCreate(TABLE_NAMES.UserPhoneNumber, data.extraPrimaryNumbers);
        return yield userService.facebookLogin({
          token: 'somevalidsocialtoken',
          deviceId: data.phoneNumbers[0].deviceId,
        });
      }).then(() => {
        done(new Error('should not have been called'));
      }).catch((err) => {
        facebookApi.done();
        helper.assertError(err, 'user has multiple primary phone numbers', done);
      });
    });


    it('[signup], should throw error if user already present by username', function (done) {
      co(function* () {
        return yield userService.signup({
          username: 'test',
          password: 'password',
          email: 'test@test.com',
          fullName: 'test user',
        });
      }).then(() => {
        done(new Error('should not have been called'));
      }).catch((err) => {
        helper.assertError(err, 'user already present with specified username', done);
      });
    });

    it('[signup], should throw error if user already present by email', function (done) {
      co(function* () {
        return yield userService.signup({
          username: 'testuniqueusername',
          password: 'password',
          email: 'test1@example.com',
          fullName: 'test user',
        });
      }).then(() => {
        done(new Error('should not have been called'));
      }).catch((err) => {
        helper.assertError(err, 'user already present with specified email', done);
      });
    });

    it('[signup], should signup if payload is valid', function (done) {
      co(function* () {
        return yield userService.signup({
          username: 'testuniqueusername',
          password: 'password',
          email: 'test1@exampleuniqueemail.com',
          fullName: 'test user unique',
        });
      }).then((response) => {
        // publish should have been called
        expect(service.getInstance()).to.exist();
        expect(service.getInstance().publish.callCount).to.equal(1);
        helper.validateModel('#/definitions/LoginRes', response, done);
      }).catch(done);
    });

    it('[signup], should force signup if force is true', function (done) {
      co(function* () {
        return yield userService.signup({
          username: 'testuniqueusername',
          password: 'password',
          email: 'test@example.com',
          fullName: 'test user unique',
        }, true);
      }).then((response) => {
        // publish should have been called
        expect(service.getInstance()).to.exist();
        expect(service.getInstance().publish.callCount).to.equal(1);
        helper.validateModel('#/definitions/LoginRes', response, done);
      }).catch(done);
    });

    it('[signup], should force signup if force is true', function (done) {
      co(function* () {
        return yield userService.signup({
          username: 'test',
          password: 'password',
          email: 'test@exampleuniqueemail.com',
          fullName: 'test user unique',
        }, true);
      }).then((response) => {
        // publish should have been called
        expect(service.getInstance()).to.exist();
        expect(service.getInstance().publish.callCount).to.equal(1);
        helper.validateModel('#/definitions/LoginRes', response, done);
      }).catch(done);
    });

    it('[forgotPassword], should throw error if user does not exist', function (done) {
      co(function* () {
        yield userService.forgotPassword({
          email: 'someinvalidemail@invalid.com',
        });
      }).then(() => {
        done(new Error('should not have been called'));
      }).catch((err) => {
        helper.assertError(err, 'user not found with specified email', done);
      });
    });

    it('[forgotPassword], should throw multiple database records for multiple users', function (done) {
      co(function* () {
        yield datasource.bulkCreate(TABLE_NAMES.User, data.extraUsers);
        yield userService.forgotPassword({
          email: data.users[0].email,
        });
      }).then(() => {
        done(new Error('should not have been called'));
      }).catch((err) => {
        helper.assertError(err, 'user not uniquely identified', done);
      });
    });

    it('[forgotPassword], should be successful', function (done) {
      co(function* () {
        yield userService.forgotPassword({
          email: data.users[0].email,
        });
      }).then(() => {
        expect(service.getInstance()).to.exist();
        expect(service.getInstance().publish.callCount).to.equal(1);
        done();
      }).catch(done);
    });

    it('[resetPassword], should throw error if token does not exist', function (done) {
      co(function* () {
        yield userService.resetPassword({
          code: uuid.v4(),         // non existent code
          password: 'newpassword',
        });
      }).then(() => {
        done(new Error('should not have been called'));
      }).catch((err) => {
        helper.assertError(err, 'Invalid reset password code', done);
      });
    });

    it('[resetPassword], should throw error if token expires', function (done) {
      co(function* () {
        yield userService.resetPassword({
          code: data.resetPassword[1].token,         // expired code
          password: 'newpassword',
        });
      }).then(() => {
        done(new Error('should not have been called'));
      }).catch((err) => {
        helper.assertError(err, 'Reset password code expired', done);
      });
    });

    it('[resetPassword], should be successful', function (done) {
      co(function* () {
        yield userService.resetPassword({
          code: data.resetPassword[0].token,
          password: 'newpassword',
        });
      }).then(() => done()).catch(done);
    });

    it('[resetPassword], should be successful, should ne able to login after reset password', function (done) {
      co(function* () {
        yield userService.resetPassword({
          code: data.resetPassword[0].token,
          password: 'newpassword',
        });
        // test the user is able to login with new password after reset password
        return yield userService.login({
          username: data.users[0].email,
          password: 'newpassword',
          deviceId: data.phoneNumbers[0].deviceId,
        });
      }).then((response) => {
        expect(response.status).to.exist();
        helper.validateModel('#/definitions/LoginRes', response.model, done);
      }).catch(done);
    });

    it('[resetPassword], should keep reset password history', function (done) {
      co(function* () {
        yield userService.resetPassword({
          code: data.resetPassword[0].token,
          password: 'newpassword',
        });
        return yield datasource.filter(TABLE_NAMES.UserResetPassword, { userId: data.users[0].id });
      }).then((response) => {
        expect(response).to.exist();
        expect(response.length).to.equal(1);
        expect(response[0].token).to.not.exist();
        expect(response[0].expires).to.not.exist();
        expect(response[0].userId).to.equal(data.users[0].id);
        done();
      }).catch(done);
    });

    it('[getUserFollowers], should be successful', function (done) {
      co(function* () {
        return yield userService.getUserFollowers({
          userId: data.users[0].id,
        }, data.users[0].id, { limit: 10, sort: 'id', direction: 'desc' });
      }).then((response) => {
        expect(response).to.exist();
        expect(response.data).to.exist();
        expect(response.data.length).to.equal(2);
        helper.validateModel('#/definitions/UsersWithFollowState', response.data, done);
      }).catch(done);
    });

    it('[getUserFollowers], should be successful', function (done) {
      co(function* () {
        return yield userService.getUserFollowers({
          userId: data.users[0].id,
        }, data.users[2].id, { limit: 10, sort: 'id', direction: 'desc' });
      }).then((response) => {
        expect(response).to.exist();
        expect(response.data).to.exist();
        expect(response.data.length).to.equal(2);
        helper.validateModel('#/definitions/UsersWithFollowState', response.data, done);
      }).catch(done);
    });

    it('[getUserFollowers], should return empty results if there are no followers', function (done) {
      co(function* () {
        return yield userService.getUserFollowers({
          userId: data.users[0].id,
        }, data.users[1].id, { limit: 10, sort: 'id', direction: 'desc' });
      }).then((response) => {
        expect(response).to.exist();
        expect(response.data).to.exist();
        expect(response.data.length).to.equal(0);
        helper.validateModel('#/definitions/Users', response.data, done);
      }).catch(done);
    });

    it('[getUserFollowings], should be successful', function (done) {
      co(function* () {
        return yield userService.getUserFollowings({
          userId: data.users[0].id,
        }, data.users[0].id, { limit: 10, sort: 'id', direction: 'desc' });
      }).then((response) => {
        expect(response).to.exist();
        expect(response.data).to.exist();
        expect(response.data.length).to.equal(1);
        helper.validateModel('#/definitions/UsersWithFollowState', response.data, done);
      }).catch(done);
    });

    it('[getUserFollowings], should be successful', function (done) {
      co(function* () {
        return yield userService.getUserFollowings({
          userId: data.users[0].id,
        }, data.users[1].id, { limit: 1, sort: 'id', direction: 'desc' });
      }).then((response) => {
        expect(response).to.exist();
        expect(response.data).to.exist();
        expect(response.data.length).to.equal(1);
        helper.validateModel('#/definitions/UsersWithFollowState', response.data, done);
      }).catch(done);
    });

    it('[getUserFollowings], should be successful', function (done) {
      co(function* () {
        return yield userService.getUserFollowings({
          userId: data.users[0].id,
        }, data.users[2].id, { limit: 10, sort: 'id', direction: 'desc' });
      }).then((response) => {
        expect(response).to.exist();
        expect(response.data).to.exist();
        expect(response.data.length).to.equal(1);
        helper.validateModel('#/definitions/UsersWithFollowState', response.data, done);
      }).catch(done);
    });

    it('[getUserFollowings], should return empty results if there are no followers', function (done) {
      co(function* () {
        return yield userService.getUserFollowings({
          userId: data.users[0].id,
        }, data.users[3].id, { limit: 10, sort: 'id', direction: 'desc' });
      }).then((response) => {
        expect(response).to.exist();
        expect(response.data).to.exist();
        expect(response.data.length).to.equal(0);
        helper.validateModel('#/definitions/UsersWithFollowState', response.data, done);
      }).catch(done);
    });

    it('[getUserInfo], should be successful', function (done) {
      co(function* () {
        return yield userService.getUserInfo({
          userId: data.users[0].id,
        }, data.users[0].id);
      }).then((response) => {
        expect(response).to.exist();
        expect(response.phoneNumbers).to.exist();
        expect(response.phoneNumbers.length).to.equal(2);
        expect(response.settings).to.exist();
        expect(response.settings.defaultActivityDuration).to.exist();
        expect(response.calendars.length).to.equal(1);
        helper.validateModel('#/definitions/User', response, done);
      }).catch(done);
    });

    it('[getUserProfile], should be successful', function (done) {
      co(function* () {
        return yield userService.getUserProfile({
          userId: data.users[0].id,
        }, data.users[0].id);
      }).then((response) => {
        expect(response).to.exist();
        expect(response.stats).to.exist();
        expect(response.followState).to.exist();
        expect(response.followState.status).to.equal(32);
        helper.validateModel('#/definitions/Profile', response, done);
      }).catch(done);
    });

    it('[sendVerificationCode], should throw error if phone number is already associated', function (done) {
      co(function* () {
        yield userService.sendVerificationCode({ userId: data.users[2].id }, {
          countryCode: data.phoneNumbers[0].countryCode,
          phoneNumber: data.phoneNumbers[0].phoneNumber,
          deviceId: uuid.v4(),
          device: 'iOS',
        }, data.users[2].id);
      }).then(() => {
        done(new Error('should not have been called'));
      }).catch((err) => {
        helper.assertError(err, 'This number is associated with existing user account', done);
      });
    });

    it('[sendVerificationCode], should throw error if illegal access', function (done) {
      co(function* () {
        yield userService.sendVerificationCode({ userId: data.users[1].id }, {
          countryCode: data.phoneNumbers[0].countryCode,
          phoneNumber: data.phoneNumbers[0].phoneNumber,
          deviceId: uuid.v4(),
          device: 'iOS',
        }, data.users[2].id);
      }).then(() => {
        done(new Error('should not have been called'));
      }).catch((err) => {
        helper.assertError(err, 'user can only send verification code to self account', done);
      });
    });

    it('[sendVerificationCode], new number should not be primary number', function (done) {
      co(function* () {
        const response = yield userService.sendVerificationCode({ userId: data.users[0].id }, {
          countryCode: '+1',
          phoneNumber: '8765434567',
          deviceId: uuid.v4(),
          device: 'iOS',
        }, data.users[0].id);
        const record = yield datasource.filter(TABLE_NAMES.UserPhoneNumber, { countryCode: '+1', phoneNumber: '8765434567' });
        return { response, record };
      }).then((result) => {
        expect(result).to.exist();
        expect(result.response).to.exist();
        expect(result.record).to.exist();
        expect(result.record[0].primary).to.equal(0);
        helper.validateModel('#/definitions/SendVerificationCodeRes', result.response, done);
      }).catch(done);
    });

    it('[sendVerificationCode], should be successful', function (done) {
      co(function* () {
        return yield userService.sendVerificationCode({ userId: data.users[0].id }, {
        }, data.users[0].id);
      }).then((result) => {
        expect(result).to.exist();
        helper.validateModel('#/definitions/SendVerificationCodeRes', result, done);
      }).catch(done);
    });

    it('[sendVerificationCode], should throw error if multiple prime numbers are found', function (done) {
      co(function* () {
        yield datasource.bulkCreate(TABLE_NAMES.UserPhoneNumber, data.extraPrimaryNumbers);
        yield userService.sendVerificationCode({ userId: data.users[1].id }, { }, data.users[1].id);
      }).then(() => {
        done(new Error('should not have been called'));
      }).catch((err) => {
        helper.assertError(err, 'multiple primary numbers', done);
      });
    });

    it('[verifyCode], should throw error for non existent id', function (done) {
      co(function* () {
        yield userService.verifyCode({ userId: data.users[0].id }, {
          id: uuid.v4(),
          code: '3434',
        }, data.users[0].id);
      }).then(() => {
        done(new Error('should not have been called'));
      }).catch((err) => {
        helper.assertError(err, 'invalid phone verification id', done);
      });
    });

    it('[verifyCode], should throw error if illegal access', function (done) {
      co(function* () {
        yield userService.verifyCode({ userId: data.users[0].id }, {
          id: uuid.v4(),
          code: '3434',
        }, data.users[1].id);
      }).then(() => {
        done(new Error('should not have been called'));
      }).catch((err) => {
        helper.assertError(err, 'user can only verify code for self account', done);
      });
    });

    it('[verifyCode], should throw error for invalid code', function (done) {
      co(function* () {
        const verification = yield userService.sendVerificationCode({ userId: data.users[0].id }, {
          countryCode: '+1',
          phoneNumber: '8765434567',
          deviceId: uuid.v4(),
          device: 'iOS',
        }, data.users[0].id);
        yield userService.verifyCode({ userId: data.users[0].id }, {
          id: verification.id,
          code: '343434',
        }, data.users[0].id);
      }).then(() => {
        done(new Error('should not have been called'));
      }).catch((err) => {
        helper.assertError(err, 'invalid verification code', done);
      });
    });

    it('[verifyCode], should throw error code generated for different user', function (done) {
      co(function* () {
        const verification = yield userService.sendVerificationCode({ userId: data.users[0].id }, {
          countryCode: '+1',
          phoneNumber: '8765434567',
          deviceId: uuid.v4(),
          device: 'iOS',
        }, data.users[0].id);
        const verificationRecord = yield datasource.getById(TABLE_NAMES.UserPhoneNumberVerification, verification.id);
        yield userService.verifyCode({ userId: data.users[1].id }, {
          id: verification.id,
          code: verificationRecord.code,
        }, data.users[1].id);
      }).then(() => {
        done(new Error('should not have been called'));
      }).catch((err) => {
        helper.assertError(err, 'code generated for different user', done);
      });
    });

    it('[verifyCode], should be successful', function (done) {
      co(function* () {
        const verification = yield userService.sendVerificationCode({ userId: data.users[0].id }, {
          countryCode: '+1',
          phoneNumber: '8765434567',
          deviceId: uuid.v4(),
          device: 'iOS',
        }, data.users[0].id);
        const verificationRecord = yield datasource.getById(TABLE_NAMES.UserPhoneNumberVerification, verification.id);
        yield userService.verifyCode({ userId: data.users[0].id }, {
          id: verification.id,
          code: verificationRecord.code,
        }, data.users[0].id);
        const phoneNumber = yield datasource.getById(TABLE_NAMES.UserPhoneNumber, verificationRecord.referenceId);
        const user = yield datasource.getById(TABLE_NAMES.User, data.users[0].id);
        return { user, phoneNumber };
      }).then((result) => {
        expect(result).to.exist();
        expect(result.user).to.exist();
        expect(result.phoneNumber).to.exist();
        expect(result.phoneNumber.status).to.equal(1);
        expect(result.user.status & 2).to.equal(2);
        done();
      }).catch(done);
    });

    it('[verifyEmail], should throw error if token does not exist', function (done) {
      co(function* () {
        yield userService.verifyEmail({
          token: uuid.v4(),         // non existent token
        });
      }).then(() => {
        done(new Error('should not have been called'));
      }).catch((err) => {
        helper.assertError(err, 'invalid verification token', done);
      });
    });

    it('[verifyEmail], should throw error if token expires', function (done) {
      co(function* () {
        yield userService.verifyEmail({
          token: data.emailVerification[1].token,         // expired token
        });
      }).then(() => {
        done(new Error('should not have been called'));
      }).catch((err) => {
        helper.assertError(err, 'verification token expired', done);
      });
    });

    it('[verifyEmail], should be successful', function (done) {
      co(function* () {
        yield userService.verifyEmail({
          token: data.emailVerification[0].token,         // expired token
        });
        return yield datasource.getById(TABLE_NAMES.User, data.users[0].id);
      }).then((response) => {
        expect(response).to.exist();
        expect(response.status & 5).to.equal(5);
        done();
      }).catch(done);
    });

    it('[refreshToken], should throw error for non existent user', function (done) {
      co(function* () {
        yield userService.refreshToken({
          userId: uuid.v4(),
          accessToken: 'somerefreshtoken',
        });
      }).then(() => {
        done(new Error('should not have been called'));
      }).catch((err) => {
        helper.assertError(err, 'user not found with specified id', done);
      });
    });

    it('[refreshToken], should be successful', function (done) {
      co(function* () {
        return yield userService.refreshToken({
          userId: data.users[0].id,
          accessToken: 'somerefreshtoken',
        });
      }).then((response) => {
        expect(response.tokens.refreshToken).to.equal('somerefreshtoken');
        helper.validateModel('#/definitions/LoginRes', response, done);
      }).catch(done);
    });

    it('[getUserNotificationPreferences], should throw error for non existent user', function (done) {
      co(function* () {
        yield userService.getUserNotificationPreferences({
          userId: uuid.v4(),
        }, data.users[0].id);
      }).then(() => {
        done(new Error('should not have been called'));
      }).catch((err) => {
        helper.assertError(err, 'user not found with specified id', done);
      });
    });

    it('[getUserNotificationPreferences], should throw error for different user', function (done) {
      co(function* () {
        yield userService.getUserNotificationPreferences({
          userId: data.users[0].id,
        }, data.users[1].id);
      }).then(() => {
        done(new Error('should not have been called'));
      }).catch((err) => {
        helper.assertError(err, 'user not permitted for this operation', done);
      });
    });

    it('[getUserNotificationPreferences], should throw error if there are no preferences', function (done) {
      co(function* () {
        yield userService.getUserNotificationPreferences({
          userId: data.users[1].id,
        }, data.users[1].id);
      }).then(() => {
        done(new Error('should not have been called'));
      }).catch((err) => {
        helper.assertError(err, 'notification preferences not found for specified user', done);
      });
    });

    it('[getUserNotificationPreferences], should be successful', function (done) {
      co(function* () {
        return yield userService.getUserNotificationPreferences({
          userId: data.users[0].id,
        }, data.users[0].id);
      }).then((response) => {
        helper.validateModel('#/definitions/NotificationPreferences', response, done);
      }).catch(done);
    });


    it('[updateUserNotificationPreferences], should throw error for non existent user', function (done) {
      co(function* () {
        yield userService.updateUserNotificationPreferences({
          userId: uuid.v4(),
        }, data.users[0].id, { preferences: 0 });
      }).then(() => {
        done(new Error('should not have been called'));
      }).catch((err) => {
        helper.assertError(err, 'user not found with specified id', done);
      });
    });

    it('[updateUserNotificationPreferences], should throw error for different user', function (done) {
      co(function* () {
        yield userService.updateUserNotificationPreferences({
          userId: data.users[0].id,
        }, data.users[1].id, { preferences: 0 });
      }).then(() => {
        done(new Error('should not have been called'));
      }).catch((err) => {
        helper.assertError(err, 'user not permitted for this operation', done);
      });
    });

    it('[updateUserNotificationPreferences], should throw error if there are no preferences', function (done) {
      co(function* () {
        yield userService.updateUserNotificationPreferences({
          userId: data.users[1].id,
        }, data.users[1].id, { preferences: 0 });
      }).then(() => {
        done(new Error('should not have been called'));
      }).catch((err) => {
        helper.assertError(err, 'notification preferences not found for specified user', done);
      });
    });

    it('[updateUserNotificationPreferences], should be successful', function (done) {
      co(function* () {
        return yield userService.updateUserNotificationPreferences({
          userId: data.users[0].id,
        }, data.users[0].id, { preferences: 0 });
      }).then((response) => {
        expect(response.preferences).to.equal(0);
        helper.validateModel('#/definitions/NotificationPreferences', response, done);
      }).catch(done);
    });

    it('[updateUserProfile], should throw error user can only update self profile', function (done) {
      co(function* () {
        yield userService.updateUserProfile({
          userId: uuid.v4(),
        }, data.users[0].id, {
          fullName: 'update name',
          bio: 'Hello I am a test user updated bio',
          approveFollowers: 1,
        });
      }).then(() => {
        done(new Error('should not have been called'));
      }).catch((err) => {
        helper.assertError(err, 'user can only update self profile', done);
      });
    });

    it('[updateUserProfile], should throw error for non existent user', function (done) {
      const userId = uuid.v4();
      co(function* () {
        yield userService.updateUserProfile({
          userId,
        }, userId, {
          fullName: 'update name',
          bio: 'Hello I am a test user updated bio',
          approveFollowers: 1,
        });
      }).then(() => {
        done(new Error('should not have been called'));
      }).catch((err) => {
        helper.assertError(err, 'user not found with specified id', done);
      });
    });

    it('[updateUserProfile], should be successful', function (done) {
      co(function* () {
        yield userService.updateUserProfile({
          userId: data.users[0].id,
        }, data.users[0].id, {
          fullName: 'update name',
          bio: 'Hello I am a test user updated bio',
          approveFollowers: 1,
        });
        return datasource.getById(TABLE_NAMES.User, data.users[0].id);
      }).then((response) => {
        expect(response).to.exist();
        expect(response.fullName).to.equal('update name');
        expect(response.bio).to.equal('Hello I am a test user updated bio');
        done();
      }).catch(done);
    });

    it('[updateUserProfile], should be successful, allow bio to be null', function (done) {
      co(function* () {
        yield userService.updateUserProfile({
          userId: data.users[0].id,
        }, data.users[0].id, {
          fullName: 'update name',
          bio: null,
          approveFollowers: 1,
        });
        return datasource.getById(TABLE_NAMES.User, data.users[0].id);
      }).then((response) => {
        expect(response).to.exist();
        expect(response.fullName).to.equal('update name');
        expect(response.bio).to.equal(null);
        done();
      }).catch(done);
    });

    it('[updateUserProfile], should be successful', function (done) {
      co(function* () {
        yield userService.updateUserProfile({
          userId: data.users[0].id,
        }, data.users[0].id, {
          approveFollowers: 1,
        });
        return datasource.getById(TABLE_NAMES.User, data.users[0].id);
      }).then((response) => {
        expect(response).to.exist();
        expect(response.fullName).to.equal(data.users[0].fullName);
        expect(response.bio).to.equal(data.users[0].bio);
        done();
      }).catch(done);
    });

    it('[getUserLinkedCalendars], should throw error for unauthorized access', function (done) {
      co(function* () {
        yield userService.getUserLinkedCalendars({
          userId: data.users[1].id,
        }, data.users[0].id);
      }).then(() => {
        done(new Error('should not have been called'));
      }).catch((err) => {
        helper.assertError(err, 'user can only view self linked calendars', done);
      });
    });

    it('[getUserLinkedCalendars], should throw error for non existent user', function (done) {
      const userId = uuid.v4();
      co(function* () {
        yield userService.getUserLinkedCalendars({
          userId,
        }, userId);
      }).then(() => {
        done(new Error('should not have been called'));
      }).catch((err) => {
        helper.assertError(err, 'user not found with specified id', done);
      });
    });

    it('[getUserLinkedCalendars], should be successful', function (done) {
      co(function* () {
        return yield userService.getUserLinkedCalendars({
          userId: data.users[0].id,
        }, data.users[0].id);
      }).then((response) => {
        helper.validateModel('#/definitions/UserLinkedCalendarDetailRes', response, done);
      }).catch(done);
    });

    it('[addUserLinkedCalendar], should be successful', function (done) {
      co(function* () {
        return yield userService.addUserLinkedCalendar({
          userId: data.users[1].id,
        }, data.users[1].id, {
          calendars: [{
            type: 'google',
            autoUpdate: 1,
            accessToken: 'somenewaccesstoken',
            refreshToken: 'somenewrefreshtoken',
            metadata: { username: 'googleuser' },
          }],
        });
      }).then((response) => {
        const filtered = _.filter(response.calendars, { type: 'google' });
        expect(filtered.length).to.equal(1);
        expect(filtered[0].metadata).to.deep.equal({ username: 'googleuser' });
        expect(filtered[0].autoUpdate).to.equal(1);
        helper.validateModel('#/definitions/UserLinkedCalendarDetailRes', response, done);
      }).catch(done);
    });

    it('[addUserLinkedCalendar], should be successful', function (done) {
      co(function* () {
        return yield userService.addUserLinkedCalendar({
          userId: data.users[1].id,
        }, data.users[1].id, {
          calendars: [{
            type: 'apple',
            autoUpdate: 0,
            accessToken: 'someupdatedaccesstoken',
            refreshToken: 'someupdatedrefreshtoken',
            metadata: { username: 'appleuser', property: 'value' },
          }],
          defaultActivityDuration: 100,
        });
      }).then((response) => {
        const filtered = _.filter(response.calendars, { type: 'apple' });
        expect(filtered.length).to.equal(1);
        expect(filtered[0].metadata).to.deep.equal({ username: 'appleuser', property: 'value', another: 12342344 });
        expect(filtered[0].autoUpdate).to.equal(0);
        expect(response.settings).to.exist();
        expect(response.settings.defaultActivityDuration).to.equal(100);
        helper.validateModel('#/definitions/UserLinkedCalendarDetailRes', response, done);
      }).catch(done);
    });

    it('[addUserLinkedCalendar], should be successful', function (done) {
      co(function* () {
        return yield userService.addUserLinkedCalendar({
          userId: data.users[1].id,
        }, data.users[1].id, {
          calendars: [{
            type: 'google',
            autoUpdate: 0,
            accessToken: 'someupdatedaccesstoken',
            refreshToken: 'someupdatedrefreshtoken',
            metadata: { username: 'googleuser', property: 'value' },
          }],
          defaultActivityDuration: 1000,
        });
      }).then((response) => {
        const filtered = _.filter(response.calendars, { type: 'google' });
        expect(filtered.length).to.equal(1);
        expect(filtered[0].metadata).to.deep.equal({ username: 'googleuser', property: 'value' });
        expect(filtered[0].autoUpdate).to.equal(0);
        expect(response.settings).to.exist();
        expect(response.settings.defaultActivityDuration).to.equal(1000);
        helper.validateModel('#/definitions/UserLinkedCalendarDetailRes', response, done);
      }).catch(done);
    });

    it('[addUserLinkedCalendar], should be successful', function (done) {
      co(function* () {
        return yield userService.addUserLinkedCalendar({
          userId: data.users[0].id,
        }, data.users[0].id, {
          calendars: [{
            type: 'apple',
            autoUpdate: 0,
            accessToken: 'somenewaccesstoken',
            refreshToken: 'somenewrefreshtoken',
            metadata: { username: 'appleusername' },
          }],
        });
      }).then((response) => {
        const filtered = _.filter(response.calendars, { type: 'google' });
        expect(filtered.length).to.equal(1);
        expect(filtered[0].metadata).to.not.exist();
        expect(filtered[0].autoUpdate).to.equal(1);
        helper.validateModel('#/definitions/UserLinkedCalendarDetailRes', response, done);
      }).catch(done);
    });

    it('[addUserLinkedCalendar], should throw error for different user', function (done) {
      co(function* () {
        return yield userService.addUserLinkedCalendar({
          userId: data.users[0].id,
        }, data.users[1].id, {
          calendars: [{
            type: 'google',
            autoUpdate: 1,
            accessToken: 'somenewaccesstoken',
            refreshToken: 'somenewrefreshtoken',
            metadata: { username: 'appleusername' },
          }],
        });
      }).then(() => {
        done(new Error('should not have been called'));
      }).catch((err) => {
        helper.assertError(err, 'user can only add linked calendars to self account', done);
      });
    });

    it('[addUserLinkedCalendar], should throw error for non existent user', function (done) {
      const userId = uuid.v4();
      co(function* () {
        return yield userService.addUserLinkedCalendar({
          userId,
        }, userId, {
          calendars: [{
            type: 'google',
            autoUpdate: 1,
            accessToken: 'somenewaccesstoken',
            refreshToken: 'somenewrefreshtoken',
            metadata: { username: 'appleusername' },
          }],
        });
      }).then(() => {
        done(new Error('should not have been called'));
      }).catch((err) => {
        helper.assertError(err, 'user not found with specified id', done);
      });
    });

    it('[getUserSocialConnections], should throw error for non existent user', function (done) {
      const userId = uuid.v4();
      co(function* () {
        return yield userService.getUserSocialConnections({ userId }, userId);
      }).then(() => {
        done(new Error('should not have been called'));
      }).catch((err) => {
        helper.assertError(err, 'user not found with specified id', done);
      });
    });

    it('[getUserSocialConnections], should throw error for illegal access', function (done) {
      co(function* () {
        return yield userService.getUserSocialConnections({ userId: uuid.v4() }, data.users[0].id);
      }).then(() => {
        done(new Error('should not have been called'));
      }).catch((err) => {
        helper.assertError(err, 'user can only view self social connections', done);
      });
    });

    it('[getUserSocialConnections], should be successful', function (done) {
      co(function* () {
        return yield userService.getUserSocialConnections({ userId: data.users[0].id }, data.users[0].id);
      }).then((response) => {
        expect(response).to.exist();
        expect(response.length).to.equal(1);
        helper.validateModel('#/definitions/UserSocialConnections', response, done);
      }).catch(done);
    });

    it('[getUserSocialConnections], should be successful', function (done) {
      co(function* () {
        return yield userService.getUserSocialConnections({ userId: data.users[1].id }, data.users[1].id);
      }).then((response) => {
        expect(response).to.exist();
        expect(response.length).to.equal(1);
        helper.validateModel('#/definitions/UserSocialConnections', response, done);
      }).catch(done);
    });


    it('[addUserSocialConnection], should throw error for non existent user', function (done) {
      const userId = uuid.v4();
      co(function* () {
        return yield userService.addUserSocialConnection({ userId }, userId, {
          accessToken: 'socialaccesstoken',
          refreshToken: 'socialrefreshtoken',
          type: 'google',
        });
      }).then(() => {
        done(new Error('should not have been called'));
      }).catch((err) => {
        helper.assertError(err, 'user not found with specified id', done);
      });
    });

    it('[addUserSocialConnection], should throw error for illegal access', function (done) {
      co(function* () {
        return yield userService.addUserSocialConnection({ userId: uuid.v4() }, data.users[0].id, {
          accessToken: 'socialaccesstoken',
          refreshToken: 'socialrefreshtoken',
          type: 'google',
        });
      }).then(() => {
        done(new Error('should not have been called'));
      }).catch((err) => {
        helper.assertError(err, 'user can only add social connection to self account', done);
      });
    });

    it('[addUserSocialConnection], should be successful', function (done) {
      const facebookApi = nock('https://graph.facebook.com')
        .get('/v2.9/me')
        .query(true)
        .reply(200, helper.getDummyFacebookProfile(data.users[0].email));
      co(function* () {
        return yield userService.addUserSocialConnection({ userId: data.users[0].id }, data.users[0].id, {
          accessToken: 'socialaccesstoken',
          refreshToken: 'socialrefreshtoken',
          type: 'facebook',
        });
      }).then((response) => {
        facebookApi.done();
        expect(response).to.exist();
        expect(response.length).to.equal(2);
        helper.validateModel('#/definitions/UserSocialConnections', response, done);
      }).catch(done);
    });

    it('[addUserSocialConnection], should be successful', function (done) {
      const facebookApi = nock('https://graph.facebook.com')
        .get('/v2.9/me')
        .query(true)
        .reply(200, helper.getDummyFacebookProfile(data.users[1].email));
      co(function* () {
        return yield userService.addUserSocialConnection({ userId: data.users[1].id }, data.users[1].id, {
          accessToken: 'socialaccesstoken',
          refreshToken: 'socialrefreshtoken',
          type: 'facebook',
        });
      }).then((response) => {
        facebookApi.done();
        expect(response).to.exist();
        expect(response.length).to.equal(2);
        helper.validateModel('#/definitions/UserSocialConnections', response, done);
      }).catch(done);
    });

    it('[addUserSocialConnection], should be successful update existing record', function (done) {
      const googleApi = nock('https://www.googleapis.com')
        .get('/plus/v1/people/me')
        .reply(200, helper.getDummyGoogleProfile(data.users[1].email, data.users[1].id));
      const googleTokenApi = nock('https://accounts.google.com')
        .post('/o/oauth2/token')
        .reply(200, helper.getDummyGoogleTokenResponse());
      co(function* () {
        return yield userService.addUserSocialConnection({ userId: data.users[1].id }, data.users[1].id, {
          serverAuthCode: 'someserverauthcode',
          type: 'google',
        });
      }).then((response) => {
        googleApi.done();
        googleTokenApi.done();
        expect(response).to.exist();
        expect(response.length).to.equal(1);
        helper.validateModel('#/definitions/UserSocialConnections', response, done);
      }).catch(done);
    });

    it('[addUserSocialConnection], should be successful update existing record', function (done) {
      const googleApi = nock('https://www.googleapis.com')
        .get('/plus/v1/people/me')
        .reply(200, helper.getDummyGoogleProfile(data.users[0].email, data.users[0].id));
      const googleTokenApi = nock('https://accounts.google.com')
        .post('/o/oauth2/token')
        .reply(200, helper.getDummyGoogleTokenResponse());
      co(function* () {
        return yield userService.addUserSocialConnection({ userId: data.users[0].id }, data.users[0].id, {
          serverAuthCode: 'someserverauthcode',
          type: 'google',
        });
      }).then((response) => {
        googleApi.done();
        googleTokenApi.done();
        expect(response).to.exist();
        expect(response.length).to.equal(1);
        helper.validateModel('#/definitions/UserSocialConnections', response, done);
      }).catch(done);
    });

  });
});
