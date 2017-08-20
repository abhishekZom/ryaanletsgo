/*
 * Copyright (C) 2017 lets., All Rights Reserved.
 */

'use strict';

/**
 * Exposes groups API's
 *
 * @author      TSCCODER
 * @version     1.0.0
 */

const httpStatus = require('http-status');
const groupService = require('../services/GroupService');

/**
 * Create a group
 * Create a group, optionally specify initial list of group members
 *
 * @param   {Object}    req           express request instance
 * @param   {Object}    res           express response instance
 * @return  {Void}                    this method doesn't return anything
 */
function* createGroup(req, res) {
  res.status(httpStatus.CREATED).json(yield groupService.createGroup(req.auth, req.body));
}

/**
 * Get a group details
 * Get a group details, the response payload will have resolved references to group members
 *
 * @param   {Object}    req           express request instance
 * @param   {Object}    res           express response instance
 * @return  {Void}                    this method doesn't return anything
 */
function* getGroupDetail(req, res) {
  res.status(httpStatus.OK).json(yield groupService.getGroupDetail(req.auth, req.params.groupId));
}

/**
 * Edit a group details
 * Edit a group details, can optionally specify group members to add/remove
 *
 * @param   {Object}    req           express request instance
 * @param   {Object}    res           express response instance
 * @return  {Void}                    this method doesn't return anything
 */
function* editGroup(req, res) {
  res.status(httpStatus.OK).json(yield groupService.editGroup(req.auth, req.params.groupId, req.body));
}

/**
 * Delete a group
 * Delete a group, and all of it's members
 *
 * @param   {Object}    req           express request instance
 * @param   {Object}    res           express response instance
 * @return  {Void}                    this method doesn't return anything
 */
function* deleteGroup(req, res) {
  res.status(httpStatus.OK).json(yield groupService.deleteGroup(req.auth, req.params.groupId));
}

module.exports = {
  createGroup,
  getGroupDetail,
  editGroup,
  deleteGroup,
};
