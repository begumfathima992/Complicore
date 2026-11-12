const express = require('express');
const multer = require('multer');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const { FEATURES } = require('../config/permissions');
const { getTemplate, preview, commit } = require('../controllers/importController');

// In-memory only - sheets are small (a few thousand rows at most) and
// importService.js reads the buffer directly with exceljs; nothing is
// ever written to local disk.
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

const router = express.Router();

router.use(authenticate);

router.get('/template', authorize(FEATURES.IMPORT, 'read'), getTemplate);
router.post('/preview', authorize(FEATURES.IMPORT, 'create'), upload.single('file'), preview);
router.post('/commit', authorize(FEATURES.IMPORT, 'create'), upload.single('file'), commit);

module.exports = router;
