const express = require('express');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const { FEATURES } = require('../config/permissions');
const { listRecords, getWeekly, upsertRecord, approveRecord, exportRecords } = require('../controllers/attendanceController');

const router = express.Router();

router.use(authenticate);

router.get('/', authorize(FEATURES.ATTENDANCE, 'read'), listRecords);
router.get('/weekly', authorize(FEATURES.ATTENDANCE, 'read'), getWeekly);
router.get('/export', authorize(FEATURES.ATTENDANCE, 'read'), exportRecords);
router.post('/', authorize(FEATURES.ATTENDANCE, 'create'), upsertRecord);
router.patch('/:id/approve', authorize(FEATURES.ATTENDANCE, 'approve'), approveRecord);

module.exports = router;
