const express = require('express');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const { FEATURES } = require('../config/permissions');
const { listAbsences, getAbsence, createAbsence, updateAbsence, approveAbsence } = require('../controllers/absenceController');

const router = express.Router();

router.use(authenticate);

router.get('/', authorize(FEATURES.SICK_LEAVE, 'read'), listAbsences);
router.get('/:id', authorize(FEATURES.SICK_LEAVE, 'read'), getAbsence);
router.post('/', authorize(FEATURES.SICK_LEAVE, 'create'), createAbsence);
router.patch('/:id', authorize(FEATURES.SICK_LEAVE, 'update'), updateAbsence);
router.patch('/:id/approve', authorize(FEATURES.SICK_LEAVE, 'approve'), approveAbsence);

module.exports = router;
