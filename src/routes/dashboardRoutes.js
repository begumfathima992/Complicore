const express = require('express');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const { FEATURES } = require('../config/permissions');
const { complianceOverview } = require('../controllers/dashboardController');

const router = express.Router();

router.use(authenticate);

// Reuses REPORTS access: HR/Employer/Super see the full picture, a Manager
// sees their own team's numbers, an Employee has no access (same as Reports).
router.get('/compliance', authorize(FEATURES.REPORTS, 'read'), complianceOverview);

module.exports = router;
