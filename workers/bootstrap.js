/*
 * Copyright (C) 2017 lets., All Rights Reserved.
 */

'use strict';

/**
 * Bootstrap the workers. This module should be required before any other modules.
 *
 * @author      TSCCODER
 * @version     1.0.0
 */

require('dotenv').config();
global.Promise = require('bluebird');
