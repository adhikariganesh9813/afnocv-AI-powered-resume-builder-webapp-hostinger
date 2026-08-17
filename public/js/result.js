Auth.requirePage();

document.getElementById('signout-btn').addEventListener('click', Auth.signOut);

const RESUME_TYPE_LABELS = {
  natural: 'Natural',
  basic_match: 'Basic Match',
  max_match: 'Max Match',
  ultra_match: 'Ultra Match',
};

const generationId = new URLSearchParams(window.location.search).get('id');

const resumeSheet = document.getElementById('resume-sheet');
const coverSheet = document.getElementById('cover-sheet');
const meta = document.getElementById('result-meta');
const errorBox = document.getElementById('result-error');

function showError(message) {
  errorBox.textContent = message;
  errorBox.hidden = false;
}

function escapeHtml(value) {
  const div = document.createElement('div');
  div.textContent = value;
  return div.innerHTML;
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

// Downloads need the auth header, so they're fetched as a blob rather than
// opened as a plain link.
async function download(path, button) {
  const originalText = button.textContent;
  button.disabled = true;
  button.textContent = '...';

  try {
    const response = await fetch(`/api/generate/${generationId}/download/${path}`, {
      headers: { Authorization: `Bearer ${Auth.getToken()}` },
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || 'Download failed.');
    }

    const disposition = response.headers.get('Content-Disposition') || '';
    const match = disposition.match(/filename="([^"]+)"/);
    const filename = match ? match[1] : `document.${path.split('/')[1]}`;

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

const downloadButtons = document.querySelectorAll('[data-download]');
downloadButtons.forEach((btn) => {
  btn.addEventListener('click', () => download(btn.dataset.download, btn));
});

(async () => {
  if (!generationId) {
    showError('No application selected. Generate one from the dashboard.');
    resumeSheet.innerHTML = '';
    coverSheet.innerHTML = '';
    return;
  }

  try {
    const data = await api.getGeneration(generationId);

    resumeSheet.innerHTML = data.html;

    if (data.coverLetterHtml) {
      coverSheet.innerHTML = data.coverLetterHtml;
    } else {
      // Generations created before cover letters existed have none.
      coverSheet.innerHTML =
        '<div class="doc-loading">No cover letter for this application. Generate a new one to get both documents.</div>';
      document.querySelectorAll('[data-download^="cover"]').forEach((b) => (b.hidden = true));
    }

    const created = new Date(data.createdAt);
    meta.textContent = `${RESUME_TYPE_LABELS[data.resumeType] || data.resumeType} · generated ${created.toLocaleString()}`;

    renderKeywords(data.resume);

    downloadButtons.forEach((btn) => {
      if (btn.dataset.download.startsWith('cover') && !data.coverLetterHtml) return;
      btn.disabled = false;
    });
  } catch (err) {
    showError(err.message);
    meta.textContent = '';
    resumeSheet.innerHTML = '';
    coverSheet.innerHTML = '';
  }
})();
