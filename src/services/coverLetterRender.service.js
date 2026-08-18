const { escapeHtml } = require('./resumeRender.service');

// The letter opens straight at the greeting: no letterhead, date or address
// block. The resume it is sent with already carries the candidate's name and
// contact details, and repeating them wastes the single page the letter gets.

function renderCoverLetterHtml(letter) {
  const body = (letter.paragraphs || [])
    .map((p) => `<p class="cl-paragraph">${escapeHtml(p)}</p>`)
    .join('');

  return `<article class="cover-letter">
  <div class="cl-greeting">${escapeHtml(letter.greeting || 'Dear Hiring Manager,')}</div>

  ${body}

  <div class="cl-closing">${escapeHtml(letter.closing || 'Sincerely,')}</div>
  <div class="cl-signature">${escapeHtml(letter.fullName || '')}</div>
</article>`;
}

// Plain text version — used by the match-score feature later.
function renderCoverLetterText(letter) {
  return [letter.greeting, ...(letter.paragraphs || []), letter.closing, letter.fullName]
    .filter(Boolean)
    .join('\n\n');
}

module.exports = { renderCoverLetterHtml, renderCoverLetterText };
