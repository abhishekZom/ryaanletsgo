/*
 * Copyright (C) 2017 lets., All Rights Reserved.
 */

'use strict';

/**
 * The start script for all the workers
 * Each of the worker is started as a separate node pm2 process
 * All of the individual workers can be managed here programatically
 * this includes notifying the admins of errors, crash etc.
 *
 * @author      TCSCODER
 * @version     1.0.0
 */

require('./bootstrap.js');
const config = require('config');
const _ = require('lodash');
const pm2 = require('pm2');
const path = require('path');
const co = require('co');

const logger = require('./common/Logger');
const helper = require('./common/Helper');

Promise.promisifyAll(pm2);

// read all the routing keys and load corresponding modules
pm2.connectAsync().then(() => {
  const cwd = process.cwd();
  _.each(_.keys(config.ROUTING_KEYS), (key) => {
    const procDetails = config.ROUTING_KEYS[key];
    pm2.startAsync({
      script: path.join(__dirname, procDetails.module, 'index.js'),
      cwd,
      name: procDetails.module,
      execMode: 'cluster',
      instances: 1,
      mergeLogs: true,
    }).then((proc) => {
      logger.info(`started pm2 worker process for ${key}, pm2 process object`, helper.stringify(proc));
    }).catch((err) => {
      logger.error(`error starting pm2 process ${key}`, helper.stringify(err));
    });
  });
}).catch((err) => {
  logger.error('pm2 connect error', helper.stringify(err));
  process.exit(1);
});

/**
 * The gracelful exit handler
 *
 * @return  {Void}                  this function doesn't return anything
 */
const gracefulExit = () => {
  logger.info('Gracefully shutting down workers');
  co(function* gracefulExitWrapped() {
    yield pm2.deleteAsync('all');
    yield pm2.disconnectAsync();
    yield pm2.killDaemonAsync();
  }).then(() => {
    logger.info('gracelful shutdown complete');
    process.exit();
  }).catch((err) => {
    logger.error('gracelful exit error', helper.stringify(err));
    process.exit(1);
  });
};

// registers SIGINT and exit events

process.on('SIGINT', gracefulExit);
