const express = require('express');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const { FEATURES } = require('../config/permissions');
const {
  listEmployees,
  getEmployee,
  createEmployee,
  updateEmployee,
  deleteEmployee,
} = require('../controllers/employeeController');
const { listVersions, createVersion } = require('../controllers/contractHistoryController');

const router = express.Router();

router.use(authenticate);

router.get('/', authorize(FEATURES.EMPLOYEES, 'read'), listEmployees);
router.get('/:id', authorize(FEATURES.EMPLOYEES, 'read'), getEmployee);
router.post('/', authorize(FEATURES.EMPLOYEES, 'create'), createEmployee);
router.patch('/:id', authorize(FEATURES.EMPLOYEES, 'update'), updateEmployee);
router.delete('/:id', authorize(FEATURES.EMPLOYEES, 'delete'), deleteEmployee);

// Full past/current/future contract-terms timeline - a sub-resource, same
// EMPLOYEES permission gate as the rest of the employee profile.
router.get('/:employeeId/contract-history', authorize(FEATURES.EMPLOYEES, 'read'), listVersions);
router.post('/:employeeId/contract-history', authorize(FEATURES.EMPLOYEES, 'update'), createVersion);

module.exports = router;
