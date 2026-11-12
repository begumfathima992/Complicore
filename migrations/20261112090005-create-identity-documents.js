'use strict';
const { IdentityDocument } = require('../src/models');
const { createTableFromModel } = require('./_helpers/fromModel');

module.exports = createTableFromModel(IdentityDocument);
