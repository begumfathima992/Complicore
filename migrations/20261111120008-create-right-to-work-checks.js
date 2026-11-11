'use strict';
const { RightToWorkCheck } = require('../src/models');
const { createTableFromModel } = require('./_helpers/fromModel');

module.exports = createTableFromModel(RightToWorkCheck);
