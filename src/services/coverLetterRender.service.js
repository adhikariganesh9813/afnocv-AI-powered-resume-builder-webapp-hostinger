const { escapeHtml } = require('./resumeRender.service');

// The letter's factual furniture — sender details, date, signature — is built
// here rather than by the model, so it can never be garbled or invented.

function formatDate(date) {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

// "Acme Corp" + "Backend Engineer" -> a recipient line, when the posting named them.
function recipientLines(letter) {
  const lines = [];
  if (letter.roleTitle) lines.push(`Re: ${letter.roleTitle}`);
  if (letter.companyName) lines.push(letter.companyName);
  return lines;
}

function renderCoverLetterHtml(letter, personalInfo = {}, createdAt = new Date()) {
  const contact = [personalInfo.email, personalInfo.phone, personalInfo.location]
    .filter(Boolean)
    .map(escapeHtml)
    .join(' | ');

  const recipient = recipientLines(letter)
    .map((line) => `<div>${escapeHtml(line)}</div>`)
    .join('');

  const body = (letter.paragraphs || [])
    .map((p) => `<p class="cl-paragraph">${escapeHtml(p)}</p>`)
    .join('');

  return `<article class="cover-letter">
  <header class="cl-header">
    <h1 class="cl-name">${escapeHtml(letter.fullName || personalInfo.fullName)}</h1>
    ${contact ? `<div class="cl-contact">${contact}</div>` : ''}
  </header>

  <div class="cl-date">${escapeHtml(formatDate(createdAt))}</div>

  ${recipient ? `<div class="cl-recipient">${recipient}</div>` : ''}

  <div class="cl-greeting">${escapeHtml(letter.greeting || 'Dear Hiring Manager,')}</div>

  ${body}

  <div class="cl-closing">
    <div>${escapeHtml(letter.closing || 'Sincerely,')}</div>
    <div class="cl-signature">${escapeHtml(letter.fullName || personalInfo.fullName)}</div>
  </div>
</article>`;
}

// Plain text version — used by the match-score feature later.
function renderCoverLetterText(letter) {
  return [letter.greeting, ...(letter.paragraphs || []), letter.closing, letter.fullName]
    .filter(Boolean)
    .join('\n\n');
}

module.exports = { renderCoverLetterHtml, renderCoverLetterText, formatDate, recipientLines };
