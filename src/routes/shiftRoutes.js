const express = require('express');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const { FEATURES } = require('../config/permissions');
const {
  listShifts,
  getShift,
  createShift,
  updateShift,
  deleteShift,
  getAvailability,
  exportRoster,
  createChangeRequest,
  listChangeRequests,
  reviewChangeRequest,
} = require('../controllers/shiftController');

const router = express.Router();

router.use(authenticate);

router.get('/', authorize(FEATURES.DUTY_ROSTER, 'read'), listShifts);
router.get('/availability', authorize(FEATURES.DUTY_ROSTER, 'read'), getAvailability);
router.get('/export', authorize(FEATURES.DUTY_ROSTER, 'read'), exportRoster);
router.get('/change-requests', authorize(FEATURES.DUTY_ROSTER, 'read'), listChangeRequests);
router.post('/change-requests', authorize(FEATURES.DUTY_ROSTER, 'read'), createChangeRequest);
router.patch('/change-requests/:id', authorize(FEATURES.DUTY_ROSTER, 'approve'), reviewChangeRequest);
router.get('/:id', authorize(FEATURES.DUTY_ROSTER, 'read'), getShift);
router.post('/', authorize(FEATURES.DUTY_ROSTER, 'create'), createShift);
router.patch('/:id', authorize(FEATURES.DUTY_ROSTER, 'update'), updateShift);
router.delete('/:id', authorize(FEATURES.DUTY_ROSTER, 'delete'), deleteShift);

module.exports = router;
