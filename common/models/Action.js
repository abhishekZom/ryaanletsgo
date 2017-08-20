/*
 * Copyright (C) 2017 lets., All Rights Reserved.
 */

'use strict';

/**
 * Action resource.
 * From http://activitystrea.ms/specs/atom/1.0
 * An activity consists of an actor, a verb, and an object.
 * It tells the story of a person performing an action on or with an object -- "Geraldine posted a photo"
 * or "John shared a video"
 *
 * Action represents these activities in the app.
 * Naming: It is named as `Action` becase `Activity` term is used differently in the app.
 *
 * @author      TSCCODER
 * @version     1.0.0
 */
const _ = require('lodash');
const USER_ACTIONS_VERBS = require('../constants').USER_ACTIONS_VERBS;

/**
 * Default module export function
 * @param  {Object}       thinky            the instantiated thinky ORM instance
 * @return {Objetc}                         the Action model
 */
module.exports = function schemaFn(thinky) {
  const type = thinky.type;
  const Action = thinky.createModel('actions', {
    // primary key, the primary key is set by the database so it is not required,
    // but when retrieving document thinky will match the returned
    // fields with schema and discard any extra fields
    id: type.string().uuid(4),
    /**
     * An Object Construct that identifies the entity that performed the action.
     * An Action construct MUST have exactly one actor.
     *
     * For the app the actor will always be the logged in user
     * @type {String}
     */
    actor: type.string().uuid(4).required(),
    /**
     * An String that identifies the action.
     * An Action construct MUST have exactly one verb.
     * @type {String}
     */
    verb: type.string().enum(_.values(USER_ACTIONS_VERBS)).required(),
    /**
     * This Object Construct identifies the primary object of the action.
     * An Action construct MUST have exactly one object.
     *
     * Following object references are possible in the app
     * 1: verb: post
     * The object will refer to the actual activity that is posted
     * 2. verb: share
     * The object will refer to the activity that is created as an action to sharing an activity.
     * The new activity that is created has a parent reference to original activity.
     * 3. verb: join
     * The object will refer to activity that is joined
     * 4. verb: photo-comment
     * The object will refer to the comment id.
     * @type {String}
     */
    object: type.string().uuid(4).required(),
    /**
     * The target of an action is an Object Construct that represents the object to which the action was performed.
     * The exact meaning of an action's target is dependent on the verb of the action,
     * but will often be the object of the English preposition "to".
     * For example, in the action "John saved a movie to his wishlist",
     * the target of the action is "wishlist".
     * The action target MUST NOT be used to identify an indirect object that is not a target of the action.
     * An action construct MAY have a target but it MUST NOT have more than one.
     * @type {String}
     */
    target: type.string().allowNull(true),
    /**
     * An HTML representation of the natural language title for this action.
     * @type {String}
     */
    title: type.string().allowNull(true),
    // the timestamp this resource is created
    createdAt: type.number().integer().min(0).required(),
    // the timestamp this resource was last updated
    updatedAt: type.number().integer().min(0).required(),
  }, {
    enforce_extra: 'remove',
    enforce_type: 'strict',
  });
  Action.ensureIndex('createdAt');
  Action.ensureIndex('updatedAt');
  Action.ensureIndex('actor');
  Action.ensureIndex('object');
  Action.ensureIndex('actor_verb', doc => [doc('actor'), doc('verb')]);
  Action.ensureIndex('object_verb', doc => [doc('object'), doc('verb')]);
  Action.ensureIndex('actor_object_verb', doc => [doc('actor'), doc('object'), doc('verb')]);
  return Action;
};
