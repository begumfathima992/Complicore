const express = require('express');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const { FEATURES } = require('../config/permissions');
const { listCompanies, getCompany, createCompany, updateCompany } = require('../controllers/companyController');

const router = express.Router();

router.use(authenticate);

router.get('/', authorize(FEATURES.COMPANIES, 'read'), listCompanies);
router.get('/:id', authorize(FEATURES.COMPANIES, 'read'), getCompany);
router.post('/', authorize(FEATURES.COMPANIES, 'create'), createCompany);
router.patch('/:id', authorize(FEATURES.COMPANIES, 'update'), updateCompany);

module.exports = router;
