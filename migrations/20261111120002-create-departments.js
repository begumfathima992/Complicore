'use strict';
const { Department } = require('../src/models');
const { createTableFromModel } = require('./_helpers/fromModel');

module.exports = createTableFromModel(Department);
