const {
  Document,
  Packer,
  Paragraph,
  TextRun,
  AlignmentType,
  BorderStyle,
  TabStopType,
} = require('docx');

// Matches the ATS template: single column, no tables, no text boxes.
// Right-aligned dates/locations use tab stops rather than a table so parsers
// still read each line as one continuous piece of text.

const PAGE_WIDTH_TWIPS = 12240 - 1440; // Letter width minus 0.5" margins each side
const FONT = 'Calibri';

function textRun(text, options = {}) {
  return new TextRun({ text: String(text == null ? '' : text), font: FONT, size: 20, ...options });
}

function sectionHeading(text) {
  return new Paragraph({
    spacing: { before: 200, after: 60 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: '000000' } },
    children: [textRun(text.toUpperCase(), { bold: true, size: 22 })],
  });
}

// One line with left text and right-aligned text, joined by a tab stop.
function splitLine(left, right, leftOptions = {}) {
  return new Paragraph({
    tabStops: [{ type: TabStopType.RIGHT, position: PAGE_WIDTH_TWIPS }],
    spacing: { after: 20 },
    children: [textRun(left, leftOptions), textRun('\t'), textRun(right)],
  });
}

function bullet(text) {
  return new Paragraph({
    bullet: { level: 0 },
    spacing: { after: 40 },
    children: [textRun(text)],
  });
}

function labelledLine(label, value) {
  return new Paragraph({
    bullet: { level: 0 },
    spacing: { after: 40 },
    children: [textRun(`${label}: `, { bold: true }), textRun(value)],
  });
}

function buildChildren(resume) {
  const p = resume.personalInfo || {};
  const children = [];

  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 40 },
      children: [textRun(p.fullName, { bold: true, size: 32 })],
    })
  );

  const contact = [p.email, p.phone, p.location].filter(Boolean).join(' | ');
  if (contact) {
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 20 },
        children: [textRun(contact)],
      })
    );
  }

  const links = [];
  if (p.linkedin) links.push(`LinkedIn: ${p.linkedin}`);
  if (p.github) links.push(`GitHub: ${p.github}`);
  if (links.length) {
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [textRun(links.join(' | '))],
      })
    );
  }

  if (resume.summary) {
    children.push(sectionHeading('Professional Summary'));
    children.push(new Paragraph({ children: [textRun(resume.summary)] }));
  }

  const categories = (resume.skills && resume.skills.categories) || [];
  const usableSkills = categories.filter((c) => c.items && c.items.length);
  if (usableSkills.length) {
    children.push(sectionHeading('Technical Skills'));
    usableSkills.forEach((c) => children.push(labelledLine(c.name, c.items.join(', '))));
  }

  const hasEducation =
    (resume.education && resume.education.length) ||
    (resume.certifications && resume.certifications.length) ||
    (resume.coursework && resume.coursework.length);

  if (hasEducation) {
    children.push(sectionHeading('Education'));
    (resume.education || []).forEach((e) => {
      children.push(splitLine(e.institution, e.location, { bold: true }));
      const degreeLine = [e.degree, e.gpa ? `GPA: ${e.gpa}` : null].filter(Boolean).join(' | ');
      const dates = [e.startDate, e.endDate].filter(Boolean).join(' – ');
      children.push(splitLine(degreeLine, dates));
    });

    const certs = (resume.certifications || [])
      .map((c) => (c.issuer ? `${c.name} (${c.issuer})` : c.name))
      .filter(Boolean);
    if (certs.length) children.push(labelledLine('Certifications', certs.join(', ')));

    if (resume.coursework && resume.coursework.length) {
      children.push(labelledLine('Relevant Coursework', resume.coursework.join(', ')));
    }
  }

  if (resume.experience && resume.experience.length) {
    children.push(sectionHeading('Professional Experience'));
    resume.experience.forEach((e) => {
      children.push(splitLine(e.company, e.location, { bold: true }));
      const dates = [e.startDate, e.endDate].filter(Boolean).join(' – ');
      children.push(splitLine(e.title, dates, { italics: true }));
      (e.bullets || []).forEach((b) => children.push(bullet(b)));
    });
  }

  if (resume.projects && resume.projects.length) {
    children.push(sectionHeading('Key Projects'));
    resume.projects.forEach((pr) => {
      const runs = [textRun(pr.name, { bold: true })];
      if (pr.technologies && pr.technologies.length) {
        runs.push(textRun(` | ${pr.technologies.join(', ')}`, { italics: true }));
      }
      if (pr.link) runs.push(textRun(` (${pr.link})`));
      children.push(new Paragraph({ spacing: { after: 20 }, children: runs }));
      (pr.bullets || []).forEach((b) => children.push(bullet(b)));
    });
  }

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
    styles: { default: { document: { run: { font: FONT, size: 20 } } } },
    sections: [
      {
        properties: { page: { margin: { top: 720, right: 720, bottom: 720, left: 720 } } },
        children: buildChildren(resume),
      },
    ],
  });

  return Packer.toBuffer(doc);
}

module.exports = { buildDocx };
