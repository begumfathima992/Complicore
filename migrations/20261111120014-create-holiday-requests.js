'use strict';
const { HolidayRequest } = require('../src/models');
const { createTableFromModel } = require('./_helpers/fromModel');

module.exports = createTableFromModel(HolidayRequest);
