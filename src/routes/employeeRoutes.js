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

const router = express.Router();

router.use(authenticate);

router.get('/', authorize(FEATURES.EMPLOYEES, 'read'), listEmployees);
router.get('/:id', authorize(FEATURES.EMPLOYEES, 'read'), getEmployee);
router.post('/', authorize(FEATURES.EMPLOYEES, 'create'), createEmployee);
router.patch('/:id', authorize(FEATURES.EMPLOYEES, 'update'), updateEmployee);
router.delete('/:id', authorize(FEATURES.EMPLOYEES, 'delete'), deleteEmployee);

module.exports = router;
