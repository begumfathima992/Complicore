const express = require('express');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const { FEATURES } = require('../config/permissions');
const { listRoles, getRolePermissions, updateRolePermission } = require('../controllers/roleController');

const router = express.Router();

router.use(authenticate);

router.get('/', authorize(FEATURES.ROLE_MANAGEMENT, 'read'), listRoles);
router.get('/:roleKey/permissions', authorize(FEATURES.ROLE_MANAGEMENT, 'read'), getRolePermissions);
router.patch('/:roleKey/permissions', authorize(FEATURES.ROLE_MANAGEMENT, 'update'), updateRolePermission);

module.exports = router;
