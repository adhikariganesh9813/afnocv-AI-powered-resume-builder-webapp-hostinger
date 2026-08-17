Auth.requirePage();

document.getElementById('signout-btn').addEventListener('click', Auth.signOut);

const RESUME_TYPE_LABELS = {
  natural: 'Natural',
  basic_match: 'Basic Match',
  max_match: 'Max Match',
  ultra_match: 'Ultra Match',
};

const params = new URLSearchParams(window.location.search);
const generationId = params.get('id');

const sheet = document.getElementById('resume-sheet');
const meta = document.getElementById('result-meta');
const errorBox = document.getElementById('result-error');
const docxBtn = document.getElementById('download-docx');
const pdfBtn = document.getElementById('download-pdf');

function showError(message) {
  errorBox.textContent = message;
  errorBox.hidden = false;
  document.getElementById('resume-loading')?.remove();
}

function renderKeywords(resume) {
  const used = resume.keywordsUsed || [];
  const missing = resume.keywordsMissing || [];
  if (!used.length && !missing.length) return;

  document.getElementById('keywords').hidden = false;

  if (used.length) {
    document.getElementById('kw-used-group').hidden = false;
    document.getElementById('kw-used').innerHTML = used
      .map((k) => `<span class="keyword-tag">${escapeHtml(k)}</span>`)
      .join('');
  }
  if (missing.length) {
    document.getElementById('kw-missing-group').hidden = false;
    document.getElementById('kw-missing').innerHTML = missing
      .map((k) => `<span class="keyword-tag">${escapeHtml(k)}</span>`)
      .join('');
  }
}

function escapeHtml(value) {
  const div = document.createElement('div');
  div.textContent = value;
  return div.innerHTML;
}

// Downloads need the auth header, so they're fetched as a blob rather than
// opened as a plain link.
async function download(kind, button) {
  const originalText = button.textContent;
  button.disabled = true;
  button.textContent = 'Preparing...';

  try {
    const response = await fetch(`/api/generate/${generationId}/download/${kind}`, {
      headers: { Authorization: `Bearer ${Auth.getToken()}` },
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || 'Download failed.');
    }

    const disposition = response.headers.get('Content-Disposition') || '';
    const match = disposition.match(/filename="([^"]+)"/);
    const filename = match ? match[1] : `resume.${kind}`;

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  } catch (err) {
    showError(err.message);
  } finally {
    button.disabled = false;
    button.textContent = originalText;
  }
}

docxBtn.addEventListener('click', () => download('docx', docxBtn));
pdfBtn.addEventListener('click', () => download('pdf', pdfBtn));

(async () => {
  if (!generationId) {
    showError('No resume selected. Generate one from the dashboard.');
    return;
  }

  try {
    const data = await api.getGeneration(generationId);
    sheet.innerHTML = data.html;

    const created = new Date(data.createdAt);
    meta.textContent = `${RESUME_TYPE_LABELS[data.resumeType] || data.resumeType} · generated ${created.toLocaleString()}`;

    renderKeywords(data.resume);
    docxBtn.disabled = false;
    pdfBtn.disabled = false;
  } catch (err) {
    showError(err.message);
    meta.textContent = '';
  }
})();
