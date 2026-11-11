'use strict';
const { ShiftChangeRequest } = require('../src/models');
const { createTableFromModel } = require('./_helpers/fromModel');

module.exports = createTableFromModel(ShiftChangeRequest);
