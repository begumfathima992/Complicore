const express = require('express');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const { FEATURES } = require('../config/permissions');
const { listAlerts, acknowledgeAlert, resolveAlert, runSync, createAlert } = require('../controllers/alertController');

const router = express.Router();

router.use(authenticate);

router.get('/', authorize(FEATURES.ALERTS, 'read'), listAlerts);
router.post('/', authorize(FEATURES.ALERTS, 'update'), createAlert);
router.post('/sync', authorize(FEATURES.ALERTS, 'update'), runSync);
router.patch('/:id/acknowledge', authorize(FEATURES.ALERTS, 'update'), acknowledgeAlert);
router.patch('/:id/resolve', authorize(FEATURES.ALERTS, 'update'), resolveAlert);

module.exports = router;
