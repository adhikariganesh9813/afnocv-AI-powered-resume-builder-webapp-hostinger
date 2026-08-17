Auth.requirePage();

document.getElementById('signout-btn').addEventListener('click', Auth.signOut);

const jdInput = document.getElementById('job-description');
const jdCount = document.getElementById('jd-count');
const generateBtn = document.getElementById('generate-btn');
const generateNote = document.getElementById('generate-note');

jdInput.addEventListener('input', () => {
  jdCount.textContent = `${jdInput.value.length} characters`;
});

// Warn early if there's nothing to build a resume from.
(async () => {
  try {
    const profile = await api.getProfile();
    const isEmpty =
      !profile.personalInfo.fullName ||
      (profile.experience.length === 0 && profile.projects.length === 0);
    if (isEmpty) document.getElementById('profile-warning').hidden = false;
  } catch (err) {
    // A failure here shouldn't block the page; generating will surface it.
  }
})();

function setNote(message, isError) {
  generateNote.textContent = message;
  generateNote.className = isError ? 'generate-note is-error' : 'generate-note';
}

generateBtn.addEventListener('click', async () => {
  const jobDescription = jdInput.value.trim();
  const resumeType = document.querySelector('input[name="resumeType"]:checked').value;

  if (jobDescription.length < 50) {
    setNote('Paste a job description first (at least 50 characters).', true);
    return;
  }

  generateBtn.disabled = true;
  generateBtn.textContent = 'Generating...';
  setNote('Tailoring your resume. This usually takes 15-40 seconds.');

  try {
    const result = await api.generate({ jobDescription, resumeType });
    window.location.href = `/result.html?id=${result.id}`;
  } catch (err) {
    setNote(err.message, true);
    generateBtn.disabled = false;
    generateBtn.textContent = 'Generate Resume';
  }
});
