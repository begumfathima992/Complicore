const express = require('express');
const authenticate = require('../middleware/authenticate');
const { login, refresh, me, changePassword } = require('../controllers/authController');

const router = express.Router();

router.post('/login', login);
router.post('/refresh', refresh);
router.get('/me', authenticate, me);
router.post('/change-password', authenticate, changePassword);

module.exports = router;
