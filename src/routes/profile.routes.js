const express = require('express');
const profileController = require('../controllers/profile.controller');
const { requireAuth } = require('../middleware/auth.middleware');

const router = express.Router();

router.get('/', requireAuth, profileController.getProfile);
router.put('/', requireAuth, profileController.saveProfile);

module.exports = router;
