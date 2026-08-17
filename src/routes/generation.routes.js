const express = require('express');
const generationController = require('../controllers/generation.controller');
const { requireAuth } = require('../middleware/auth.middleware');

const router = express.Router();

router.use(requireAuth);

router.post('/', generationController.generate);
router.get('/', generationController.list);
router.get('/:id', generationController.getOne);
// doc: resume | cover, format: pdf | docx
router.get('/:id/download/:doc/:format', generationController.download);

module.exports = router;
