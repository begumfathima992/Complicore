'use strict';
const { VisaRecord } = require('../src/models');
const { createTableFromModel } = require('./_helpers/fromModel');

module.exports = createTableFromModel(VisaRecord);
