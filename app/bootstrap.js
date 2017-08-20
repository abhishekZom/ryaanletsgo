/*
 * Copyright (C) 2017 lets., All Rights Reserved.
 */

'use strict';

/**
 * Bootstrap the application. This module should be required before any other modules.
 *
 * @author      TSCCODER
 * @version     1.0.0
 */

require('dotenv').config();
global.Promise = require('bluebird');
const serviceHelper = require('./common/ServiceHelper');

// build all services
serviceHelper.buildService(require('./services/ActivityService'));
serviceHelper.buildService(require('./services/CommentService'));
serviceHelper.buildService(require('./services/FeedService'));
serviceHelper.buildService(require('./services/GroupService'));
serviceHelper.buildService(require('./services/UserService'));
