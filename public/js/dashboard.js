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
      !profile.personalInfo.fullName &&
      profile.experience.length === 0 &&
      profile.education.length === 0;
    if (isEmpty) document.getElementById('profile-warning').hidden = false;
  } catch (err) {
    // A failure here shouldn't block the page; the generate step will surface it.
  }
})();

generateBtn.addEventListener('click', () => {
  const jobDescription = jdInput.value.trim();
  const resumeType = document.querySelector('input[name="resumeType"]:checked').value;

  if (jobDescription.length < 50) {
    generateNote.textContent = 'Paste a job description first (at least 50 characters).';
    generateNote.className = 'generate-note is-error';
    return;
  }

  // Generation itself is the next feature to be built (see docs/PROJECT.md).
  generateNote.textContent = `Ready to generate — "${resumeType}" mode. The generation step is not built yet.`;
  generateNote.className = 'generate-note';
});
