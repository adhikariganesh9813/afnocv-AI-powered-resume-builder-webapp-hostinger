const generationService = require('../services/generation.service');
const { buildDocx, buildCoverLetterDocx } = require('../services/docx.service');
const { buildPdf, buildCoverLetterPdf } = require('../services/pdf.service');
const { renderResumeHtml } = require('../services/resumeRender.service');
const { renderCoverLetterHtml } = require('../services/coverLetterRender.service');

// "Ganesh Adhikari" -> "Ganesh_Adhikari_Resume"
function fileBaseName(resume, suffix) {
  const name = (resume.personalInfo && resume.personalInfo.fullName) || 'resume';
  const safe = name.trim().replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '');
  return `${safe || 'resume'}_${suffix}`;
}

// Both documents rendered together so every response has the same shape.
function withHtml(generation) {
  return {
    ...generation,
    html: renderResumeHtml(generation.resume),
    coverLetterHtml: generation.coverLetter ? renderCoverLetterHtml(generation.coverLetter) : null,
  };
}

async function generate(req, res, next) {
  try {
    const { jobDescription, resumeType } = req.body;
    const result = await generationService.generate(req.user.userId, { jobDescription, resumeType });
    res.status(201).json(withHtml(result));
  } catch (err) {
    next(err);
  }
}

async function getOne(req, res, next) {
  try {
    const generation = await generationService.getGeneration(req.user.userId, req.params.id);
    res.json(withHtml(generation));
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

const MIME = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
};

// One handler for all four combinations of document and format.
async function download(req, res, next) {
  try {
    const { doc, format } = req.params;

    if (!['resume', 'cover'].includes(doc) || !['pdf', 'docx'].includes(format)) {
      const err = new Error('Unknown download type.');
      err.status = 404;
      throw err;
    }

    const { resume, coverLetter } = await generationService.getGeneration(req.user.userId, req.params.id);

    if (doc === 'cover' && !coverLetter) {
      const err = new Error('This resume was generated before cover letters were added. Generate a new one.');
      err.status = 404;
      throw err;
    }

    let buffer;
    if (doc === 'resume') {
      buffer = format === 'pdf' ? await buildPdf(resume) : await buildDocx(resume);
    } else {
      buffer = format === 'pdf' ? await buildCoverLetterPdf(coverLetter) : await buildCoverLetterDocx(coverLetter);
    }

    const filename = `${fileBaseName(resume, doc === 'resume' ? 'Resume' : 'Cover_Letter')}.${format}`;
    res.setHeader('Content-Type', MIME[format]);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (err) {
    next(err);
  }
}

module.exports = { generate, getOne, list, download };
