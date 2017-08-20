/*
 * Copyright (C) 2017 lets., All Rights Reserved.
 */

'use strict';

/**
 * The main entry point for the application.
 *
 * @author      TSCCODER
 * @version     1.0.0
 */

require('./bootstrap.js');
const config = require('config');
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const _ = require('lodash');
const expressRequestId = require('express-request-id');

const helper = require('./common/Helper');
const errorMiddleware = require('./middlewares/ErrorMiddleware');
const responseTransform = require('./middlewares/ResponseTransform');
const logger = require('./common/Logger');

const apiRouter = express.Router();
const app = express();
const http = require('http').Server(app);

app.set('port', config.PORT);

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cors());
app.use(expressRequestId({ attributeName: config.REQUEST_ID_ATTRIBUTE }));

// load all routes
_.each(require('./routes'), (verbs, eurl) => {
  _.each(verbs, (def, verb) => {
    let actions = [
      function signatureWrappedFunction(req, res, next) {
        req.signature = `${def.controller}#{def.method}`;
        next();
      },
    ];
    const method = require(`./controllers/${def.controller}`)[def.method];
    if (!method) {
      throw new Error(`${def.method} is undefined, for controller ${def.controller}`);
    }
    if (def.middleware && def.middleware.length > 0) {
      actions = actions.concat(def.middleware);
    }
    actions.push(method);
    logger.debug(`Register ${verb} ${eurl}`);
    apiRouter[verb](eurl, helper.autoWrapExpress(actions));
  });
});

app.use(`/api/${config.API_VERSION}`, apiRouter);
app.use(errorMiddleware());
app.use(responseTransform());

http.listen(app.get('port'), () => {
  logger.info(`Express server listening on port ${app.get('port')}`);
});

module.exports = app;
