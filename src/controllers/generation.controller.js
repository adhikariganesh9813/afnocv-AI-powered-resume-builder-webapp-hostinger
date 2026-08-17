const generationService = require('../services/generation.service');
const { buildDocx } = require('../services/docx.service');
const { buildPdf } = require('../services/pdf.service');
const { renderResumeHtml } = require('../services/resumeRender.service');

// "Ganesh Adhikari" -> "Ganesh_Adhikari_Resume"
function fileBaseName(resume) {
  const name = (resume.personalInfo && resume.personalInfo.fullName) || 'resume';
  const safe = name.trim().replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '');
  return `${safe || 'resume'}_Resume`;
}

async function generate(req, res, next) {
  try {
    const { jobDescription, resumeType } = req.body;
    const result = await generationService.generate(req.user.userId, { jobDescription, resumeType });
    res.status(201).json({ ...result, html: renderResumeHtml(result.resume) });
  } catch (err) {
    next(err);
  }
}

async function getOne(req, res, next) {
  try {
    const generation = await generationService.getGeneration(req.user.userId, req.params.id);
    res.json({ ...generation, html: renderResumeHtml(generation.resume) });
  } catch (err) {
    next(err);
  }
}

async function list(req, res, next) {
  try {
    res.json(await generationService.listGenerations(req.user.userId));
  } catch (err) {
    next(err);
  }
}

async function downloadDocx(req, res, next) {
  try {
    const { resume } = await generationService.getGeneration(req.user.userId, req.params.id);
    const buffer = await buildDocx(resume);
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    );
    res.setHeader('Content-Disposition', `attachment; filename="${fileBaseName(resume)}.docx"`);
    res.send(buffer);
  } catch (err) {
    next(err);
  }
}

async function downloadPdf(req, res, next) {
  try {
    const { resume } = await generationService.getGeneration(req.user.userId, req.params.id);
    const buffer = await buildPdf(resume);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileBaseName(resume)}.pdf"`);
    res.send(buffer);
  } catch (err) {
    next(err);
  }
}

module.exports = { generate, getOne, list, downloadDocx, downloadPdf };
