'use strict';
const { RolePermissionRestriction } = require('../src/models');
const { createTableFromModel } = require('./_helpers/fromModel');

module.exports = createTableFromModel(RolePermissionRestriction);
