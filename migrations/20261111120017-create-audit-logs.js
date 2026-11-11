'use strict';
const { AuditLog } = require('../src/models');
const { createTableFromModel } = require('./_helpers/fromModel');

module.exports = createTableFromModel(AuditLog);
