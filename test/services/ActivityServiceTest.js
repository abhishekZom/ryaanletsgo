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

const activityService = proxyquire('../../app/services/ActivityService', mocks);

// the table names for which to init the data
const initTableNames = [TABLE_NAMES.User, TABLE_NAMES.UserPhoneNumber, TABLE_NAMES.UserResetPassword,
  TABLE_NAMES.UserFollower, TABLE_NAMES.UserEmailVerification, TABLE_NAMES.UserNotificationPreference,
  TABLE_NAMES.UserSetting, TABLE_NAMES.UserLinkedCalendar, TABLE_NAMES.UserSocialConnection,
  TABLE_NAMES.Activity, TABLE_NAMES.ActivityInvitee, TABLE_NAMES.ActivityLike, TABLE_NAMES.ActivityRsvp,
  TABLE_NAMES.Comment, TABLE_NAMES.CommentLike, TABLE_NAMES.ActivityPhoto, TABLE_NAMES.UserContact];

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

  describe('ActivityService', function () {

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

    it('[createActivity], should throw error if user settings are invalid', function (done) {
      co(function* () {
        return yield activityService.createActivity({ userId: data.users[3].id }, {
          title: 'Let us go to a movie',
          start: 1493474742000,
          privacy: 'private',
        });
      }).then(() => {
        done(new Error('should not have been called'));
      }).catch((err) => {
        expect(service.getInstance().publish.callCount).to.equal(0);
        helper.assertError(err, 'corrupt user settings state', done);
      });
    });

    it('[createActivity], should be successful', function (done) {
      co(function* () {
        const activity = yield activityService.createActivity({ userId: data.users[0].id }, {
          title: 'Let us go to a movie',
          start: 1493474742000,
          privacy: 'private',
        });
        const rsvp = yield datasource.filter(TABLE_NAMES.ActivityRsvp, {
          activityId: activity.id,
          userId: data.users[0].id,
        });
        return { activity, rsvp };
      }).then((response) => {
        expect(response).to.exist();
        expect(response.activity).to.exist();
        expect(response.rsvp).to.exist();
        expect(response.rsvp.length).to.equal(1);
        expect(response.activity.duration).to.equal(10000);
        expect(response.activity.author).to.exist();
        expect(response.activity.author.id).to.equal(data.users[0].id);
        expect(service.getInstance().publish.callCount).to.equal(1);
        helper.validateModel('#/definitions/ActivityDetail', response.activity, done);
      }).catch(done);
    });

    it('[createActivity], should be successful', function (done) {
      co(function* () {
        const activity = yield activityService.createActivity({ userId: data.users[0].id }, {
          title: 'Let us go to a movie',
          start: 1493474742000,
          privacy: 'private',
          duration: 100,
          invitees: {
            users: ['7b897879-2732-4900-a390-119b45588586', '908e7759-ab11-493b-90c5-59d9272882da'],
          },
        });
        const rsvp = yield datasource.filter(TABLE_NAMES.ActivityRsvp, {
          activityId: activity.id,
          userId: data.users[0].id,
        });
        const invitees = yield datasource.filter(TABLE_NAMES.ActivityInvitee, { activityId: activity.id });
        return { activity, rsvp, invitees };
      }).then((response) => {
        expect(response).to.exist();
        expect(response.activity).to.exist();
        expect(response.invitees).to.exist();
        expect(response.invitees.length).to.equal(2);
        expect(response.activity.duration).to.equal(100);
        expect(response.activity.author).to.exist();
        expect(response.rsvp).to.exist();
        expect(response.rsvp.length).to.equal(1);
        expect(response.activity.author.id).to.equal(data.users[0].id);
        expect(service.getInstance().publish.callCount).to.equal(1);
        helper.validateModel('#/definitions/ActivityDetail', response.activity, done);
      }).catch(done);
    });

    it('[getActivityDetail], should throw error for non existent activity', function (done) {
      co(function* () {
        yield activityService.getActivityDetail({ userId: data.users[0].id }, uuid.v4());
      }).then(() => {
        done(new Error('should not have been called'));
      }).catch((error) => {
        expect(service.getInstance().publish.callCount).to.equal(0);
        helper.assertError(error, 'activity not found with specified id', done);
      });
    });

    it('[getActivityDetail], should be successful', function (done) {
      co(function* () {
        return yield activityService.getActivityDetail({ userId: data.users[0].id }, data.activities[0].id);
      }).then((response) => {
        expect(response).to.exist();
        expect(response.author).to.exist();
        expect(service.getInstance().publish.callCount).to.equal(0);
        helper.validateModel('#/definitions/ActivityDetail', response, done);
      }).catch(done);
    });

    it('[deleteActivity], should throw error for non existent activity', function (done) {
      co(function* () {
        yield activityService.deleteActivity({ userId: data.users[0].id }, uuid.v4());
      }).then(() => {
        done(new Error('should not have been called'));
      }).catch((err) => {
        expect(service.getInstance().publish.callCount).to.equal(0);
        helper.assertError(err, 'activity not found with specified id', done);
      });
    });

    it('[deleteActivity], should throw error for illegal access', function (done) {
      co(function* () {
        yield activityService.deleteActivity({ userId: data.users[1].id }, data.activities[0].id);
      }).then(() => {
        done(new Error('should not have been called'));
      }).catch((err) => {
        expect(service.getInstance().publish.callCount).to.equal(0);
        helper.assertError(err, 'user can only perform operation for self authored activities', done);
      });
    });

    it('[deleteActivity], should be successful', function (done) {
      co(function* () {
        yield activityService.deleteActivity({ userId: data.users[0].id }, data.activities[0].id);
      }).then(() => {
        expect(service.getInstance().publish.callCount).to.equal(1);
        done();
      }).catch(done);
    });


    it('[updateActivity], should throw error for non existent activity', function (done) {
      co(function* () {
        yield activityService.updateActivity({ userId: data.users[0].id }, uuid.v4(), {
          title: 'updated title',
        });
      }).then(() => {
        done(new Error('should not have been called'));
      }).catch((err) => {
        expect(service.getInstance().publish.callCount).to.equal(0);
        helper.assertError(err, 'activity not found with specified id', done);
      });
    });

    it('[updateActivity], should throw error for illegal access', function (done) {
      co(function* () {
        yield activityService.updateActivity({ userId: data.users[1].id }, data.activities[0].id, {
          title: 'updated title',
        });
      }).then(() => {
        done(new Error('should not have been called'));
      }).catch((err) => {
        expect(service.getInstance().publish.callCount).to.equal(0);
        helper.assertError(err, 'user can only perform operation for self authored activities', done);
      });
    });

    it('[updateActivity], should be successful', function (done) {
      co(function* () {
        return yield activityService.updateActivity({ userId: data.users[0].id }, data.activities[0].id, {
          title: 'updated title',
        });
      }).then((response) => {
        expect(response).to.exist();
        expect(response.title).to.equal('updated title');
        expect(service.getInstance().publish.callCount).to.equal(0);
        helper.validateModel('#/definitions/ActivityDetail', response, done);
      }).catch(done);
    });

    it('[updateActivity], should be successful', function (done) {
      co(function* () {
        return yield activityService.updateActivity({ userId: data.users[0].id }, data.activities[0].id, {
          title: 'updated title',
          location: null,
          start: null,
        });
      }).then((response) => {
        expect(response).to.exist();
        expect(response.title).to.equal('updated title');
        expect(response.location).to.not.exist();
        expect(response.start).to.not.exist();
        expect(service.getInstance().publish.callCount).to.equal(0);
        helper.validateModel('#/definitions/ActivityDetail', response, done);
      }).catch(done);
    });

    it('[updateActivity], should be successful', function (done) {
      co(function* () {
        return yield activityService.updateActivity({ userId: data.users[0].id }, data.activities[0].id, {
          start: 2222222222222,
          duration: 10000,
          meetingPoint: 'Manhattan',
        });
      }).then((response) => {
        expect(response).to.exist();
        expect(response.title).to.equal(data.activities[0].title);
        expect(response.start).to.equal(2222222222222);
        expect(response.duration).to.equal(10000);
        expect(response.meetingPoint).to.equal('Manhattan');
        expect(service.getInstance().publish.callCount).to.equal(0);
        helper.validateModel('#/definitions/ActivityDetail', response, done);
      }).catch(done);
    });

    it('[addInvitees], should throw error for non existent activity', function (done) {
      co(function* () {
        yield activityService.addInvitees({ userId: data.users[0].id }, uuid.v4(), {
          additions: { users: ['7b897879-2732-4900-a390-119b45588586'] },
        });
      }).then(() => {
        done(new Error('should not have been called'));
      }).catch((err) => {
        expect(service.getInstance().publish.callCount).to.equal(0);
        helper.assertError(err, 'activity not found with specified id', done);
      });
    });

    it('[addInvitees], should throw error for illegal access', function (done) {
      co(function* () {
        yield activityService.addInvitees({ userId: data.users[1].id }, data.activities[0].id, {
          additions: { users: ['7b897879-2732-4900-a390-119b45588586'] },
        });
      }).then(() => {
        done(new Error('should not have been called'));
      }).catch((err) => {
        expect(service.getInstance().publish.callCount).to.equal(0);
        helper.assertError(err, 'user can only perform operation for self authored activities', done);
      });
    });

    it('[addInvitees], should be successful', function (done) {
      co(function* () {
        yield activityService.addInvitees({ userId: data.users[0].id }, data.activities[1].id, {
          additions: { users: ['7b897879-2732-4900-a390-119b45588586'] },
        });
        return yield datasource.filter(TABLE_NAMES.ActivityInvitee, { activityId: data.activities[1].id });
      }).then((response) => {
        expect(response).to.exist();
        expect(response.length).to.equal(1);
        expect(service.getInstance().publish.callCount).to.equal(0);
        done();
      }).catch(done);
    });

    it('[addInvitees], should be successful', function (done) {
      co(function* () {
        yield activityService.addInvitees({ userId: data.users[0].id }, data.activities[0].id, {
          additions: { users: ['73404c19-57fb-46fc-873b-e0b228bff1a3'] },
        });
        return yield datasource.filter(TABLE_NAMES.ActivityInvitee, { activityId: data.activities[0].id });
      }).then((response) => {
        expect(response).to.exist();
        expect(response.length).to.equal(4);
        expect(service.getInstance().publish.callCount).to.equal(0);
        done();
      }).catch(done);
    });

    it('[getInvitees], should throw error for non existent activity', function (done) {
      co(function* () {
        yield activityService.getInvitees({ userId: data.users[0].id }, uuid.v4(), { limit: 10 });
      }).then(() => {
        done(new Error('should not have been called'));
      }).catch((err) => {
        expect(service.getInstance().publish.callCount).to.equal(0);
        helper.assertError(err, 'activity not found with specified id', done);
      });
    });

    it('[getInvitees], should throw error for illegal access', function (done) {
      co(function* () {
        yield activityService.getInvitees({ userId: data.users[1].id }, data.activities[0].id, { limit: 10 });
      }).then(() => {
        done(new Error('should not have been called'));
      }).catch((err) => {
        expect(service.getInstance().publish.callCount).to.equal(0);
        helper.assertError(err, 'user can only perform operation for self authored activities', done);
      });
    });

    it('[getInvitees], should be successful', function (done) {
      co(function* () {
        return yield activityService.getInvitees({ userId: data.users[0].id }, data.activities[0].id, { limit: 10 });
      }).then((response) => {
        expect(response).to.exist();
        expect(response.data).to.exist();
        expect(response.data.users).to.exist();
        expect(response.data.users.length).to.equal(2);
        expect(response.data.contacts).to.exist();
        expect(response.data.contacts.length).to.equal(1);
        expect(service.getInstance().publish.callCount).to.equal(0);
        helper.validateModel('#/definitions/GetInviteesRes', response.data, done);
      }).catch(done);
    });

    it('[getInvitees], should be successful', function (done) {
      co(function* () {
        return yield activityService.getInvitees({ userId: data.users[0].id }, data.activities[0].id, { limit: 1 });
      }).then((response) => {
        expect(response).to.exist();
        expect(service.getInstance().publish.callCount).to.equal(0);
        helper.validateModel('#/definitions/GetInviteesRes', response, done);
      }).catch(done);
    });

    it('[getInvitees], should be successful', function (done) {
      co(function* () {
        return yield activityService.getInvitees({ userId: data.users[0].id }, data.activities[0].id, { limit: 0 });
      }).then((response) => {
        expect(response).to.exist();
        expect(service.getInstance().publish.callCount).to.equal(0);
        helper.validateModel('#/definitions/GetInviteesRes', response, done);
      }).catch(done);
    });

    it('[addPhotos], should throw error for non existent activity', function (done) {
      co(function* () {
        yield activityService.addPhotos({ userId: data.users[0].id }, uuid.v4(), [{
          filename: 'image.png',
          path: 'https://s3.amazonaws.com/lets-user-media/public-activity.png',
        }]);
      }).then(() => {
        done(new Error('should not have been called'));
      }).catch((err) => {
        expect(service.getInstance().publish.callCount).to.equal(0);
        helper.assertError(err, 'activity not found with specified id', done);
      });
    });

    it('[addPhotos], should throw error for illegal access', function (done) {
      co(function* () {
        yield activityService.addPhotos({ userId: data.users[1].id }, data.activities[0].id, [{
          filename: 'image.png',
          path: 'https://s3.amazonaws.com/lets-user-media/public-activity.png',
        }]);
      }).then(() => {
        done(new Error('should not have been called'));
      }).catch((err) => {
        expect(service.getInstance().publish.callCount).to.equal(0);
        helper.assertError(err, 'user can only perform operation for self authored activities', done);
      });
    });

    it('[getPhotos], should throw error for non existent activity', function (done) {
      co(function* () {
        yield activityService.getPhotos({ userId: data.users[0].id }, uuid.v4());
      }).then(() => {
        done(new Error('should not have been called'));
      }).catch((error) => {
        expect(service.getInstance().publish.callCount).to.equal(0);
        helper.assertError(error, 'activity not found with specified id', done);
      });
    });

    it('[getPhotos], should be successful', function (done) {
      co(function* () {
        return yield activityService.getPhotos({ userId: data.users[0].id }, data.activities[0].id);
      }).then((response) => {
        expect(response).to.exist();
        expect(response.data).to.exist();
        expect(response.data.length).to.equal(1);
        expect(service.getInstance().publish.callCount).to.equal(0);
        helper.validateModel('#/definitions/GetPhotosRes', response.data, done);
      }).catch(done);
    });

    it('[addRsvp], should throw error for non existent activity', function (done) {
      co(function* () {
        yield activityService.addRsvp({ userId: data.users[0].id }, uuid.v4());
      }).then(() => {
        done(new Error('should not have been called'));
      }).catch((err) => {
        expect(service.getInstance().publish.callCount).to.equal(0);
        helper.assertError(err, 'activity not found with specified id', done);
      });
    });

    it('[addRsvp], should throw error for illegal access for private activity', function (done) {
      co(function* () {
        yield activityService.addRsvp({ userId: data.users[3].id }, data.activities[0].id);
      }).then(() => {
        done(new Error('should not have been called'));
      }).catch((err) => {
        expect(service.getInstance().publish.callCount).to.equal(0);
        helper.assertError(err, 'user is not an invitee', done);
      });
    });

    it('[addRsvp], should throw error for illegal access for shared activity', function (done) {
      co(function* () {
        yield activityService.addRsvp({ userId: data.users[3].id }, data.activities[1].id);
      }).then(() => {
        done(new Error('should not have been called'));
      }).catch((err) => {
        expect(service.getInstance().publish.callCount).to.equal(0);
        helper.assertError(err, 'user is not follower of activity author', done);
      });
    });

    it('[addRsvp], should be successful for private activity', function (done) {
      co(function* () {
        yield activityService.addRsvp({ userId: data.users[1].id }, data.activities[0].id);
        return yield datasource.filter(TABLE_NAMES.ActivityRsvp, { activityId: data.activities[0].id });
      }).then((response) => {
        expect(response).to.exist();
        expect(response.length).to.equal(2);
        expect(service.getInstance().publish.callCount).to.equal(1);
        done();
      }).catch(done);
    });

    it('[addRsvp], should be successful for private activity', function (done) {
      co(function* () {
        yield activityService.addRsvp({ userId: data.users[2].id }, data.activities[0].id);
        return yield datasource.filter(TABLE_NAMES.ActivityRsvp, { activityId: data.activities[0].id });
      }).then((response) => {
        expect(response).to.exist();
        expect(response.length).to.equal(2);
        expect(service.getInstance().publish.callCount).to.equal(1);
        done();
      }).catch(done);
    });

    it('[addRsvp], should be successful for shared activity', function (done) {
      co(function* () {
        yield activityService.addRsvp({ userId: data.users[1].id }, data.activities[1].id);
        return yield datasource.filter(TABLE_NAMES.ActivityRsvp, { activityId: data.activities[1].id });
      }).then((response) => {
        expect(response).to.exist();
        expect(response.length).to.equal(2);
        expect(service.getInstance().publish.callCount).to.equal(1);
        done();
      }).catch(done);
    });

    it('[addRsvp], should be successful for public activity', function (done) {
      co(function* () {
        yield activityService.addRsvp({ userId: data.users[3].id }, data.activities[2].id);
        return yield datasource.filter(TABLE_NAMES.ActivityRsvp, { activityId: data.activities[2].id });
      }).then((response) => {
        expect(response).to.exist();
        expect(response.length).to.equal(2);
        expect(service.getInstance().publish.callCount).to.equal(1);
        done();
      }).catch(done);
    });

    it('[removeRsvp], should throw error for non existent activity', function (done) {
      co(function* () {
        yield activityService.removeRsvp({ userId: data.users[0].id }, uuid.v4());
      }).then(() => {
        done(new Error('should not have been called'));
      }).catch((err) => {
        expect(service.getInstance().publish.callCount).to.equal(0);
        helper.assertError(err, 'activity not found with specified id', done);
      });
    });

    it('[removeRsvp], should throw error for illegal access for private activity', function (done) {
      co(function* () {
        yield activityService.removeRsvp({ userId: data.users[3].id }, data.activities[0].id);
      }).then(() => {
        done(new Error('should not have been called'));
      }).catch((err) => {
        expect(service.getInstance().publish.callCount).to.equal(0);
        helper.assertError(err, 'user is not an invitee', done);
      });
    });

    it('[removeRsvp], should throw error for illegal access for shared activity', function (done) {
      co(function* () {
        yield activityService.removeRsvp({ userId: data.users[3].id }, data.activities[1].id);
      }).then(() => {
        done(new Error('should not have been called'));
      }).catch((err) => {
        expect(service.getInstance().publish.callCount).to.equal(0);
        helper.assertError(err, 'user is not follower of activity author', done);
      });
    });

    it('[removeRsvp], should throw error for removing author for public activity', function (done) {
      co(function* () {
        yield activityService.removeRsvp({ userId: data.users[0].id }, data.activities[2].id);
      }).then(() => {
        done(new Error('should not have been called'));
      }).catch((err) => {
        expect(service.getInstance().publish.callCount).to.equal(0);
        helper.assertError(err, 'cannot remove author from rsvp list', done);
      });
    });

    it('[removeRsvp], should throw error for removing author for shared activity', function (done) {
      co(function* () {
        yield activityService.removeRsvp({ userId: data.users[0].id }, data.activities[1].id);
      }).then(() => {
        done(new Error('should not have been called'));
      }).catch((err) => {
        expect(service.getInstance().publish.callCount).to.equal(0);
        helper.assertError(err, 'cannot remove author from rsvp list', done);
      });
    });

    it('[removeRsvp], should throw error for removing author for private activity', function (done) {
      co(function* () {
        yield activityService.removeRsvp({ userId: data.users[0].id }, data.activities[0].id);
      }).then(() => {
        done(new Error('should not have been called'));
      }).catch((err) => {
        expect(service.getInstance().publish.callCount).to.equal(0);
        helper.assertError(err, 'cannot remove author from rsvp list', done);
      });
    });

    it('[removeRsvp], should be successful for private activity', function (done) {
      co(function* () {
        yield activityService.addRsvp({ userId: data.users[1].id }, data.activities[0].id);
        yield activityService.removeRsvp({ userId: data.users[1].id }, data.activities[0].id);
        return yield datasource.filter(TABLE_NAMES.ActivityRsvp, { activityId: data.activities[0].id });
      }).then((response) => {
        expect(response).to.exist();
        expect(response.length).to.equal(1);
        expect(service.getInstance().publish.callCount).to.equal(2);
        done();
      }).catch(done);
    });

    it('[removeRsvp], should be successful for private activity', function (done) {
      co(function* () {
        yield activityService.addRsvp({ userId: data.users[2].id }, data.activities[0].id);
        yield activityService.removeRsvp({ userId: data.users[2].id }, data.activities[0].id);
        return yield datasource.filter(TABLE_NAMES.ActivityRsvp, { activityId: data.activities[0].id });
      }).then((response) => {
        expect(response).to.exist();
        expect(response.length).to.equal(1);
        expect(service.getInstance().publish.callCount).to.equal(2);
        done();
      }).catch(done);
    });

    it('[removeRsvp], should be successful for shared activity', function (done) {
      co(function* () {
        yield activityService.addRsvp({ userId: data.users[1].id }, data.activities[1].id);
        yield activityService.removeRsvp({ userId: data.users[1].id }, data.activities[1].id);
        return yield datasource.filter(TABLE_NAMES.ActivityRsvp, { activityId: data.activities[1].id });
      }).then((response) => {
        expect(response).to.exist();
        expect(response.length).to.equal(1);
        expect(service.getInstance().publish.callCount).to.equal(2);
        done();
      }).catch(done);
    });

    it('[removeRsvp], should be successful for public activity', function (done) {
      co(function* () {
        yield activityService.addRsvp({ userId: data.users[1].id }, data.activities[2].id);
        yield activityService.removeRsvp({ userId: data.users[1].id }, data.activities[2].id);
        return yield datasource.filter(TABLE_NAMES.ActivityRsvp, { activityId: data.activities[2].id });
      }).then((response) => {
        expect(response).to.exist();
        expect(response.length).to.equal(1);
        expect(service.getInstance().publish.callCount).to.equal(2);
        done();
      }).catch(done);
    });

    it('[removeRsvp], should be successful for public activity', function (done) {
      co(function* () {
        yield activityService.addRsvp({ userId: data.users[3].id }, data.activities[2].id);
        yield activityService.removeRsvp({ userId: data.users[3].id }, data.activities[2].id);
        return yield datasource.filter(TABLE_NAMES.ActivityRsvp, { activityId: data.activities[2].id });
      }).then((response) => {
        expect(response).to.exist();
        expect(response.length).to.equal(1);
        expect(service.getInstance().publish.callCount).to.equal(2);
        done();
      }).catch(done);
    });

    it('[shareActivity], should throw error for non existent activity', function (done) {
      co(function* () {
        yield activityService.shareActivity({ userId: data.users[0].id }, uuid.v4(), { privacy: 'private' });
      }).then(() => {
        done(new Error('should not have been called'));
      }).catch((err) => {
        expect(service.getInstance().publish.callCount).to.equal(0);
        helper.assertError(err, 'activity not found with specified id', done);
      });
    });

    it('[shareActivity], should throw error for illegal access for private activity', function (done) {
      co(function* () {
        yield activityService.shareActivity({ userId: data.users[3].id }, data.activities[0].id, {
          privacy: 'private',
        });
      }).then(() => {
        done(new Error('should not have been called'));
      }).catch((err) => {
        expect(service.getInstance().publish.callCount).to.equal(0);
        helper.assertError(err, 'user is not an invitee', done);
      });
    });

    it('[shareActivity], should throw error for illegal access for shared activity', function (done) {
      co(function* () {
        yield activityService.shareActivity({ userId: data.users[3].id }, data.activities[1].id, {
          privacy: 'private',
        });
      }).then(() => {
        done(new Error('should not have been called'));
      }).catch((err) => {
        expect(service.getInstance().publish.callCount).to.equal(0);
        helper.assertError(err, 'user is not follower of activity author', done);
      });
    });

    it('[shareActivity], should be successful for private activity', function (done) {
      co(function* () {
        return yield activityService.shareActivity({ userId: data.users[1].id }, data.activities[0].id, {
          privacy: 'private',
        });
      }).then((response) => {
        expect(response).to.exist();
        expect(response.parent.id).to.equal(data.activities[0].id);
        expect(response.author).to.exist();
        expect(response.author.id).to.equal(data.users[1].id);
        expect(service.getInstance().publish.callCount).to.equal(1);
        helper.validateModel('#/definitions/ActivityDetail', response, done);
      }).catch(done);
    });

    it('[shareActivity], should be successful for private activity', function (done) {
      co(function* () {
        return yield activityService.shareActivity({ userId: data.users[2].id }, data.activities[0].id, {
          title: 'new shared activity',
          start: 2222222222222,
          duration: 1000,
          meetingPoint: 'Manhattan',
          privacy: 'private',
        });
      }).then((response) => {
        expect(response).to.exist();
        expect(response.parent.id).to.equal(data.activities[0].id);
        expect(response.author).to.exist();
        expect(response.author.id).to.equal(data.users[2].id);
        expect(response.title).to.equal('new shared activity');
        expect(response.start).to.equal(2222222222222);
        expect(response.duration).to.equal(1000);
        expect(response.meetingPoint).to.equal('Manhattan');
        expect(service.getInstance().publish.callCount).to.equal(1);
        helper.validateModel('#/definitions/ActivityDetail', response, done);
      }).catch(done);
    });

    it('[shareActivity], should be successful for private activity', function (done) {
      co(function* () {
        return yield activityService.shareActivity({ userId: data.users[1].id }, data.activities[0].id, {
          title: 'new shared activity',
          start: 2222222222222,
          meetingPoint: 'Manhattan',
          privacy: 'private',
        });
      }).then((response) => {
        expect(response).to.exist();
        expect(response.parent.id).to.equal(data.activities[0].id);
        expect(response.author).to.exist();
        expect(response.author.id).to.equal(data.users[1].id);
        expect(response.title).to.equal('new shared activity');
        expect(response.start).to.equal(2222222222222);
        expect(response.meetingPoint).to.equal('Manhattan');
        expect(response.duration).to.equal(1);
        expect(service.getInstance().publish.callCount).to.equal(1);
        helper.validateModel('#/definitions/ActivityDetail', response, done);
      }).catch(done);
    });

    it('[shareActivity], should be successful for shared activity', function (done) {
      co(function* () {
        return yield activityService.shareActivity({ userId: data.users[1].id }, data.activities[1].id, {
          privacy: 'private',
        });
      }).then((response) => {
        expect(response).to.exist();
        expect(response.parent.id).to.equal(data.activities[1].id);
        expect(response.author).to.exist();
        expect(response.author.id).to.equal(data.users[1].id);
        expect(service.getInstance().publish.callCount).to.equal(1);
        helper.validateModel('#/definitions/ActivityDetail', response, done);
      }).catch(done);
    });

    it('[shareActivity], should be successful for public activity', function (done) {
      co(function* () {
        return yield activityService.shareActivity({ userId: data.users[0].id }, data.activities[2].id, {
          privacy: 'private',
        });
      }).then((response) => {
        expect(response).to.exist();
        expect(response.parent.id).to.equal(data.activities[2].id);
        expect(response.author).to.exist();
        expect(response.author.id).to.equal(data.users[0].id);
        expect(service.getInstance().publish.callCount).to.equal(1);
        helper.validateModel('#/definitions/ActivityDetail', response, done);
      }).catch(done);
    });

    it('[shareActivity], should be successful for public activity', function (done) {
      co(function* () {
        return yield activityService.shareActivity({ userId: data.users[2].id }, data.activities[2].id, {
          privacy: 'private',
        });
      }).then((response) => {
        expect(response).to.exist();
        expect(response.parent.id).to.equal(data.activities[2].id);
        expect(response.author).to.exist();
        expect(response.author.id).to.equal(data.users[2].id);
        expect(service.getInstance().publish.callCount).to.equal(1);
        helper.validateModel('#/definitions/ActivityDetail', response, done);
      }).catch(done);
    });

    it('[likeActivity], should throw error for non existent activity', function (done) {
      co(function* () {
        yield activityService.likeActivity({ userId: data.users[0].id }, uuid.v4());
      }).then(() => {
        done(new Error('should not have been called'));
      }).catch((err) => {
        expect(service.getInstance().publish.callCount).to.equal(0);
        helper.assertError(err, 'activity not found with specified id', done);
      });
    });

    it('[likeActivity], should throw error for illegal access for private activity', function (done) {
      co(function* () {
        yield activityService.likeActivity({ userId: data.users[3].id }, data.activities[0].id);
      }).then(() => {
        done(new Error('should not have been called'));
      }).catch((err) => {
        expect(service.getInstance().publish.callCount).to.equal(0);
        helper.assertError(err, 'user is not an invitee', done);
      });
    });

    it('[likeActivity], should throw error for illegal access for shared activity', function (done) {
      co(function* () {
        yield activityService.likeActivity({ userId: data.users[3].id }, data.activities[1].id);
      }).then(() => {
        done(new Error('should not have been called'));
      }).catch((err) => {
        expect(service.getInstance().publish.callCount).to.equal(0);
        helper.assertError(err, 'user is not follower of activity author', done);
      });
    });

    it('[likeActivity], should be successful for private activity for owner', function (done) {
      co(function* () {
        yield activityService.likeActivity({ userId: data.users[0].id }, data.activities[0].id);
        return yield datasource.filter(TABLE_NAMES.ActivityLike, { activityId: data.activities[0].id });
      }).then((response) => {
        expect(response).to.exist();
        expect(response.length).to.equal(1);
        expect(service.getInstance().publish.callCount).to.equal(0);
        done();
      }).catch(done);
    });

    it('[likeActivity], should be successful for private activity', function (done) {
      co(function* () {
        yield activityService.likeActivity({ userId: data.users[1].id }, data.activities[0].id);
        return yield datasource.filter(TABLE_NAMES.ActivityLike, { activityId: data.activities[0].id });
      }).then((response) => {
        expect(response).to.exist();
        expect(response.length).to.equal(2);
        expect(service.getInstance().publish.callCount).to.equal(0);
        done();
      }).catch(done);
    });

    it('[likeActivity], should be successful for private activity', function (done) {
      co(function* () {
        yield activityService.likeActivity({ userId: data.users[2].id }, data.activities[0].id);
        return yield datasource.filter(TABLE_NAMES.ActivityLike, { activityId: data.activities[0].id });
      }).then((response) => {
        expect(response).to.exist();
        expect(response.length).to.equal(2);
        expect(service.getInstance().publish.callCount).to.equal(0);
        done();
      }).catch(done);
    });

    it('[likeActivity], should be successful for shared activity for owner', function (done) {
      co(function* () {
        yield activityService.likeActivity({ userId: data.users[0].id }, data.activities[1].id);
        return yield datasource.filter(TABLE_NAMES.ActivityLike, { activityId: data.activities[1].id });
      }).then((response) => {
        expect(response).to.exist();
        expect(response.length).to.equal(1);
        expect(service.getInstance().publish.callCount).to.equal(0);
        done();
      }).catch(done);
    });

    it('[likeActivity], should be successful for shared activity', function (done) {
      co(function* () {
        yield activityService.likeActivity({ userId: data.users[1].id }, data.activities[1].id);
        return yield datasource.filter(TABLE_NAMES.ActivityLike, { activityId: data.activities[1].id });
      }).then((response) => {
        expect(response).to.exist();
        expect(response.length).to.equal(2);
        expect(service.getInstance().publish.callCount).to.equal(0);
        done();
      }).catch(done);
    });

    it('[likeActivity], should be successful for public activity for owner', function (done) {
      co(function* () {
        yield activityService.likeActivity({ userId: data.users[0].id }, data.activities[2].id);
        return yield datasource.filter(TABLE_NAMES.ActivityLike, { activityId: data.activities[2].id });
      }).then((response) => {
        expect(response).to.exist();
        expect(response.length).to.equal(1);
        expect(service.getInstance().publish.callCount).to.equal(0);
        done();
      }).catch(done);
    });

    it('[likeActivity], should be successful for public activity', function (done) {
      co(function* () {
        yield activityService.likeActivity({ userId: data.users[3].id }, data.activities[2].id);
        return yield datasource.filter(TABLE_NAMES.ActivityLike, { activityId: data.activities[2].id });
      }).then((response) => {
        expect(response).to.exist();
        expect(response.length).to.equal(2);
        expect(service.getInstance().publish.callCount).to.equal(0);
        done();
      }).catch(done);
    });

    it('[dislikeActivity], should throw error for non existent activity', function (done) {
      co(function* () {
        yield activityService.dislikeActivity({ userId: data.users[0].id }, uuid.v4());
      }).then(() => {
        done(new Error('should not have been called'));
      }).catch((err) => {
        expect(service.getInstance().publish.callCount).to.equal(0);
        helper.assertError(err, 'activity not found with specified id', done);
      });
    });

    it('[dislikeActivity], should throw error for illegal access for private activity', function (done) {
      co(function* () {
        yield activityService.dislikeActivity({ userId: data.users[3].id }, data.activities[0].id);
      }).then(() => {
        done(new Error('should not have been called'));
      }).catch((err) => {
        expect(service.getInstance().publish.callCount).to.equal(0);
        helper.assertError(err, 'user is not an invitee', done);
      });
    });

    it('[dislikeActivity], should throw error for illegal access for shared activity', function (done) {
      co(function* () {
        yield activityService.dislikeActivity({ userId: data.users[3].id }, data.activities[1].id);
      }).then(() => {
        done(new Error('should not have been called'));
      }).catch((err) => {
        expect(service.getInstance().publish.callCount).to.equal(0);
        helper.assertError(err, 'user is not follower of activity author', done);
      });
    });

    it('[dislikeActivity], should be successful for private activity', function (done) {
      co(function* () {
        yield activityService.likeActivity({ userId: data.users[1].id }, data.activities[0].id);
        yield activityService.dislikeActivity({ userId: data.users[1].id }, data.activities[0].id);
        return yield datasource.filter(TABLE_NAMES.ActivityLike, { activityId: data.activities[0].id });
      }).then((response) => {
        expect(response).to.exist();
        expect(response.length).to.equal(1);
        expect(service.getInstance().publish.callCount).to.equal(0);
        done();
      }).catch(done);
    });

    it('[dislikeActivity], should be successful for private activity for owner', function (done) {
      co(function* () {
        yield activityService.likeActivity({ userId: data.users[0].id }, data.activities[0].id);
        yield activityService.dislikeActivity({ userId: data.users[0].id }, data.activities[0].id);
        return yield datasource.filter(TABLE_NAMES.ActivityLike, { activityId: data.activities[0].id });
      }).then((response) => {
        expect(response).to.exist();
        expect(response.length).to.equal(0);
        expect(service.getInstance().publish.callCount).to.equal(0);
        done();
      }).catch(done);
    });

    it('[dislikeActivity], should be successful for private activity', function (done) {
      co(function* () {
        yield activityService.likeActivity({ userId: data.users[2].id }, data.activities[0].id);
        yield activityService.dislikeActivity({ userId: data.users[2].id }, data.activities[0].id);
        return yield datasource.filter(TABLE_NAMES.ActivityLike, { activityId: data.activities[0].id });
      }).then((response) => {
        expect(response).to.exist();
        expect(response.length).to.equal(1);
        expect(service.getInstance().publish.callCount).to.equal(0);
        done();
      }).catch(done);
    });

    it('[dislikeActivity], should be successful for shared activity for owner', function (done) {
      co(function* () {
        yield activityService.likeActivity({ userId: data.users[0].id }, data.activities[1].id);
        yield activityService.dislikeActivity({ userId: data.users[0].id }, data.activities[1].id);
        return yield datasource.filter(TABLE_NAMES.ActivityLike, { activityId: data.activities[1].id });
      }).then((response) => {
        expect(response).to.exist();
        expect(response.length).to.equal(0);
        expect(service.getInstance().publish.callCount).to.equal(0);
        done();
      }).catch(done);
    });

    it('[dislikeActivity], should be successful for shared activity', function (done) {
      co(function* () {
        yield activityService.likeActivity({ userId: data.users[1].id }, data.activities[1].id);
        yield activityService.dislikeActivity({ userId: data.users[1].id }, data.activities[1].id);
        return yield datasource.filter(TABLE_NAMES.ActivityLike, { activityId: data.activities[1].id });
      }).then((response) => {
        expect(response).to.exist();
        expect(response.length).to.equal(1);
        expect(service.getInstance().publish.callCount).to.equal(0);
        done();
      }).catch(done);
    });

    it('[dislikeActivity], should be successful for public activity for owner', function (done) {
      co(function* () {
        yield activityService.likeActivity({ userId: data.users[0].id }, data.activities[2].id);
        yield activityService.dislikeActivity({ userId: data.users[0].id }, data.activities[2].id);
        return yield datasource.filter(TABLE_NAMES.ActivityLike, { activityId: data.activities[2].id });
      }).then((response) => {
        expect(response).to.exist();
        expect(response.length).to.equal(0);
        expect(service.getInstance().publish.callCount).to.equal(0);
        done();
      }).catch(done);
    });

    it('[dislikeActivity], should be successful for public activity', function (done) {
      co(function* () {
        yield activityService.likeActivity({ userId: data.users[3].id }, data.activities[2].id);
        yield activityService.dislikeActivity({ userId: data.users[3].id }, data.activities[2].id);
        return yield datasource.filter(TABLE_NAMES.ActivityLike, { activityId: data.activities[2].id });
      }).then((response) => {
        expect(response).to.exist();
        expect(response.length).to.equal(1);
        expect(service.getInstance().publish.callCount).to.equal(0);
        done();
      }).catch(done);
    });

  });
});
