'use strict';
const { ImmigrationDetail } = require('../src/models');
const { createTableFromModel } = require('./_helpers/fromModel');

module.exports = createTableFromModel(ImmigrationDetail);
