'use strict';
const { HolidayBalance } = require('../src/models');
const { createTableFromModel } = require('./_helpers/fromModel');

module.exports = createTableFromModel(HolidayBalance);
