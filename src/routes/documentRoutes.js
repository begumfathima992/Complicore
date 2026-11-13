const express = require('express');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const { FEATURES } = require('../config/permissions');
const {
  listDocuments,
  getDocument,
  getUploadUrl,
  createDocument,
  getViewUrl,
  getDownloadUrl,
  updateDocument,
  deleteDocument,
} = require('../controllers/documentController');

const router = express.Router();

router.use(authenticate);

router.get('/', authorize(FEATURES.DOCUMENTS, 'read'), listDocuments);
router.post('/upload-url', authorize(FEATURES.DOCUMENTS, 'create'), getUploadUrl);
router.post('/', authorize(FEATURES.DOCUMENTS, 'create'), createDocument);
router.get('/:id', authorize(FEATURES.DOCUMENTS, 'read'), getDocument);
router.get('/:id/view-url', authorize(FEATURES.DOCUMENTS, 'read'), getViewUrl);
router.get('/:id/download-url', authorize(FEATURES.DOCUMENTS, 'read'), getDownloadUrl);
router.patch('/:id', authorize(FEATURES.DOCUMENTS, 'update'), updateDocument);
router.delete('/:id', authorize(FEATURES.DOCUMENTS, 'delete'), deleteDocument);

module.exports = router;
