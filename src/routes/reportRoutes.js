const express = require('express');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const { FEATURES } = require('../config/permissions');
const { listReports, runReport } = require('../controllers/reportController');

const router = express.Router();

router.use(authenticate);

router.get('/', authorize(FEATURES.REPORTS, 'read'), listReports);
// ?format=json|csv|excel|pdf plus filters: from, to, departmentId, employeeId, status, location, managerId
router.get('/:reportKey', authorize(FEATURES.REPORTS, 'read'), runReport);

module.exports = router;
