const express = require('express');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const { FEATURES } = require('../config/permissions');
const { listContacts, getContact, createContact, updateContact, deleteContact } = require('../controllers/emergencyContactController');

const router = express.Router();

router.use(authenticate);

router.get('/', authorize(FEATURES.EMERGENCY_CONTACTS, 'read'), listContacts);
router.get('/:id', authorize(FEATURES.EMERGENCY_CONTACTS, 'read'), getContact);
router.post('/', authorize(FEATURES.EMERGENCY_CONTACTS, 'create'), createContact);
router.patch('/:id', authorize(FEATURES.EMERGENCY_CONTACTS, 'update'), updateContact);
router.delete('/:id', authorize(FEATURES.EMERGENCY_CONTACTS, 'delete'), deleteContact);

module.exports = router;
