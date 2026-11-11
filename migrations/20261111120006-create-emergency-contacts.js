'use strict';
const { EmergencyContact } = require('../src/models');
const { createTableFromModel } = require('./_helpers/fromModel');

module.exports = createTableFromModel(EmergencyContact);
