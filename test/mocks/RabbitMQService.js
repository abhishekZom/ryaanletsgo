/*
 * Copyright (C) 2017 lets., All Rights Reserved.
 */

'use strict';

/**
 * The mock implementation of RabbitMQService.
 * The mock implementation spies the original service so that assertions can be made
 * on number of times the function is called and with what arguments.
 *
 * @author      TSCCODER
 * @version     1.0.0
 */
const sinon = require('sinon');

let instance;

const MockRabbitMQService = sinon.stub().callsFake(function () {
  if (instance) {
    return instance;
  }
  instance = {
    publish: sinon.stub().callsFake(function () {
      return { response: true };
    }),
  };
  return instance;
});

/**
 * Used internally for testing to get the mocked instance for spied assertions
 * @return  {Object}            the instance
 */
function getInstance() {
  return instance;
}

module.exports = {
  proxy: MockRabbitMQService,
  getInstance,
};
