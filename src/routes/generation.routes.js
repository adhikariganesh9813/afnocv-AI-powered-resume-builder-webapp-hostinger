const express = require('express');
const generationController = require('../controllers/generation.controller');
const { requireAuth } = require('../middleware/auth.middleware');

const router = express.Router();

router.use(requireAuth);

router.post('/', generationController.generate);
router.get('/', generationController.list);
router.get('/:id', generationController.getOne);
router.get('/:id/download/docx', generationController.downloadDocx);
router.get('/:id/download/pdf', generationController.downloadPdf);

module.exports = router;
