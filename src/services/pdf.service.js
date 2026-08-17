const PDFDocument = require('pdfkit');
const { formatDate, recipientLines } = require('./coverLetterRender.service');

// Builds the ATS template as a real text-based PDF (selectable/parseable text,
// not an image). PDFKit is pure JavaScript, so this works on shared hosting
// where a headless browser would not.

const MARGIN = 40;
const FONT = 'Helvetica';
const FONT_BOLD = 'Helvetica-Bold';
const FONT_ITALIC = 'Helvetica-Oblique';
const BODY_SIZE = 9.5;
const LINE_GAP = 1.5;

function contentWidth(doc) {
  return doc.page.width - MARGIN * 2;
}

// Starts a new page when the next block wouldn't fit, so sections are never
// cut in half across the page break.
function ensureSpace(doc, needed) {
  if (doc.y + needed > doc.page.height - MARGIN) doc.addPage();
}

function sectionHeading(doc, title) {
  ensureSpace(doc, 34);
  doc.moveDown(0.5);
  doc.font(FONT_BOLD).fontSize(10.5).fillColor('#000').text(title.toUpperCase(), MARGIN, doc.y);
  const y = doc.y + 2;
  doc.moveTo(MARGIN, y).lineTo(doc.page.width - MARGIN, y).lineWidth(0.7).strokeColor('#000').stroke();
  doc.y = y + 5;
}

// Left text with right-aligned text on the same baseline.
function splitLine(doc, left, right, { bold = false, italic = false } = {}) {
  ensureSpace(doc, 16);
  const y = doc.y;
  const width = contentWidth(doc);

  doc.font(bold ? FONT_BOLD : italic ? FONT_ITALIC : FONT).fontSize(BODY_SIZE);
  doc.text(left || '', MARGIN, y, { width: width * 0.65, lineBreak: false, ellipsis: true });

  if (right) {
    doc.font(FONT).fontSize(BODY_SIZE);
    doc.text(right, MARGIN + width * 0.65, y, { width: width * 0.35, align: 'right', lineBreak: false });
  }

  doc.y = y + BODY_SIZE + 3;
}

function bullet(doc, text) {
  const width = contentWidth(doc) - 12;
  doc.font(FONT).fontSize(BODY_SIZE);
  const height = doc.heightOfString(text, { width, lineGap: LINE_GAP });
  ensureSpace(doc, height + 4);

  const y = doc.y;
  doc.text('•', MARGIN + 2, y, { lineBreak: false });
  doc.text(text, MARGIN + 12, y, { width, lineGap: LINE_GAP });
  doc.y += 2;
}

function labelledBullet(doc, label, value) {
  const width = contentWidth(doc) - 12;

  doc.font(FONT).fontSize(BODY_SIZE);
  const height = doc.heightOfString(`${label}: ${value}`, { width, lineGap: LINE_GAP });
  ensureSpace(doc, height + 4);

  const y = doc.y;
  doc.font(FONT).text('•', MARGIN + 2, y, { lineBreak: false });
  // `continued` keeps the value on the same line as the bold label while still
  // letting it wrap inside `width` — without it the line runs past the margin.
  doc.font(FONT_BOLD).text(`${label}: `, MARGIN + 12, y, { width, lineGap: LINE_GAP, continued: true });
  doc.font(FONT).text(value, { width, lineGap: LINE_GAP });
  doc.y += 2;
}

function paragraph(doc, text) {
  const width = contentWidth(doc);
  doc.font(FONT).fontSize(BODY_SIZE);
  const height = doc.heightOfString(text, { width, lineGap: LINE_GAP });
  ensureSpace(doc, height);
  doc.text(text, MARGIN, doc.y, { width, lineGap: LINE_GAP, align: 'left' });
  doc.y += 2;
}

function buildPdf(resume) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'LETTER', margin: MARGIN, bufferPages: true });
    const chunks = [];

    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const p = resume.personalInfo || {};
    const width = contentWidth(doc);

    // Header
    doc.font(FONT_BOLD).fontSize(17).fillColor('#000');
    doc.text(p.fullName || '', MARGIN, MARGIN, { width, align: 'center' });
    doc.moveDown(0.25);

    const contact = [p.email, p.phone, p.location].filter(Boolean).join('  |  ');
    if (contact) {
      doc.font(FONT).fontSize(9);
      doc.text(contact, MARGIN, doc.y, { width, align: 'center' });
    }

    const links = [];
    if (p.linkedin) links.push(`LinkedIn: ${p.linkedin}`);
    if (p.github) links.push(`GitHub: ${p.github}`);
    if (links.length) {
      doc.font(FONT).fontSize(9);
      doc.text(links.join('  |  '), MARGIN, doc.y + 1, { width, align: 'center' });
    }

    if (resume.summary) {
      sectionHeading(doc, 'Professional Summary');
      paragraph(doc, resume.summary);
    }

    const categories = ((resume.skills && resume.skills.categories) || []).filter(
      (c) => c.items && c.items.length
    );
    if (categories.length) {
      sectionHeading(doc, 'Technical Skills');
      categories.forEach((c) => labelledBullet(doc, c.name, c.items.join(', ')));
    }

    const certs = (resume.certifications || [])
      .map((c) => (c.issuer ? `${c.name} (${c.issuer})` : c.name))
      .filter(Boolean);
    const hasEducation =
      (resume.education && resume.education.length) ||
      certs.length ||
      (resume.coursework && resume.coursework.length);

    if (hasEducation) {
      sectionHeading(doc, 'Education');
      (resume.education || []).forEach((e) => {
        splitLine(doc, e.institution, e.location, { bold: true });
        const degreeLine = [e.degree, e.gpa ? `GPA: ${e.gpa}` : null].filter(Boolean).join(' | ');
        const dates = [e.startDate, e.endDate].filter(Boolean).join(' – ');
        splitLine(doc, degreeLine, dates);
        doc.y += 2;
      });
      if (certs.length) labelledBullet(doc, 'Certifications', certs.join(', '));
      if (resume.coursework && resume.coursework.length) {
        labelledBullet(doc, 'Relevant Coursework', resume.coursework.join(', '));
      }
    }

    if (resume.experience && resume.experience.length) {
      sectionHeading(doc, 'Professional Experience');
      resume.experience.forEach((e) => {
        splitLine(doc, e.company, e.location, { bold: true });
        const dates = [e.startDate, e.endDate].filter(Boolean).join(' – ');
        splitLine(doc, e.title, dates, { italic: true });
        (e.bullets || []).forEach((b) => bullet(doc, b));
        doc.y += 3;
      });
    }

    if (resume.projects && resume.projects.length) {
      sectionHeading(doc, 'Key Projects');
      resume.projects.forEach((pr) => {
        ensureSpace(doc, 20);
        const y = doc.y;
        doc.font(FONT_BOLD).fontSize(BODY_SIZE).text(pr.name || '', MARGIN, y, { continued: true });
        if (pr.technologies && pr.technologies.length) {
          doc.font(FONT_ITALIC).text(` | ${pr.technologies.join(', ')}`, { continued: Boolean(pr.link) });
        }
        if (pr.link) doc.font(FONT).text(` (${pr.link})`);
        if (!pr.technologies?.length && !pr.link) doc.text('');
        doc.y += 2;
        (pr.bullets || []).forEach((b) => bullet(doc, b));
        doc.y += 3;
      });
    }

    const languages = (resume.languages || [])
      .filter((l) => l.name)
      .map((l) => (l.proficiency ? `${l.name} (${l.proficiency})` : l.name));
    if (languages.length) {
      sectionHeading(doc, 'Languages');
      bullet(doc, languages.join(', '));
    }

    doc.end();
  });
}

function buildCoverLetterPdf(letter, personalInfo = {}, createdAt = new Date()) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'LETTER', margin: 54 });
    const chunks = [];

    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const width = doc.page.width - 108;
    const name = letter.fullName || personalInfo.fullName || '';

    doc.font(FONT_BOLD).fontSize(15).fillColor('#000');
    doc.text(name, 54, 54, { width, align: 'center' });

    const contact = [personalInfo.email, personalInfo.phone, personalInfo.location]
      .filter(Boolean)
      .join('  |  ');
    if (contact) {
      doc.font(FONT).fontSize(9);
      doc.text(contact, 54, doc.y + 2, { width, align: 'center' });
    }

    doc.moveDown(2);
    doc.font(FONT).fontSize(10);
    doc.text(formatDate(createdAt), 54, doc.y, { width });

    const recipient = recipientLines(letter);
    if (recipient.length) {
      doc.moveDown(1);
      recipient.forEach((line) => doc.text(line, 54, doc.y, { width }));
    }

    doc.moveDown(1.2);
    doc.text(letter.greeting || 'Dear Hiring Manager,', 54, doc.y, { width });
    doc.moveDown(0.8);

    (letter.paragraphs || []).forEach((paragraph) => {
      doc.text(paragraph, 54, doc.y, { width, align: 'left', lineGap: 2 });
      doc.moveDown(0.8);
    });

    doc.moveDown(0.5);
    doc.text(letter.closing || 'Sincerely,', 54, doc.y, { width });
    doc.moveDown(1.5);
    doc.text(name, 54, doc.y, { width });

    doc.end();
  });
}

module.exports = { buildPdf, buildCoverLetterPdf };
