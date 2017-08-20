/*
 * Copyright (C) 2017 lets., All Rights Reserved.
 */

'use strict';

/**
 * Feed resource.
 * From http://activitystrea.ms/specs/atom/1.0
 * An activity consists of an actor, a verb, and an object.
 * It tells the story of a person performing an action on or with an object -- "Geraldine posted a photo"
 * or "John shared a video"
 *
 * A feed is an activity stream targeted to a particular user.
 * For ex: In above case the followers of Geraldine will see his action in their timeline.
 * Feed contains list of activities.
 * NOTE: The activity term used here is different from `Activity` term in the application.
 * This activity refers to app users performing some actions in the application like commenting, sharing etc.
 * The `Activity` term used in the app is analogous to user doing some outdoor activity like playing games, watching movie etc.
 *
 * @author      TSCCODER
 * @version     1.0.0
 */

/**
 * Default module export function
 * @param  {Object}       thinky            the instantiated thinky ORM instance
 * @return {Objetc}                         the Feed model
 */
module.exports = function schemaFn(thinky) {
  const type = thinky.type;
  const Feed = thinky.createModel('feeds', {
    // primary key, the primary key is set by the database so it is not required,
    // but when retrieving document thinky will match the returned
    // fields with schema and discard any extra fields
    id: type.string().uuid(4),
    // the target user id
    userId: type.string().uuid(4).required(),
    // the referenced user action id
    referenceId: type.string().uuid(4).required(),
    // the timestamp this resource is created
    createdAt: type.number().integer().min(0).required(),
    // the timestamp this resource was last updated
    updatedAt: type.number().integer().min(0).required(),
  }, {
    enforce_extra: 'remove',
    enforce_type: 'strict',
  });
  Feed.ensureIndex('createdAt');
  Feed.ensureIndex('updatedAt');
  Feed.ensureIndex('userId');
  Feed.ensureIndex('referenceId');
  return Feed;
};
