/*
 * Copyright (C) 2017 lets., All Rights Reserved.
 */

'use strict';

/**
 * Helper database access module for the tests.
 * While testing we do need to directly interact with the database
 * this module exposes api's to manipulate the database records.
 *
 * @author      TSCCODER
 * @version     1.0.0
 */

const config = require('config');
const R = require('rethinkdbdash');
const _ = require('lodash');
const co = require('co');

const constants = require('./constants');
const helper = require('./helper');

const driverOptions = _.extend(config.db, { silent: true });
const r = new R(driverOptions);
const TABLE_NAMES = constants.TABLE_NAMES;


/**
 * Bulk create the records in db table
 *
 * @param   {String}        name        the name of the table
 * @param   {String}        records     the array of records to create
 * @return  {Promise}                   the promise which will be resolved after records are created.
 */
function bulkCreate(name, records) {
  return r.table(name).insert(records).run();
}

/**
 * Delete all records from the specified table
 *
 * @param   {String}        name        the name of the table
 * @return  {Promise}                   the promise which will be resolved after records are deleted.
 */
function deleteAll(name) {
  return r.table(name).delete().run();
}

/**
 * Filter all the records based on the specified criteria on specified table name
 *
 * @param   {String}        name        the name of the table
 * @param   {Object}        criteria    the filter criteria
 * @return  {Promise}                   the promise which will be resolved after records are deleted.
 */
function filter(name, criteria) {
  return r.table(name).filter(criteria).run();
}

/**
 * Get a record in specified table name by it's id
 *
 * @param   {String}        name        the name of the table
 * @param   {String}        id          the primary id of the record
 * @return  {Promise}                   the promise which will be resolved after records are deleted.
 */
function getById(name, id) {
  return r.table(name).get(id).run();
}

/**
 * Clear all the table data in the DB
 *
 * @return  {Promise}                   the promise which will be resolved after records are deleted.
 */
function clearDb() {
  return co(function* () {
    const promises = _.keys(TABLE_NAMES).map(name => deleteAll(TABLE_NAMES[name]));
    yield promises;
  });
}

/**
 * Clear all the table data in the DB
 *
 * @param   {Array}         tableNames    the table names for which to populate the data
 * @return  {Promise}                     the promise which will be resolved after records are deleted.
 */
function initDb(tableNames) {
  return co(function* () {
    const promises = tableNames.map(name => bulkCreate(name, helper.getData(name)));
    yield promises;
  });
}

/**
 * Wait for the database to be ready
 *
 * @return  {Promise}                   the promise which will be resolved after records are deleted.
 */
function waitForDBReady() {
  return Promise.delay(2000).then(() => r.db(config.db.db).wait().run());
}

module.exports = {
  bulkCreate,
  deleteAll,
  filter,
  getById,
  clearDb,
  initDb,
  waitForDBReady,
};
