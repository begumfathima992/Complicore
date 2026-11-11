const express = require('express');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const { FEATURES } = require('../config/permissions');
const {
  getMyOrEmployeeBalance,
  listRequests,
  getRequest,
  createRequest,
  managerApprove,
  hrConfirm,
  cancelRequest,
} = require('../controllers/holidayController');

const router = express.Router();

router.use(authenticate);

router.get('/balance', authorize(FEATURES.HOLIDAY, 'read'), getMyOrEmployeeBalance);
router.get('/requests', authorize(FEATURES.HOLIDAY, 'read'), listRequests);
router.get('/requests/:id', authorize(FEATURES.HOLIDAY, 'read'), getRequest);
router.post('/requests', authorize(FEATURES.HOLIDAY, 'create'), createRequest);
// Manager-level sign-off: needs 'approve' - Manager holds this, Employee does not.
router.patch('/requests/:id/manager-approve', authorize(FEATURES.HOLIDAY, 'approve'), managerApprove);
// Final HR confirmation: needs 'update', which only the full-access roles hold -
// a Manager who can 'approve' cannot also perform this second, independent sign-off.
router.patch('/requests/:id/hr-confirm', authorize(FEATURES.HOLIDAY, 'update'), hrConfirm);
router.patch('/requests/:id/cancel', authorize(FEATURES.HOLIDAY, 'read'), cancelRequest);

module.exports = router;
