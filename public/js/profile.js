Auth.requirePage();

document.getElementById('signout-btn').addEventListener('click', Auth.signOut);

// ---------- Template cloning ----------

function addEntry(containerId, templateId) {
  const container = document.getElementById(containerId);
  const template = document.getElementById(templateId);
  const node = template.content.firstElementChild.cloneNode(true);
  container.appendChild(node);
  initEntryCard(node);
  return node;
}

function initEntryCard(cardEl) {
  const removeBtn = cardEl.querySelector(':scope > .entry-card-header > .btn-remove, :scope > .btn-remove');
  if (removeBtn) {
    removeBtn.addEventListener('click', () => cardEl.remove());
  }

  cardEl.querySelectorAll('.tag-input').forEach(initTagInput);

  const addBulletBtn = cardEl.querySelector('.btn-add-bullet');
  if (addBulletBtn) {
    const bulletsList = cardEl.querySelector('.bullets-list');
    addBulletBtn.addEventListener('click', () => addBulletRow(bulletsList));
  }
}

function addBulletRow(bulletsList, text) {
  const template = document.getElementById('bullet-row-template');
  const node = template.content.firstElementChild.cloneNode(true);
  if (text) node.querySelector('textarea').value = text;
  node.querySelector('.btn-remove-bullet').addEventListener('click', () => node.remove());
  bulletsList.appendChild(node);
}

// ---------- Tag inputs (chips) ----------

function initTagInput(wrapperEl) {
  if (wrapperEl.dataset.tagInputReady) return;
  wrapperEl.dataset.tagInputReady = 'true';

  const entryEl = wrapperEl.querySelector('.tag-entry');

  entryEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag(wrapperEl, entryEl.value);
      entryEl.value = '';
    }
  });

  entryEl.addEventListener('blur', () => {
    if (entryEl.value.trim()) {
      addTag(wrapperEl, entryEl.value);
      entryEl.value = '';
    }
  });
}

function addTag(wrapperEl, text) {
  const value = text.trim();
  if (!value) return;
  const tag = document.createElement('span');
  tag.className = 'tag';
  tag.textContent = value;
  const removeBtn = document.createElement('button');
  removeBtn.type = 'button';
  removeBtn.textContent = '✕';
  removeBtn.addEventListener('click', () => tag.remove());
  tag.appendChild(removeBtn);
  wrapperEl.querySelector('.tags').appendChild(tag);
}

function setTags(wrapperEl, tags) {
  wrapperEl.querySelector('.tags').innerHTML = '';
  (tags || []).forEach((t) => addTag(wrapperEl, t));
}

function getTags(wrapperEl) {
  return Array.from(wrapperEl.querySelectorAll('.tags .tag')).map(
    (tag) => tag.firstChild.textContent
  );
}

function getBullets(cardEl) {
  return Array.from(cardEl.querySelectorAll('.bullets-list textarea'))
    .map((t) => t.value.trim())
    .filter(Boolean);
}

// ---------- Add-entry buttons ----------

const CONTAINER_ID = {
  education: 'education-list',
  certification: 'certifications-list',
  experience: 'experience-list',
  project: 'projects-list',
  language: 'languages-list',
};

document.querySelectorAll('[data-add]').forEach((btn) => {
  btn.addEventListener('click', () => {
    const type = btn.dataset.add;
    addEntry(CONTAINER_ID[type], `${type}-template`);
  });
});

// ---------- Skills / coursework tag inputs (static, not templated) ----------

initTagInput(document.getElementById('skills-programming'));
initTagInput(document.getElementById('skills-frameworks'));
initTagInput(document.getElementById('coursework'));

// ---------- Serialize form -> ResumeProfile JSON ----------

function fieldValue(cardEl, fieldName) {
  const el = cardEl.querySelector(`[data-field="${fieldName}"]`);
  return el ? el.value.trim() : '';
}

function serializeForm() {
  const profile = {
    personalInfo: {
      fullName: document.getElementById('fullName').value.trim(),
      email: document.getElementById('email').value.trim(),
      phone: document.getElementById('phone').value.trim(),
      location: document.getElementById('location').value.trim(),
      linkedin: document.getElementById('linkedin').value.trim(),
      github: document.getElementById('github').value.trim(),
    },
    summary: document.getElementById('summary').value.trim(),
    skills: {
      categories: [
        { name: 'Programming Languages', items: getTags(document.getElementById('skills-programming')) },
        { name: 'Frameworks/Tools', items: getTags(document.getElementById('skills-frameworks')) },
      ],
    },
    education: [],
    certifications: [],
    coursework: getTags(document.getElementById('coursework')),
    experience: [],
    projects: [],
    languages: [],
  };

  document.querySelectorAll('#education-list .entry-card').forEach((card) => {
    profile.education.push({
      institution: fieldValue(card, 'institution'),
      location: fieldValue(card, 'location'),
      degree: fieldValue(card, 'degree'),
      gpa: fieldValue(card, 'gpa'),
      startDate: fieldValue(card, 'startDate'),
      endDate: fieldValue(card, 'endDate'),
    });
  });

  document.querySelectorAll('#certifications-list .entry-card').forEach((card) => {
    profile.certifications.push({
      name: fieldValue(card, 'name'),
      issuer: fieldValue(card, 'issuer'),
    });
  });

  document.querySelectorAll('#experience-list .entry-card').forEach((card) => {
    profile.experience.push({
      company: fieldValue(card, 'company'),
      location: fieldValue(card, 'location'),
      title: fieldValue(card, 'title'),
      startDate: fieldValue(card, 'startDate'),
      endDate: fieldValue(card, 'endDate'),
      bullets: getBullets(card),
    });
  });

  document.querySelectorAll('#projects-list .entry-card').forEach((card) => {
    profile.projects.push({
      name: fieldValue(card, 'name'),
      link: fieldValue(card, 'link'),
      technologies: getTags(card.querySelector('.tag-input')),
      bullets: getBullets(card),
    });
  });

  document.querySelectorAll('#languages-list .entry-card').forEach((card) => {
    profile.languages.push({
      name: fieldValue(card, 'name'),
      proficiency: fieldValue(card, 'proficiency'),
    });
  });

  return profile;
}

// ---------- Populate form <- saved ResumeProfile JSON ----------

function populateForm(profile) {
  const p = profile.personalInfo || {};
  document.getElementById('fullName').value = p.fullName || '';
  document.getElementById('email').value = p.email || '';
  document.getElementById('phone').value = p.phone || '';
  document.getElementById('location').value = p.location || '';
  document.getElementById('linkedin').value = p.linkedin || '';
  document.getElementById('github').value = p.github || '';
  document.getElementById('summary').value = profile.summary || '';

  const categories = (profile.skills && profile.skills.categories) || [];
  const programming = categories.find((c) => c.name === 'Programming Languages');
  const frameworks = categories.find((c) => c.name === 'Frameworks/Tools');
  setTags(document.getElementById('skills-programming'), programming ? programming.items : []);
  setTags(document.getElementById('skills-frameworks'), frameworks ? frameworks.items : []);
  setTags(document.getElementById('coursework'), profile.coursework || []);

  (profile.education || []).forEach((entry) => {
    const card = addEntry('education-list', 'education-template');
    Object.keys(entry).forEach((key) => {
      const el = card.querySelector(`[data-field="${key}"]`);
      if (el) el.value = entry[key];
    });
  });

  (profile.certifications || []).forEach((entry) => {
    const card = addEntry('certifications-list', 'certification-template');
    Object.keys(entry).forEach((key) => {
      const el = card.querySelector(`[data-field="${key}"]`);
      if (el) el.value = entry[key];
    });
  });

  (profile.experience || []).forEach((entry) => {
    const card = addEntry('experience-list', 'experience-template');
    ['company', 'location', 'title', 'startDate', 'endDate'].forEach((key) => {
      const el = card.querySelector(`[data-field="${key}"]`);
      if (el) el.value = entry[key] || '';
    });
    const bulletsList = card.querySelector('.bullets-list');
    (entry.bullets || []).forEach((text) => addBulletRow(bulletsList, text));
  });

  (profile.projects || []).forEach((entry) => {
    const card = addEntry('projects-list', 'project-template');
    ['name', 'link'].forEach((key) => {
      const el = card.querySelector(`[data-field="${key}"]`);
      if (el) el.value = entry[key] || '';
    });
    setTags(card.querySelector('.tag-input'), entry.technologies || []);
    const bulletsList = card.querySelector('.bullets-list');
    (entry.bullets || []).forEach((text) => addBulletRow(bulletsList, text));
  });

  (profile.languages || []).forEach((entry) => {
    const card = addEntry('languages-list', 'language-template');
    ['name', 'proficiency'].forEach((key) => {
      const el = card.querySelector(`[data-field="${key}"]`);
      if (el) el.value = entry[key] || '';
    });
  });
}

// ---------- Save / load ----------

function setStatus(message, isError) {
  const status = document.getElementById('save-status');
  status.textContent = message;
  status.classList.toggle('is-error', Boolean(isError));
}

const saveBtn = document.getElementById('save-btn');

saveBtn.addEventListener('click', async () => {
  saveBtn.disabled = true;
  setStatus('Saving...');
  try {
    await api.saveProfile(serializeForm());
    setStatus('Saved');
    setTimeout(() => setStatus(''), 3000);
  } catch (err) {
    setStatus(err.message, true);
  } finally {
    saveBtn.disabled = false;
  }
});

function addBlankStarterEntries() {
  addEntry('education-list', 'education-template');
  addEntry('experience-list', 'experience-template');
  addEntry('projects-list', 'project-template');
  addEntry('languages-list', 'language-template');
}

(async () => {
  try {
    const profile = await api.getProfile();
    const hasContent =
      profile.personalInfo.fullName ||
      profile.experience.length ||
      profile.education.length ||
      profile.projects.length;

    if (hasContent) {
      populateForm(profile);
    } else {
      // A brand-new profile: start with one blank entry per repeatable section
      // so the form isn't an empty page of buttons.
      populateForm(profile);
      addBlankStarterEntries();
    }
  } catch (err) {
    setStatus(err.message, true);
    addBlankStarterEntries();
  }
})();
