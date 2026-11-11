const express = require('express');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const { FEATURES } = require('../config/permissions');
const { listAuditLogs, getAuditLog, checkIntegrity } = require('../controllers/auditController');

const router = express.Router();

router.use(authenticate);

// Read-only, deliberately: no create/update/delete route exists for audit
// logs. Entries are written exclusively by services/auditService.js from
// inside other controllers - never accepted directly from a client.
router.get('/', authorize(FEATURES.AUDIT_LOGS, 'read'), listAuditLogs);
router.get('/verify', authorize(FEATURES.AUDIT_LOGS, 'read'), checkIntegrity);
router.get('/:id', authorize(FEATURES.AUDIT_LOGS, 'read'), getAuditLog);

module.exports = router;
