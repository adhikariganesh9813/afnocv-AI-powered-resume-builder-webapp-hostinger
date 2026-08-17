const { query } = require('../config/db');
const profileService = require('./profile.service');
const deepseek = require('./deepseek.service');
const { SYSTEM_PROMPT, buildUserPrompt } = require('../prompts/resume.prompt');

const RESUME_TYPES = ['natural', 'basic_match', 'max_match', 'ultra_match'];
const SKILL_CATEGORIES = ['Programming Languages', 'Frameworks/Tools'];

function badRequest(message) {
  const err = new Error(message);
  err.status = 400;
  throw err;
}

function toStringArray(value) {
  return Array.isArray(value) ? value.filter((v) => typeof v === 'string' && v.trim()) : [];
}

// The model can return valid JSON that still doesn't match our schema, so every
// field is checked and normalised before it reaches the database or a template.
function normalizeAiOutput(ai, profile) {
  if (!ai || typeof ai !== 'object') {
    const err = new Error('The AI returned an unexpected response. Please try again.');
    err.status = 502;
    err.expose = true;
    throw err;
  }

  // The model may reorder skills for relevance, but may not introduce one the
  // candidate never listed — that would claim experience they don't have.
  // Matching is done across both categories, since it may also recategorise.
  const profileSkills = (profile.skills.categories || []).flatMap((c) => c.items || []);
  const isRealSkill = (item) => profileSkills.some((p) => p.toLowerCase() === item.toLowerCase());

  const categories = (ai.skills && Array.isArray(ai.skills.categories) ? ai.skills.categories : [])
    .filter((c) => c && SKILL_CATEGORIES.includes(c.name))
    .map((c) => ({ name: c.name, items: toStringArray(c.items).filter(isRealSkill) }));

  // Guarantee both categories exist, falling back to the profile's own values.
  const skills = {
    categories: SKILL_CATEGORIES.map((name) => {
      const fromAi = categories.find((c) => c.name === name);
      if (fromAi && fromAi.items.length) return fromAi;
      const fromProfile = (profile.skills.categories || []).find((c) => c.name === name);
      return { name, items: fromProfile ? fromProfile.items : [] };
    }),
  };

  // Experience and projects are matched back to the profile by position so the
  // AI cannot add, drop, or reattribute a role — only its bullets are taken.
  const experience = profile.experience.map((original, i) => {
    const generated = Array.isArray(ai.experience) ? ai.experience[i] : null;
    const bullets = generated ? toStringArray(generated.bullets) : [];
    return { ...original, bullets: bullets.length ? bullets : original.bullets };
  });

  const projects = profile.projects.map((original, i) => {
    const generated = Array.isArray(ai.projects) ? ai.projects[i] : null;
    const bullets = generated ? toStringArray(generated.bullets) : [];
    // Only technologies the profile already lists are allowed through.
    const techFromAi = generated ? toStringArray(generated.technologies) : [];
    const allowed = techFromAi.filter((t) =>
      original.technologies.some((o) => o.toLowerCase() === t.toLowerCase())
    );
    return {
      ...original,
      technologies: allowed.length ? allowed : original.technologies,
      bullets: bullets.length ? bullets : original.bullets,
    };
  });

  return {
    // personalInfo, education, certifications, coursework and languages are
    // taken straight from the profile — the AI never sees or supplies them.
    personalInfo: profile.personalInfo,
    summary: typeof ai.summary === 'string' && ai.summary.trim() ? ai.summary.trim() : profile.summary,
    skills,
    education: profile.education,
    certifications: profile.certifications,
    coursework: profile.coursework,
    experience,
    projects,
    languages: profile.languages,
    keywordsUsed: toStringArray(ai.keywordsUsed),
    keywordsMissing: toStringArray(ai.keywordsMissing),
  };
}

async function generate(userId, { jobDescription, resumeType }) {
  const jd = typeof jobDescription === 'string' ? jobDescription.trim() : '';

  if (jd.length < 50) badRequest('Paste a job description first (at least 50 characters).');
  if (jd.length > 20000) badRequest('That job description is too long. Trim it to the role details.');
  if (!RESUME_TYPES.includes(resumeType)) badRequest('Choose a valid resume type.');

  const profile = await profileService.getProfile(userId);

  if (!profile.personalInfo.fullName) {
    badRequest('Add your name on the profile page before generating a resume.');
  }
  if (profile.experience.length === 0 && profile.projects.length === 0) {
    badRequest('Add at least one experience or project on the profile page first.');
  }

  const { json, usage } = await deepseek.chatJson({
    system: SYSTEM_PROMPT,
    user: buildUserPrompt({ profile, jobDescription: jd, resumeType }),
    // Low but non-zero: tailoring needs some flexibility of phrasing, while
    // staying well away from the creativity that invites invented facts.
    temperature: 0.3,
  });

  const resume = normalizeAiOutput(json, profile);

  const result = await query(
    `INSERT INTO generations (user_id, profile_id, resume_type, generated_json)
     VALUES (?, (SELECT id FROM profiles WHERE user_id = ?), ?, ?)`,
    [userId, userId, resumeType, JSON.stringify(resume)]
  );

  if (usage) {
    console.log(
      `Generation ${result.insertId}: ${usage.prompt_tokens} prompt + ${usage.completion_tokens} completion tokens`
    );
  }

  return { id: result.insertId, resumeType, resume };
}

async function getGeneration(userId, generationId) {
  const rows = await query(
    'SELECT id, resume_type, generated_json, match_score, created_at FROM generations WHERE id = ? AND user_id = ?',
    [generationId, userId]
  );

  if (rows.length === 0) {
    const err = new Error('Generated resume not found.');
    err.status = 404;
    throw err;
  }

  const row = rows[0];
  return {
    id: row.id,
    resumeType: row.resume_type,
    // mysql2 returns JSON columns already parsed; older setups hand back a string.
    resume: typeof row.generated_json === 'string' ? JSON.parse(row.generated_json) : row.generated_json,
    matchScore: row.match_score,
    createdAt: row.created_at,
  };
}

async function listGenerations(userId) {
  const rows = await query(
    'SELECT id, resume_type, match_score, created_at FROM generations WHERE user_id = ? ORDER BY id DESC LIMIT 20',
    [userId]
  );
  return rows.map((r) => ({
    id: r.id,
    resumeType: r.resume_type,
    matchScore: r.match_score,
    createdAt: r.created_at,
  }));
}

module.exports = { generate, getGeneration, listGenerations, RESUME_TYPES };
