/*
 * Copyright (C) 2017 lets., All Rights Reserved.
 */

'use strict';

/**
 * Setup the test execution environment.
 * This setup is primarily needed for unit tests.
 *
 * @author      TSCCODER
 * @version     1.0.0
 */

// Load dirty chai first to hook plugin extensions
const dirtyChai = require('dirty-chai');
const chai = require('chai');

chai.use(dirtyChai);

require('dotenv').config();
global.Promise = require('bluebird');
