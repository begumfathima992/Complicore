'use strict';
const { Alert } = require('../src/models');
const { createTableFromModel } = require('./_helpers/fromModel');

module.exports = createTableFromModel(Alert);
