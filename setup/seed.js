/*
 * Copyright (C) 2017 lets., All Rights Reserved.
 */

'use strict';

/**
 * Seed the initial data into the database
 * While testing we do need to directly interact with the database
 * this module exposes api's to manipulate the database records.
 *
 * @author      TSCCODER
 * @version     1.0.0
 */

const config = require('config');
const _ = require('lodash');
const co = require('co');
const winston = require('winston');

const models = require('../common/models').getDatasource({
  db: config.db,
  logger: winston,
});

const thinky = models.thinky;
const r = models.r;

const data = require('./data/seed_data_v1.json');

co(function* wrap() {
  // wait for the database to be ready
  yield thinky.dbReady();
  // wait for all the tables to be ready
  const tables = _.filter(_.keys(models), key => key !== 'thinky' && key !== 'r');

  const tpromises = _.map(tables, single => models[single].ready());

  yield tpromises;

  const promises = _.keys(data).map(single => r.table(single).delete().run().then(() =>
    r.table(single).insert(data[single]).run()));
  yield promises;
}).then(() => {
  winston.info('data seed completed successfully');
  process.exit();
}).catch((error) => {
  winston.error('unexpected data seed error', error);
  process.exit(1);
});
