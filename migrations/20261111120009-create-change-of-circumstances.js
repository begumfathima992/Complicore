'use strict';
const { ChangeOfCircumstance } = require('../src/models');
const { createTableFromModel } = require('./_helpers/fromModel');

module.exports = createTableFromModel(ChangeOfCircumstance);
