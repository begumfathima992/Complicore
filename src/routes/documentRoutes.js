const express = require('express');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const { FEATURES } = require('../config/permissions');
const { listDocuments, getDocument, uploadDocument, updateDocument } = require('../controllers/documentController');

const router = express.Router();

router.use(authenticate);

router.get('/', authorize(FEATURES.DOCUMENTS, 'read'), listDocuments);
router.get('/:id', authorize(FEATURES.DOCUMENTS, 'read'), getDocument);
router.post('/', authorize(FEATURES.DOCUMENTS, 'create'), uploadDocument);
router.patch('/:id', authorize(FEATURES.DOCUMENTS, 'update'), updateDocument);

module.exports = router;
