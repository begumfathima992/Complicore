const express = require('express');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const { FEATURES } = require('../config/permissions');
const {
  listChecks,
  getCheck,
  createCheck,
  updateCheck,
  getImmigrationDetail,
  upsertImmigrationDetail,
} = require('../controllers/rightToWorkController');

const router = express.Router();

router.use(authenticate);

// Nationality, visa, right-to-work status, EU Settlement Scheme status, etc.
// - a 1:1 sub-record of Employee, gated by RIGHT_TO_WORK like the rest of
// this module (Manager: view-only, HR/Employer/Super: can edit).
router.get('/immigration-detail/:employeeId', authorize(FEATURES.RIGHT_TO_WORK, 'read'), getImmigrationDetail);
router.patch('/immigration-detail/:employeeId', authorize(FEATURES.RIGHT_TO_WORK, 'update'), upsertImmigrationDetail);

router.get('/', authorize(FEATURES.RIGHT_TO_WORK, 'read'), listChecks);
router.get('/:id', authorize(FEATURES.RIGHT_TO_WORK, 'read'), getCheck);
router.post('/', authorize(FEATURES.RIGHT_TO_WORK, 'create'), createCheck);
router.patch('/:id', authorize(FEATURES.RIGHT_TO_WORK, 'update'), updateCheck);

module.exports = router;
