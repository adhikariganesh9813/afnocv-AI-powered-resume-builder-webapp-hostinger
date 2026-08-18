const PDFDocument = require('pdfkit');
const { toUrl } = require('./resumeRender.service');

// Builds the ATS template as a real text-based PDF (selectable/parseable text,
// not an image). PDFKit is pure JavaScript, so this works on shared hosting
// where a headless browser would not.

const FONT = 'Helvetica';
const FONT_BOLD = 'Helvetica-Bold';
const FONT_ITALIC = 'Helvetica-Oblique';
const LINK_COLOR = '#0b4fbf';

// A resume that spills onto a second page reads as careless, so the document is
// laid out at progressively tighter settings until it fits on one US Letter
// page. Each step shrinks type and spacing together so proportions hold.
// `space` scales the vertical rhythm independently of type size, so the layout
// tightens before the text shrinks — whitespace is cheaper to lose than legibility.
const FIT_STEPS = [
  { margin: 40, body: 9.5, heading: 10.5, name: 17, gap: 1.0, space: 1.0 },
  { margin: 38, body: 9.3, heading: 10.3, name: 16.5, gap: 0.9, space: 0.85 },
  { margin: 36, body: 9.1, heading: 10.1, name: 16, gap: 0.8, space: 0.72 },
  { margin: 34, body: 8.9, heading: 9.8, name: 15.5, gap: 0.7, space: 0.62 },
  { margin: 32, body: 8.6, heading: 9.5, name: 15, gap: 0.6, space: 0.54 },
  { margin: 30, body: 8.3, heading: 9.2, name: 14.5, gap: 0.5, space: 0.48 },
  { margin: 28, body: 8.0, heading: 8.9, name: 14, gap: 0.45, space: 0.42 },
  { margin: 27, body: 7.8, heading: 8.6, name: 13.5, gap: 0.4, space: 0.38 },
  { margin: 26, body: 7.6, heading: 8.4, name: 13, gap: 0.35, space: 0.34 },
  { margin: 25, body: 7.4, heading: 8.2, name: 12.5, gap: 0.3, space: 0.3 },
  { margin: 24, body: 7.2, heading: 8.0, name: 12, gap: 0.25, space: 0.26 },
  { margin: 24, body: 7.0, heading: 7.8, name: 12, gap: 0.2, space: 0.22 },
];

function createLayout(doc, s) {
  const M = s.margin;
  const width = () => doc.page.width - M * 2;

  // Starts a new page when the next block wouldn't fit, so sections are never
  // cut in half across the page break.
  const ensureSpace = (needed) => {
    if (doc.y + needed > doc.page.height - M) doc.addPage();
  };

  const sectionHeading = (title) => {
    ensureSpace(s.heading * 3);
    doc.y += s.body * 0.55 * s.space;
    doc.font(FONT_BOLD).fontSize(s.heading).fillColor('#000');
    doc.text(title.toUpperCase(), M, doc.y);
    const y = doc.y + 1.5;
    doc.moveTo(M, y).lineTo(doc.page.width - M, y).lineWidth(0.7).strokeColor('#000').stroke();
    doc.y = y + s.body * 0.5 * s.space;
  };

  // Left text with right-aligned text on the same baseline.
  const splitLine = (left, right, { bold = false, italic = false, rightBold = false } = {}) => {
    ensureSpace(s.body + 5);
    const y = doc.y;
    const w = width();

    doc.font(bold ? FONT_BOLD : italic ? FONT_ITALIC : FONT).fontSize(s.body).fillColor('#000');
    doc.text(left || '', M, y, { width: w * 0.66, lineBreak: false, ellipsis: true });

    if (right) {
      doc.font(rightBold ? FONT_BOLD : FONT).fontSize(s.body);
      doc.text(right, M + w * 0.66, y, { width: w * 0.34, align: 'right', lineBreak: false });
    }

    doc.y = y + s.body + 2.5 * s.space;
  };

  const bullet = (text) => {
    const w = width() - 11;
    doc.font(FONT).fontSize(s.body).fillColor('#000');
    const height = doc.heightOfString(text, { width: w, lineGap: s.gap });
    ensureSpace(height + 3);

    const y = doc.y;
    doc.text('•', M + 2, y, { lineBreak: false });
    doc.text(text, M + 11, y, { width: w, lineGap: s.gap });
    doc.y += 1.5 * s.space;
  };

  const labelledBullet = (label, value) => {
    const w = width() - 11;
    doc.font(FONT).fontSize(s.body).fillColor('#000');
    const height = doc.heightOfString(`${label}: ${value}`, { width: w, lineGap: s.gap });
    ensureSpace(height + 3);

    const y = doc.y;
    doc.text('•', M + 2, y, { lineBreak: false });
    doc.font(FONT_BOLD).text(`${label}: `, M + 11, y, { width: w, lineGap: s.gap, continued: true });
    doc.font(FONT).text(value, { width: w, lineGap: s.gap });
    doc.y += 1.5 * s.space;
  };

  const paragraph = (text) => {
    const w = width();
    doc.font(FONT).fontSize(s.body).fillColor('#000');
    const height = doc.heightOfString(text, { width: w, lineGap: s.gap });
    ensureSpace(height);
    doc.text(text, M, doc.y, { width: w, lineGap: s.gap });
    doc.y += 1.5 * s.space;
  };

  return { M, width, ensureSpace, sectionHeading, splitLine, bullet, labelledBullet, paragraph };
}

// Draws a row of text runs left to right, tracking x manually so each piece's
// exact position is known. Links are added as explicit annotations after the
// text is drawn — PDFKit's inline `link` option computes its own rectangle and
// produces invalid coordinates when combined with lineBreak:false / continued.
// Pieces: { text, url?, bold?, italic? }
function drawRuns(doc, pieces, startX, y, fontSize) {
  doc.fontSize(fontSize);

  const fontFor = (piece) => (piece.bold ? FONT_BOLD : piece.italic ? FONT_ITALIC : FONT);
  const widthOf = (piece) => {
    doc.font(fontFor(piece));
    return doc.widthOfString(piece.text);
  };

  let x = startX;

  pieces.forEach((piece) => {
    const width = widthOf(piece);
    doc.font(fontFor(piece)).fillColor(piece.url ? LINK_COLOR : '#000');

    // PDFKit's own `underline` option needs a wrapping width to measure against
    // and yields NaN with lineBreak:false, so the rule is drawn by hand from the
    // width already measured here.
    doc.text(piece.text, x, y, { lineBreak: false });

    if (piece.url) {
      const underlineY = y + fontSize * 1.02;
      doc
        .moveTo(x, underlineY)
        .lineTo(x + width, underlineY)
        .lineWidth(0.4)
        .strokeColor(LINK_COLOR)
        .stroke();
      doc.link(x, y, width, fontSize * 1.15, piece.url);
    }

    x += width;
  });

  doc.fillColor('#000');
  return x;
}

function runsWidth(doc, pieces, fontSize) {
  doc.fontSize(fontSize);
  return pieces.reduce((sum, piece) => {
    doc.font(piece.bold ? FONT_BOLD : piece.italic ? FONT_ITALIC : FONT);
    return sum + doc.widthOfString(piece.text);
  }, 0);
}

// Centres a row of runs, inserting separators between them.
function centeredRuns(doc, pieces, s, y) {
  const fontSize = s.body * 0.95;
  const withSeparators = [];

  pieces.forEach((piece, i) => {
    if (i > 0) withSeparators.push({ text: '  |  ' });
    withSeparators.push(piece);
  });

  const total = runsWidth(doc, withSeparators, fontSize);
  drawRuns(doc, withSeparators, (doc.page.width - total) / 2, y, fontSize);
  return y + s.body * 1.25;
}

function drawResume(doc, resume, s) {
  const L = createLayout(doc, s);
  const p = resume.personalInfo || {};

  doc.font(FONT_BOLD).fontSize(s.name).fillColor('#000');
  doc.text(p.fullName || '', L.M, s.margin, { width: L.width(), align: 'center' });

  let y = doc.y + 1;

  const contact = [];
  if (p.email) contact.push({ text: p.email, url: `mailto:${p.email}` });
  if (p.phone) contact.push({ text: p.phone });
  if (p.location) contact.push({ text: p.location });
  if (contact.length) y = centeredRuns(doc, contact, s, y);

  const links = [];
  if (p.linkedin) links.push({ text: `LinkedIn: ${p.linkedin}`, url: toUrl(p.linkedin) });
  if (p.github) links.push({ text: `GitHub: ${p.github}`, url: toUrl(p.github) });
  if (links.length) y = centeredRuns(doc, links, s, y);

  doc.y = y;

  // --- 1. Professional Summary ---
  if (resume.summary) {
    L.sectionHeading('Professional Summary');
    L.paragraph(resume.summary);
  }

  // --- 2. Education ---
  const certs = (resume.certifications || [])
    .map((c) => (c.issuer ? `${c.name} (${c.issuer})` : c.name))
    .filter(Boolean);
  const hasEducation =
    (resume.education && resume.education.length) ||
    certs.length ||
    (resume.coursework && resume.coursework.length);

  if (hasEducation) {
    L.sectionHeading('Education');
    (resume.education || []).forEach((e) => {
      L.splitLine(e.institution, e.location, { bold: true, rightBold: true });
      const degreeLine = [e.degree, e.gpa ? `GPA: ${e.gpa}` : null].filter(Boolean).join(' | ');
      const dates = [e.startDate, e.endDate].filter(Boolean).join(' – ');
      L.splitLine(degreeLine, dates);
      doc.y += 1.5 * s.space;
    });
    if (certs.length) L.labelledBullet('Certifications', certs.join(', '));
    if (resume.coursework && resume.coursework.length) {
      L.labelledBullet('Relevant Coursework', resume.coursework.join(', '));
    }
  }

  // --- 3. Technical Skills ---
  const categories = ((resume.skills && resume.skills.categories) || []).filter(
    (c) => c.items && c.items.length
  );
  if (categories.length) {
    L.sectionHeading('Technical Skills');
    categories.forEach((c) => L.labelledBullet(c.name, c.items.join(', ')));
  }

  // --- 4. Professional Experience ---
  if (resume.experience && resume.experience.length) {
    L.sectionHeading('Professional Experience');
    resume.experience.forEach((e) => {
      L.splitLine(e.company, e.location, { bold: true, rightBold: true });
      const dates = [e.startDate, e.endDate].filter(Boolean).join(' – ');
      L.splitLine(e.title, dates, { italic: true });
      (e.bullets || []).forEach((b) => L.bullet(b));
      doc.y += 2 * s.space;
    });
  }

  // --- 5. Key Projects ---
  if (resume.projects && resume.projects.length) {
    L.sectionHeading('Key Projects');
    resume.projects.forEach((pr) => {
      L.ensureSpace(s.body * 2);

      const pieces = [{ text: pr.name || '', bold: true }];
      if (pr.technologies && pr.technologies.length) {
        pieces.push({ text: ` | ${pr.technologies.join(', ')}`, italic: true });
      }
      if (pr.link) {
        pieces.push({ text: ' (' });
        pieces.push({ text: pr.link, url: toUrl(pr.link) });
        pieces.push({ text: ')' });
      }

      drawRuns(doc, pieces, L.M, doc.y, s.body);
      doc.y += s.body + 2.5 * s.space;

      (pr.bullets || []).forEach((b) => L.bullet(b));
      doc.y += 2 * s.space;
    });
  }

  // --- 6. Languages ---
  const languages = (resume.languages || [])
    .filter((l) => l.name)
    .map((l) => (l.proficiency ? `${l.name} (${l.proficiency})` : l.name));
  if (languages.length) {
    L.sectionHeading('Languages');
    L.bullet(languages.join(', '));
  }
}

function renderToBuffer(draw, margin) {
  return new Promise((resolve, reject) => {
    // autoFirstPage is off so the 'pageAdded' listener sees every page, including
    // the first. (bufferedPageRange() is useless here: it reports 0 once end()
    // has flushed the buffer.)
    const doc = new PDFDocument({ size: 'LETTER', margin, autoFirstPage: false });
    const chunks = [];
    let pages = 0;

    doc.on('pageAdded', () => {
      pages += 1;
    });
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve({ buffer: Buffer.concat(chunks), pages }));
    doc.on('error', reject);

    doc.addPage();
    draw(doc);
    doc.end();
  });
}

async function buildPdf(resume) {
  let last = null;
  for (const step of FIT_STEPS) {
    last = await renderToBuffer((doc) => drawResume(doc, resume, step), step.margin);
    if (last.pages === 1) return last.buffer;
  }
  // Genuinely too much content to fit even at the tightest setting — return the
  // smallest version rather than failing the download.
  return last.buffer;
}

// --- Cover letter -----------------------------------------------------------

const LETTER_FIT_STEPS = [
  { margin: 72, body: 11, gap: 3, paraGap: 11 },
  { margin: 64, body: 10.5, gap: 2.5, paraGap: 10 },
  { margin: 58, body: 10, gap: 2, paraGap: 9 },
  { margin: 54, body: 9.5, gap: 2, paraGap: 8 },
  { margin: 50, body: 9, gap: 1.5, paraGap: 7 },
];

// Deliberately has no letterhead: the resume already carries the candidate's
// name and contact details, so the letter opens straight at the greeting.
function drawCoverLetter(doc, letter, s) {
  const M = s.margin;
  const width = doc.page.width - M * 2;
  const name = letter.fullName || '';

  doc.font(FONT).fontSize(s.body).fillColor('#000');
  doc.text(letter.greeting || 'Dear Hiring Manager,', M, M, { width });
  doc.y += s.paraGap;

  (letter.paragraphs || []).forEach((paragraph) => {
    doc.text(paragraph, M, doc.y, { width, lineGap: s.gap, align: 'left' });
    doc.y += s.paraGap;
  });

  doc.y += s.paraGap * 0.4;
  doc.text(letter.closing || 'Sincerely,', M, doc.y, { width });
  // A single blank line between the closing and the name — enough to read as a
  // signature space without leaving a gap the user has to scroll past.
  doc.y += s.body * 1.4;
  doc.text(name, M, doc.y, { width });
}

async function buildCoverLetterPdf(letter) {
  let last = null;
  for (const step of LETTER_FIT_STEPS) {
    last = await renderToBuffer((doc) => drawCoverLetter(doc, letter, step), step.margin);
    if (last.pages === 1) return last.buffer;
  }
  return last.buffer;
}

module.exports = { buildPdf, buildCoverLetterPdf };
