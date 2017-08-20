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
const expect = require('chai').expect;
const uuid = require('uuid');

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

const commentService = proxyquire('../../app/services/CommentService', mocks);

// the table names for which to init the data
const initTableNames = [TABLE_NAMES.User, TABLE_NAMES.UserPhoneNumber, TABLE_NAMES.UserResetPassword,
  TABLE_NAMES.UserFollower, TABLE_NAMES.UserEmailVerification, TABLE_NAMES.UserNotificationPreference,
  TABLE_NAMES.UserSetting, TABLE_NAMES.UserLinkedCalendar, TABLE_NAMES.UserSocialConnection,
  TABLE_NAMES.Activity, TABLE_NAMES.ActivityInvitee, TABLE_NAMES.ActivityLike, TABLE_NAMES.ActivityRsvp,
  TABLE_NAMES.Comment, TABLE_NAMES.CommentLike];

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

  describe('CommentService', function () {

    beforeEach('insert some test data', function () {
      return datasource.initDb(initTableNames);
    });

    afterEach('clean test data', function () {
      // reset publish history so that we can assert callCount for each test individually
      service.getInstance().publish.resetHistory();
      return datasource.clearDb();
    });

    it('RabbitMQService should have been instantiated', function (done) {
      expect(service.proxy.callCount).to.equal(3);
      done();
    });

    it('[addComment], should throw error for non existent activity', function (done) {
      co(function* () {
        yield commentService.addComment({ userId: data.users[0].id }, uuid.v4(), {
          text: 'Hello I am a comment',
        });
      }).then(() => {
        done(new Error('should not have been called'));
      }).catch((err) => {
        expect(service.getInstance().publish.callCount).to.equal(0);
        helper.assertError(err, 'activity not found with specified id', done);
      });
    });

    it('[addComment], should throw error for illegal access for private activity', function (done) {
      co(function* () {
        yield commentService.addComment({ userId: data.users[3].id }, data.activities[0].id, {
          text: 'Hello I am a comment',
        });
      }).then(() => {
        done(new Error('should not have been called'));
      }).catch((err) => {
        expect(service.getInstance().publish.callCount).to.equal(0);
        helper.assertError(err, 'user is not an invitee', done);
      });
    });

    it('[addComment], should throw error for illegal access for shared activity', function (done) {
      co(function* () {
        yield commentService.addComment({ userId: data.users[3].id }, data.activities[1].id, {
          text: 'Hello I am a comment',
        });
      }).then(() => {
        done(new Error('should not have been called'));
      }).catch((err) => {
        expect(service.getInstance().publish.callCount).to.equal(0);
        helper.assertError(err, 'user is not follower of activity author', done);
      });
    });

    it('[addComment], should be successful for private activity for owner', function (done) {
      co(function* () {
        return yield commentService.addComment({ userId: data.users[0].id }, data.activities[0].id, {
          text: 'Hello I am a comment',
        });
      }).then((response) => {
        expect(response).to.exist();
        expect(response.activityId).to.equal(data.activities[0].id);
        expect(response.author).to.equal(data.users[0].id);
        expect(response.text).to.equal('Hello I am a comment');
        expect(service.getInstance().publish.callCount).to.equal(0);
        helper.validateModel('#/definitions/Comment', response, done);
      }).catch(done);
    });

    it('[addComment], should be successful for private activity', function (done) {
      co(function* () {
        return yield commentService.addComment({ userId: data.users[1].id }, data.activities[0].id, {
          text: 'Hello I am a comment',
        });
      }).then((response) => {
        expect(response).to.exist();
        expect(response.activityId).to.equal(data.activities[0].id);
        expect(response.author).to.equal(data.users[1].id);
        expect(response.text).to.equal('Hello I am a comment');
        expect(service.getInstance().publish.callCount).to.equal(0);
        helper.validateModel('#/definitions/Comment', response, done);
      }).catch(done);
    });

    it('[addComment], should be successful for private activity', function (done) {
      co(function* () {
        return yield commentService.addComment({ userId: data.users[2].id }, data.activities[0].id, {
          text: 'Hello I am a comment',
        });
      }).then((response) => {
        expect(response).to.exist();
        expect(response.activityId).to.equal(data.activities[0].id);
        expect(response.author).to.equal(data.users[2].id);
        expect(response.text).to.equal('Hello I am a comment');
        expect(service.getInstance().publish.callCount).to.equal(0);
        helper.validateModel('#/definitions/Comment', response, done);
      }).catch(done);
    });

    it('[addComment], should be successful for shared activity for owner', function (done) {
      co(function* () {
        return yield commentService.addComment({ userId: data.users[0].id }, data.activities[1].id, {
          text: 'Hello I am a comment',
        });
      }).then((response) => {
        expect(response).to.exist();
        expect(response.activityId).to.equal(data.activities[1].id);
        expect(response.author).to.equal(data.users[0].id);
        expect(response.text).to.equal('Hello I am a comment');
        expect(service.getInstance().publish.callCount).to.equal(0);
        helper.validateModel('#/definitions/Comment', response, done);
      }).catch(done);
    });

    it('[addComment], should be successful for shared activity', function (done) {
      co(function* () {
        return yield commentService.addComment({ userId: data.users[1].id }, data.activities[1].id, {
          text: 'Hello I am a comment',
        });
      }).then((response) => {
        expect(response).to.exist();
        expect(response.activityId).to.equal(data.activities[1].id);
        expect(response.author).to.equal(data.users[1].id);
        expect(response.text).to.equal('Hello I am a comment');
        expect(service.getInstance().publish.callCount).to.equal(0);
        helper.validateModel('#/definitions/Comment', response, done);
      }).catch(done);
    });

    it('[addComment], should be successful for public activity for owner', function (done) {
      co(function* () {
        return yield commentService.addComment({ userId: data.users[0].id }, data.activities[2].id, {
          text: 'Hello I am a comment',
        });
      }).then((response) => {
        expect(response).to.exist();
        expect(response.activityId).to.equal(data.activities[2].id);
        expect(response.author).to.equal(data.users[0].id);
        expect(response.text).to.equal('Hello I am a comment');
        expect(service.getInstance().publish.callCount).to.equal(0);
        helper.validateModel('#/definitions/Comment', response, done);
      }).catch(done);
    });

    it('[addComment], should be successful for public activity', function (done) {
      co(function* () {
        return yield commentService.addComment({ userId: data.users[1].id }, data.activities[2].id, {
          text: 'Hello I am a comment',
        });
      }).then((response) => {
        expect(response).to.exist();
        expect(response.activityId).to.equal(data.activities[2].id);
        expect(response.author).to.equal(data.users[1].id);
        expect(response.text).to.equal('Hello I am a comment');
        expect(service.getInstance().publish.callCount).to.equal(0);
        helper.validateModel('#/definitions/Comment', response, done);
      }).catch(done);
    });

    it('[addComment], should be successful for public activity', function (done) {
      co(function* () {
        return yield commentService.addComment({ userId: data.users[3].id }, data.activities[2].id, {
        });
      }).then((response) => {
        expect(response).to.exist();
        expect(response.activityId).to.equal(data.activities[2].id);
        expect(response.author).to.equal(data.users[3].id);
        expect(response.text).to.not.exist();
        expect(service.getInstance().publish.callCount).to.equal(0);
        helper.validateModel('#/definitions/Comment', response, done);
      }).catch(done);
    });

    it('[likeComment], should throw error for non existent activity', function (done) {
      co(function* () {
        yield commentService.likeComment({ userId: data.users[0].id }, uuid.v4(), data.comments[0].id);
      }).then(() => {
        done(new Error('should not have been called'));
      }).catch((err) => {
        expect(service.getInstance().publish.callCount).to.equal(0);
        helper.assertError(err, 'activity not found with specified id', done);
      });
    });

    it('[likeComment], should throw error for non existent comment', function (done) {
      co(function* () {
        yield commentService.likeComment({ userId: data.users[1].id }, data.activities[0].id, uuid.v4());
      }).then(() => {
        done(new Error('should not have been called'));
      }).catch((err) => {
        expect(service.getInstance().publish.callCount).to.equal(0);
        helper.assertError(err, 'comment not found with specified id', done);
      });
    });

    it('[likeComment], should throw error for illegal access for private activity', function (done) {
      co(function* () {
        yield commentService.likeComment({ userId: data.users[3].id }, data.activities[0].id, data.comments[0].id);
      }).then(() => {
        done(new Error('should not have been called'));
      }).catch((err) => {
        expect(service.getInstance().publish.callCount).to.equal(0);
        helper.assertError(err, 'user is not an invitee', done);
      });
    });

    it('[likeComment], should throw error for illegal access for shared activity', function (done) {
      co(function* () {
        yield commentService.likeComment({ userId: data.users[3].id }, data.activities[1].id, data.comments[2].id);
      }).then(() => {
        done(new Error('should not have been called'));
      }).catch((err) => {
        expect(service.getInstance().publish.callCount).to.equal(0);
        helper.assertError(err, 'user is not follower of activity author', done);
      });
    });

    it('[likeComment], should be successful for private activity for owner', function (done) {
      co(function* () {
        yield commentService.likeComment({ userId: data.users[0].id }, data.activities[0].id, data.comments[1].id);
        return yield datasource.filter(TABLE_NAMES.CommentLike, { commentId: data.comments[1].id });
      }).then((response) => {
        expect(response).to.exist();
        expect(response.length).to.equal(1);
        expect(service.getInstance().publish.callCount).to.equal(0);
        done();
      }).catch(done);
    });

    it('[likeComment], should be successful for private activity', function (done) {
      co(function* () {
        yield commentService.likeComment({ userId: data.users[1].id }, data.activities[0].id, data.comments[1].id);
        return yield datasource.filter(TABLE_NAMES.CommentLike, { commentId: data.comments[1].id });
      }).then((response) => {
        expect(response).to.exist();
        expect(response.length).to.equal(1);
        expect(service.getInstance().publish.callCount).to.equal(0);
        done();
      }).catch(done);
    });

    it('[likeComment], should be successful for private activity', function (done) {
      co(function* () {
        yield commentService.likeComment({ userId: data.users[2].id }, data.activities[0].id, data.comments[1].id);
        return yield datasource.filter(TABLE_NAMES.CommentLike, { commentId: data.comments[1].id });
      }).then((response) => {
        expect(response).to.exist();
        expect(response.length).to.equal(1);
        expect(service.getInstance().publish.callCount).to.equal(0);
        done();
      }).catch(done);
    });

    it('[likeComment], should be successful for shared activity for owner', function (done) {
      co(function* () {
        yield commentService.likeComment({ userId: data.users[0].id }, data.activities[1].id, data.comments[2].id);
        return yield datasource.filter(TABLE_NAMES.CommentLike, { commentId: data.comments[2].id });
      }).then((response) => {
        expect(response).to.exist();
        expect(response.length).to.equal(1);
        expect(service.getInstance().publish.callCount).to.equal(0);
        done();
      }).catch(done);
    });

    it('[likeComment], should be successful for shared activity', function (done) {
      co(function* () {
        yield commentService.likeComment({ userId: data.users[1].id }, data.activities[1].id, data.comments[2].id);
        return yield datasource.filter(TABLE_NAMES.CommentLike, { commentId: data.comments[2].id });
      }).then((response) => {
        expect(response).to.exist();
        expect(response.length).to.equal(1);
        expect(service.getInstance().publish.callCount).to.equal(0);
        done();
      }).catch(done);
    });

    it('[likeComment], should be successful for public activity', function (done) {
      co(function* () {
        yield commentService.likeComment({ userId: data.users[0].id }, data.activities[2].id, data.comments[3].id);
        return yield datasource.filter(TABLE_NAMES.CommentLike, { commentId: data.comments[3].id });
      }).then((response) => {
        expect(response).to.exist();
        expect(response.length).to.equal(1);
        expect(service.getInstance().publish.callCount).to.equal(0);
        done();
      }).catch(done);
    });

    it('[likeComment], should be successful for public activity', function (done) {
      co(function* () {
        yield commentService.likeComment({ userId: data.users[3].id }, data.activities[2].id, data.comments[3].id);
        return yield datasource.filter(TABLE_NAMES.CommentLike, { commentId: data.comments[3].id });
      }).then((response) => {
        expect(response).to.exist();
        expect(response.length).to.equal(1);
        expect(service.getInstance().publish.callCount).to.equal(0);
        done();
      }).catch(done);
    });

    it('[dislikeComment], should throw error for non existent activity', function (done) {
      co(function* () {
        yield commentService.dislikeComment({ userId: data.users[0].id }, uuid.v4(), data.comments[0].id);
      }).then(() => {
        done(new Error('should not have been called'));
      }).catch((err) => {
        expect(service.getInstance().publish.callCount).to.equal(0);
        helper.assertError(err, 'activity not found with specified id', done);
      });
    });

    it('[dislikeComment], should throw error for non existent comment', function (done) {
      co(function* () {
        yield commentService.dislikeComment({ userId: data.users[1].id }, data.activities[0].id, uuid.v4());
      }).then(() => {
        done(new Error('should not have been called'));
      }).catch((err) => {
        expect(service.getInstance().publish.callCount).to.equal(0);
        helper.assertError(err, 'comment not found with specified id', done);
      });
    });

    it('[dislikeComment], should throw error for illegal access for private activity', function (done) {
      co(function* () {
        yield commentService.dislikeComment({ userId: data.users[3].id }, data.activities[0].id, data.comments[0].id);
      }).then(() => {
        done(new Error('should not have been called'));
      }).catch((err) => {
        expect(service.getInstance().publish.callCount).to.equal(0);
        helper.assertError(err, 'user is not an invitee', done);
      });
    });

    it('[dislikeComment], should throw error for illegal access for shared activity', function (done) {
      co(function* () {
        yield commentService.dislikeComment({ userId: data.users[3].id }, data.activities[1].id, data.comments[2].id);
      }).then(() => {
        done(new Error('should not have been called'));
      }).catch((err) => {
        expect(service.getInstance().publish.callCount).to.equal(0);
        helper.assertError(err, 'user is not follower of activity author', done);
      });
    });

    it('[dislikeComment], should be successful for private activity for owner', function (done) {
      co(function* () {
        yield commentService.likeComment({ userId: data.users[0].id }, data.activities[0].id, data.comments[1].id);
        yield commentService.dislikeComment({ userId: data.users[0].id }, data.activities[0].id, data.comments[1].id);
        return yield datasource.filter(TABLE_NAMES.CommentLike, { commentId: data.comments[1].id });
      }).then((response) => {
        expect(response).to.exist();
        expect(response.length).to.equal(0);
        expect(service.getInstance().publish.callCount).to.equal(0);
        done();
      }).catch(done);
    });

    it('[dislikeComment], should be successful for private activity', function (done) {
      co(function* () {
        yield commentService.likeComment({ userId: data.users[1].id }, data.activities[0].id, data.comments[1].id);
        yield commentService.dislikeComment({ userId: data.users[1].id }, data.activities[0].id, data.comments[1].id);
        return yield datasource.filter(TABLE_NAMES.CommentLike, { commentId: data.comments[1].id });
      }).then((response) => {
        expect(response).to.exist();
        expect(response.length).to.equal(0);
        expect(service.getInstance().publish.callCount).to.equal(0);
        done();
      }).catch(done);
    });

    it('[dislikeComment], should be successful for private activity', function (done) {
      co(function* () {
        yield commentService.likeComment({ userId: data.users[2].id }, data.activities[0].id, data.comments[1].id);
        yield commentService.dislikeComment({ userId: data.users[2].id }, data.activities[0].id, data.comments[1].id);
        return yield datasource.filter(TABLE_NAMES.CommentLike, { commentId: data.comments[1].id });
      }).then((response) => {
        expect(response).to.exist();
        expect(response.length).to.equal(0);
        expect(service.getInstance().publish.callCount).to.equal(0);
        done();
      }).catch(done);
    });

    it('[dislikeComment], should be successful for shared activity for owner', function (done) {
      co(function* () {
        yield commentService.likeComment({ userId: data.users[0].id }, data.activities[1].id, data.comments[2].id);
        yield commentService.dislikeComment({ userId: data.users[0].id }, data.activities[1].id, data.comments[2].id);
        return yield datasource.filter(TABLE_NAMES.CommentLike, { commentId: data.comments[2].id });
      }).then((response) => {
        expect(response).to.exist();
        expect(response.length).to.equal(0);
        expect(service.getInstance().publish.callCount).to.equal(0);
        done();
      }).catch(done);
    });

    it('[dislikeComment], should be successful for shared activity', function (done) {
      co(function* () {
        yield commentService.likeComment({ userId: data.users[1].id }, data.activities[1].id, data.comments[2].id);
        yield commentService.dislikeComment({ userId: data.users[1].id }, data.activities[1].id, data.comments[2].id);
        return yield datasource.filter(TABLE_NAMES.CommentLike, { commentId: data.comments[2].id });
      }).then((response) => {
        expect(response).to.exist();
        expect(response.length).to.equal(0);
        expect(service.getInstance().publish.callCount).to.equal(0);
        done();
      }).catch(done);
    });

    it('[dislikeComment], should be successful for public activity', function (done) {
      co(function* () {
        yield commentService.likeComment({ userId: data.users[0].id }, data.activities[2].id, data.comments[3].id);
        yield commentService.dislikeComment({ userId: data.users[0].id }, data.activities[2].id, data.comments[3].id);
        return yield datasource.filter(TABLE_NAMES.CommentLike, { commentId: data.comments[3].id });
      }).then((response) => {
        expect(response).to.exist();
        expect(response.length).to.equal(0);
        expect(service.getInstance().publish.callCount).to.equal(0);
        done();
      }).catch(done);
    });

    it('[dislikeComment], should be successful for public activity', function (done) {
      co(function* () {
        yield commentService.likeComment({ userId: data.users[3].id }, data.activities[2].id, data.comments[3].id);
        yield commentService.dislikeComment({ userId: data.users[3].id }, data.activities[2].id, data.comments[3].id);
        return yield datasource.filter(TABLE_NAMES.CommentLike, { commentId: data.comments[3].id });
      }).then((response) => {
        expect(response).to.exist();
        expect(response.length).to.equal(0);
        expect(service.getInstance().publish.callCount).to.equal(0);
        done();
      }).catch(done);
    });

    it('[addCommentOnComment], should fail for non existent activity', function (done) {
      co(function* () {
        yield commentService.addCommentOnComment({ userId: data.users[1].id }, uuid.v4(), data.comments[3].id, {
          text: 'Hello I am a comment on comment',
        });
      }).then(() => {
        done(new Error('should not have been called'));
      }).catch((error) => {
        expect(service.getInstance().publish.callCount).to.equal(0);
        helper.assertError(error, 'activity not found with specified id', done);
      });
    });

    it('[addCommentOnComment], should fail for non existent comment', function (done) {
      co(function* () {
        yield commentService.addCommentOnComment({ userId: data.users[1].id }, data.activities[0].id, uuid.v4(), {
          text: 'Hello I am a comment on comment',
        });
      }).then(() => {
        done(new Error('should not have been called'));
      }).catch((error) => {
        expect(service.getInstance().publish.callCount).to.equal(0);
        helper.assertError(error, 'comment not found with specified id', done);
      });
    });

    it('[addCommentOnComment], should fail for text comment', function (done) {
      co(function* () {
        yield commentService.addCommentOnComment({ userId: data.users[1].id }, data.activities[0].id, data.comments[0].id, {
          text: 'user can only add comment on photo comment',
        });
      }).then(() => {
        done(new Error('should not have been called'));
      }).catch((error) => {
        expect(service.getInstance().publish.callCount).to.equal(0);
        helper.assertError(error, 'user can only add comment on photo comment', done);
      });
    });

    it('[addCommentOnComment], should be successful', function (done) {
      co(function* () {
        return yield commentService.addCommentOnComment({ userId: data.users[1].id }, data.activities[0].id,
          data.comments[1].id, { text: 'user can only add comment on photo comment' });
      }).then((response) => {
        expect(response).to.exist();
        expect(response.parent).to.equal(data.comments[1].id);
        expect(response.author).to.equal(data.users[1].id);
        expect(response.text).to.equal('user can only add comment on photo comment');
        expect(response.photos).to.not.exist();
        expect(service.getInstance().publish.callCount).to.equal(1);
        helper.validateModel('#/definitions/Comment', response, done);
      }).catch(done);
    });
  });
});
