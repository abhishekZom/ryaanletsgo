/*
 * Copyright (C) 2017 lets., All Rights Reserved.
 */

'use strict';

/**
 * Define project level constants
 *
 * @author      TSCCODER
 * @version     1.0.0
 */

module.exports = {
  DEVICE_TYPES: {
    ios: 'iOS',
    android: 'android',
  },
  SOCIAL_CONNECTION_TYPES: {
    google: 'google',
    facebook: 'facebook',
  },
  CALENDAR_TYPES: {
    google: 'google',
    apple: 'apple',
  },
  // default activity duration is in minutes
  DEFAULT_ACTIVITY_DURATION: 60,
  DEFAULT_APPROVE_FOLLOWERS: 0,
  DEFAULT_NOTIFICATION_PREFERENCE: 20899294117639,
  /**
   * Object represents the possible actions a user can perform
   * @type {Object}
   */
  ACTIONS: {
    /**
     * This action means that an user created an activity
     * @type {String}
     */
    post: 'post',
    /**
     * This action means that an user commented on some user created content.
     * This content can be any other comment, or activity
     * @type {String}
     */
    comment: 'comment',
    /**
     * This actions means that an user liked some user created content.
     * This content can be any other activity or comment
     * @type {String}
     */
    like: 'comment',
    /**
     * This actions means that an user shared an activitiy posted by some other user.
     * @type {String}
     */
    share: 'share',
  },
  /**
   * Object represents various activity types possible.
   * Currently system supports following activity types
   * 1. private: Only invited members have access to this activity
   * 2. shared: All the users followers have access to this activity
   * 3. public: This activity is visible to all the users on the platform
   * @type {Object}
   */
  ACTIVITY_PRIVACY: {
    private: 'private',
    shared: 'shared',
    public: 'public',
  },
  /**
   * Following types of user can exist in the system
   * app-user: These users have an account in the system
   * non-app-user: These users are external user and are not yet registered
   * @type {Object}
   */
  USER_TYPES: {
    APP_USER: 'app-user',
    NON_APP_USER: 'non-app-user',
  },
  CONTACT_TYPES: {
    phone: 'phone',
    email: 'email',
    facebook: 'facebook',
    google: 'google',
  },
  USER_ACTIONS_VERBS: {
    /**
     * Represents the action of authoring an activity
     * @type {String}
     */
    post: 'post',
    /**
     * Represents the action of deleting an activity
     * @type {String}
     */
    delete: 'delete',
    /**
     * Represents the action of sharing an activity
     * @type {String}
     */
    share: 'share',
    /**
     * Represents the action of joining (rsvp) an activity
     * @type {String}
     */
    join: 'join',
    /**
     * Represents the action of removing self from a joined activity
     * @type {String}
     */
    remove_rsvp: 'remove-rsvp',
    /**
     * Represents the action of photo commenting on an activity
     * @type {String}
     */
    photo_comment: 'photo-comment',
  },
};
