const express = require('express');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const { FEATURES } = require('../config/permissions');
const {
  listUsers,
  getUser,
  createUser,
  updateUser,
  deactivateUser,
  reactivateUser,
} = require('../controllers/userController');

const router = express.Router();

router.use(authenticate);

router.get('/', authorize(FEATURES.USERS, 'read'), listUsers);
router.get('/:id', authorize(FEATURES.USERS, 'read'), getUser);
router.post('/', authorize(FEATURES.USERS, 'create'), createUser);
router.patch('/:id', authorize(FEATURES.USERS, 'update'), updateUser);
router.patch('/:id/deactivate', authorize(FEATURES.USERS, 'update'), deactivateUser);
router.patch('/:id/reactivate', authorize(FEATURES.USERS, 'update'), reactivateUser);

module.exports = router;
