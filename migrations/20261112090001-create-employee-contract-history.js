'use strict';
const { EmployeeContractHistory } = require('../src/models');
const { createTableFromModel } = require('./_helpers/fromModel');

module.exports = createTableFromModel(EmployeeContractHistory);
