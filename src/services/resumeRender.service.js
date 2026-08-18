// Turns a generated resume object into the ATS-friendly HTML layout.
// Single column, no tables or text boxes — parsers read it top to bottom.

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Users type "github.com/name" far more often than a full URL, so a scheme is
// added when missing. Returns null when there is nothing linkable.
function toUrl(value) {
  const text = String(value == null ? '' : value).trim();
  if (!text) return null;
  if (/^https?:\/\//i.test(text)) return text;
  if (/^www\./i.test(text) || /^[\w-]+(\.[\w-]+)+([/?#]|$)/.test(text)) return `https://${text}`;
  return null;
}

function link(value, label) {
  const url = toUrl(value);
  const text = escapeHtml(label == null ? value : label);
  if (!url) return text;
  return `<a class="r-url" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${text}</a>`;
}

function section(title, body) {
  if (!body) return '';
  return `<section class="r-section">
  <h2 class="r-section-title">${escapeHtml(title)}</h2>
  ${body}
</section>`;
}

function contactLine(personalInfo) {
  const parts = [];
  if (personalInfo.email) {
    parts.push(
      `<a class="r-url" href="mailto:${escapeHtml(personalInfo.email)}">${escapeHtml(personalInfo.email)}</a>`
    );
  }
  if (personalInfo.phone) parts.push(escapeHtml(personalInfo.phone));
  if (personalInfo.location) parts.push(escapeHtml(personalInfo.location));
  return parts.join(' | ');
}

function linksLine(personalInfo) {
  const links = [];
  if (personalInfo.linkedin) links.push(`<strong>LinkedIn:</strong> ${link(personalInfo.linkedin)}`);
  if (personalInfo.github) links.push(`<strong>GitHub:</strong> ${link(personalInfo.github)}`);
  return links.join(' | ');
}

function renderSkills(skills) {
  const rows = (skills.categories || [])
    .filter((c) => c.items && c.items.length)
    .map(
      (c) =>
        `<li><strong>${escapeHtml(c.name)}:</strong> ${c.items.map(escapeHtml).join(', ')}</li>`
    )
    .join('');
  return rows ? `<ul class="r-list">${rows}</ul>` : '';
}

function renderEducation(education, certifications, coursework) {
  const entries = (education || [])
    .map((e) => {
      const degreeLine = [e.degree, e.gpa ? `GPA: ${e.gpa}` : null].filter(Boolean).map(escapeHtml).join(' | ');
      const dates = [e.startDate, e.endDate].filter(Boolean).map(escapeHtml).join(' – ');
      return `<div class="r-entry">
  <div class="r-entry-row"><span class="r-strong">${escapeHtml(e.institution)}</span><span class="r-right r-strong">${escapeHtml(e.location)}</span></div>
  <div class="r-entry-row"><span>${degreeLine}</span><span class="r-right">${dates}</span></div>
</div>`;
    })
    .join('');

  const extras = [];
  if (certifications && certifications.length) {
    const list = certifications
      .map((c) => (c.issuer ? `${c.name} (${c.issuer})` : c.name))
      .filter(Boolean)
      .map(escapeHtml)
      .join(', ');
    if (list) extras.push(`<li><strong>Certifications:</strong> ${list}</li>`);
  }
  if (coursework && coursework.length) {
    extras.push(`<li><strong>Relevant Coursework:</strong> ${coursework.map(escapeHtml).join(', ')}</li>`);
  }

  const extrasHtml = extras.length ? `<ul class="r-list">${extras.join('')}</ul>` : '';
  return entries || extrasHtml ? entries + extrasHtml : '';
}

function renderExperience(experience) {
  return (experience || [])
    .map((e) => {
      const dates = [e.startDate, e.endDate].filter(Boolean).map(escapeHtml).join(' – ');
      const bullets = (e.bullets || [])
        .map((b) => `<li>${escapeHtml(b)}</li>`)
        .join('');
      return `<div class="r-entry">
  <div class="r-entry-row"><span class="r-strong">${escapeHtml(e.company)}</span><span class="r-right r-strong">${escapeHtml(e.location)}</span></div>
  <div class="r-entry-row"><span class="r-italic">${escapeHtml(e.title)}</span><span class="r-right">${dates}</span></div>
  ${bullets ? `<ul class="r-bullets">${bullets}</ul>` : ''}
</div>`;
    })
    .join('');
}

function renderProjects(projects) {
  return (projects || [])
    .map((p) => {
      const tech = (p.technologies || []).length
        ? ` | <span class="r-italic">${p.technologies.map(escapeHtml).join(', ')}</span>`
        : '';
      const url = p.link ? ` <span class="r-link">(${link(p.link)})</span>` : '';
      const bullets = (p.bullets || []).map((b) => `<li>${escapeHtml(b)}</li>`).join('');
      return `<div class="r-entry">
  <div><span class="r-strong">${escapeHtml(p.name)}</span>${tech}${url}</div>
  ${bullets ? `<ul class="r-bullets">${bullets}</ul>` : ''}
</div>`;
    })
    .join('');
}

function renderLanguages(languages) {
  const list = (languages || [])
    .filter((l) => l.name)
    .map((l) => (l.proficiency ? `${l.name} (${l.proficiency})` : l.name))
    .map(escapeHtml)
    .join(', ');
  return list ? `<ul class="r-list"><li>${list}</li></ul>` : '';
}

function renderResumeHtml(resume) {
  const p = resume.personalInfo || {};

  // Section order is fixed: summary, education, skills, experience, projects,
  // languages. Changing it here means changing pdf.service and docx.service too.
  return `<article class="resume">
  <header class="r-header">
    <h1 class="r-name">${escapeHtml(p.fullName)}</h1>
    <div class="r-contact">${contactLine(p)}</div>
    <div class="r-contact">${linksLine(p)}</div>
  </header>
  ${section('Professional Summary', resume.summary ? `<p class="r-summary">${escapeHtml(resume.summary)}</p>` : '')}
  ${section('Education', renderEducation(resume.education, resume.certifications, resume.coursework))}
  ${section('Technical Skills', renderSkills(resume.skills || {}))}
  ${section('Professional Experience', renderExperience(resume.experience))}
  ${section('Key Projects', renderProjects(resume.projects))}
  ${section('Languages', renderLanguages(resume.languages))}
</article>`;
}

// Flat text version — used later for the match-score feature, and handy for debugging.
function renderResumeText(resume) {
  const p = resume.personalInfo || {};
  const lines = [p.fullName, [p.email, p.phone, p.location].filter(Boolean).join(' '), resume.summary || ''];

  (resume.education || []).forEach((e) => lines.push(`${e.institution} ${e.degree}`));
  (resume.certifications || []).forEach((c) => lines.push(c.name));
  if (resume.coursework && resume.coursework.length) lines.push(resume.coursework.join(', '));

  (resume.skills && resume.skills.categories ? resume.skills.categories : []).forEach((c) => {
    if (c.items && c.items.length) lines.push(`${c.name}: ${c.items.join(', ')}`);
  });

  (resume.experience || []).forEach((e) => {
    lines.push(`${e.title} ${e.company}`);
    (e.bullets || []).forEach((b) => lines.push(b));
  });

  (resume.projects || []).forEach((pr) => {
    lines.push(`${pr.name} ${(pr.technologies || []).join(', ')}`);
    (pr.bullets || []).forEach((b) => lines.push(b));
  });

  return lines.filter(Boolean).join('\n');
}

module.exports = { renderResumeHtml, renderResumeText, escapeHtml, toUrl };
