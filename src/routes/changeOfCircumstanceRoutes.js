const express = require('express');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const { FEATURES } = require('../config/permissions');
const { listChanges, getChange, createChange } = require('../controllers/changeOfCircumstanceController');

const router = express.Router();

router.use(authenticate);

// No PATCH/DELETE routes - append-only audit trail (see model + controller comments).
router.get('/', authorize(FEATURES.CHANGE_OF_CIRCUMSTANCES, 'read'), listChanges);
router.get('/:id', authorize(FEATURES.CHANGE_OF_CIRCUMSTANCES, 'read'), getChange);
router.post('/', authorize(FEATURES.CHANGE_OF_CIRCUMSTANCES, 'create'), createChange);

module.exports = router;
