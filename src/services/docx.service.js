const {
  Document,
  Packer,
  Paragraph,
  TextRun,
  ExternalHyperlink,
  AlignmentType,
  BorderStyle,
  TabStopType,
} = require('docx');
const { toUrl } = require('./resumeRender.service');

// Matches the ATS template: single column, no tables, no text boxes.
// Right-aligned dates/locations use tab stops rather than a table so parsers
// still read each line as one continuous piece of text.

const PAGE_WIDTH_TWIPS = 12240 - 1440; // Letter width minus 0.5" margins each side
const FONT = 'Calibri';
const BODY_SIZE = 20; // half-points, so 10pt

function textRun(text, options = {}) {
  return new TextRun({ text: String(text == null ? '' : text), font: FONT, size: BODY_SIZE, ...options });
}

// Falls back to plain text when the value isn't a usable URL.
function linkRun(value, label) {
  const url = toUrl(value);
  const text = label == null ? String(value == null ? '' : value) : label;
  if (!url) return textRun(text);
  return new ExternalHyperlink({
    link: url,
    children: [textRun(text, { style: 'Hyperlink' })],
  });
}

function sectionHeading(text) {
  return new Paragraph({
    spacing: { before: 180, after: 50 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: '000000' } },
    children: [textRun(text.toUpperCase(), { bold: true, size: 22 })],
  });
}

// One line with left text and right-aligned text, joined by a tab stop.
function splitLine(left, right, leftOptions = {}, rightOptions = {}) {
  return new Paragraph({
    tabStops: [{ type: TabStopType.RIGHT, position: PAGE_WIDTH_TWIPS }],
    spacing: { after: 20 },
    children: [textRun(left, leftOptions), textRun('\t'), textRun(right, rightOptions)],
  });
}

function bullet(text) {
  return new Paragraph({
    bullet: { level: 0 },
    spacing: { after: 30 },
    children: [textRun(text)],
  });
}

function labelledLine(label, value) {
  return new Paragraph({
    bullet: { level: 0 },
    spacing: { after: 30 },
    children: [textRun(`${label}: `, { bold: true }), textRun(value)],
  });
}

function buildChildren(resume) {
  const p = resume.personalInfo || {};
  const children = [];

  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 30 },
      children: [textRun(p.fullName, { bold: true, size: 32 })],
    })
  );

  const contactChildren = [];
  if (p.email) {
    contactChildren.push(
      new ExternalHyperlink({
        link: `mailto:${p.email}`,
        children: [textRun(p.email, { style: 'Hyperlink' })],
      })
    );
  }
  [p.phone, p.location].filter(Boolean).forEach((value) => {
    if (contactChildren.length) contactChildren.push(textRun(' | '));
    contactChildren.push(textRun(value));
  });
  if (contactChildren.length) {
    children.push(
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 20 }, children: contactChildren })
    );
  }

  const linkChildren = [];
  if (p.linkedin) {
    linkChildren.push(textRun('LinkedIn: ', { bold: true }), linkRun(p.linkedin));
  }
  if (p.github) {
    if (linkChildren.length) linkChildren.push(textRun(' | '));
    linkChildren.push(textRun('GitHub: ', { bold: true }), linkRun(p.github));
  }
  if (linkChildren.length) {
    children.push(new Paragraph({ alignment: AlignmentType.CENTER, children: linkChildren }));
  }

  // --- 1. Professional Summary ---
  if (resume.summary) {
    children.push(sectionHeading('Professional Summary'));
    children.push(new Paragraph({ children: [textRun(resume.summary)] }));
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
    children.push(sectionHeading('Education'));
    (resume.education || []).forEach((e) => {
      children.push(splitLine(e.institution, e.location, { bold: true }, { bold: true }));
      const degreeLine = [e.degree, e.gpa ? `GPA: ${e.gpa}` : null].filter(Boolean).join(' | ');
      const dates = [e.startDate, e.endDate].filter(Boolean).join(' – ');
      children.push(splitLine(degreeLine, dates));
    });
    if (certs.length) children.push(labelledLine('Certifications', certs.join(', ')));
    if (resume.coursework && resume.coursework.length) {
      children.push(labelledLine('Relevant Coursework', resume.coursework.join(', ')));
    }
  }

  // --- 3. Technical Skills ---
  const usableSkills = ((resume.skills && resume.skills.categories) || []).filter(
    (c) => c.items && c.items.length
  );
  if (usableSkills.length) {
    children.push(sectionHeading('Technical Skills'));
    usableSkills.forEach((c) => children.push(labelledLine(c.name, c.items.join(', '))));
  }

  // --- 4. Professional Experience ---
  if (resume.experience && resume.experience.length) {
    children.push(sectionHeading('Professional Experience'));
    resume.experience.forEach((e) => {
      children.push(splitLine(e.company, e.location, { bold: true }, { bold: true }));
      const dates = [e.startDate, e.endDate].filter(Boolean).join(' – ');
      children.push(splitLine(e.title, dates, { italics: true }));
      (e.bullets || []).forEach((b) => children.push(bullet(b)));
    });
  }

  // --- 5. Key Projects ---
  if (resume.projects && resume.projects.length) {
    children.push(sectionHeading('Key Projects'));
    resume.projects.forEach((pr) => {
      const runs = [textRun(pr.name, { bold: true })];
      if (pr.technologies && pr.technologies.length) {
        runs.push(textRun(` | ${pr.technologies.join(', ')}`, { italics: true }));
      }
      if (pr.link) {
        runs.push(textRun(' ('), linkRun(pr.link), textRun(')'));
      }
      children.push(new Paragraph({ spacing: { after: 20 }, children: runs }));
      (pr.bullets || []).forEach((b) => children.push(bullet(b)));
    });
  }

  // --- 6. Languages ---
  const languages = (resume.languages || [])
    .filter((l) => l.name)
    .map((l) => (l.proficiency ? `${l.name} (${l.proficiency})` : l.name));
  if (languages.length) {
    children.push(sectionHeading('Languages'));
    children.push(new Paragraph({ bullet: { level: 0 }, children: [textRun(languages.join(', '))] }));
  }

  return children;
}

async function buildDocx(resume) {
  const doc = new Document({
    styles: { default: { document: { run: { font: FONT, size: BODY_SIZE } } } },
    sections: [
      {
        properties: { page: { margin: { top: 576, right: 720, bottom: 576, left: 720 } } },
        children: buildChildren(resume),
      },
    ],
  });

  return Packer.toBuffer(doc);
}

// No letterhead: the resume already carries the name and contact details, so
// the letter opens at the greeting.
async function buildCoverLetterDocx(letter) {
  const children = [];

  children.push(
    new Paragraph({ spacing: { after: 200 }, children: [textRun(letter.greeting || 'Dear Hiring Manager,', { size: 22 })] })
  );

  (letter.paragraphs || []).forEach((paragraph) =>
    children.push(new Paragraph({ spacing: { after: 200 }, children: [textRun(paragraph, { size: 22 })] }))
  );

  children.push(
    new Paragraph({ spacing: { before: 120, after: 240 }, children: [textRun(letter.closing || 'Sincerely,', { size: 22 })] })
  );
  children.push(new Paragraph({ children: [textRun(letter.fullName || '', { size: 22 })] }));

  const doc = new Document({
    styles: { default: { document: { run: { font: FONT, size: 22 } } } },
    sections: [
      {
        properties: { page: { margin: { top: 1080, right: 1080, bottom: 1080, left: 1080 } } },
        children,
      },
    ],
  });

  return Packer.toBuffer(doc);
}

module.exports = { buildDocx, buildCoverLetterDocx };
