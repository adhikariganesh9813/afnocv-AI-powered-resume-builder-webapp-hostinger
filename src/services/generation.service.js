const { query } = require('../config/db');
const profileService = require('./profile.service');
const deepseek = require('./deepseek.service');
const resumePrompt = require('../prompts/resume.prompt');
const coverLetterPrompt = require('../prompts/coverLetter.prompt');

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

  const chosen = (ai.skills && Array.isArray(ai.skills.categories) ? ai.skills.categories : [])
    .filter((c) => c && SKILL_CATEGORIES.includes(c.name))
    .map((c) => ({ name: c.name, items: toStringArray(c.items).filter(isRealSkill) }));

  // The model selects which skills are worth showing; the profile decides the
  // order. Re-sorting here means its selection can never double as reordering.
  const skills = {
    categories: SKILL_CATEGORIES.map((name) => {
      const fromProfile = (profile.skills.categories || []).find((c) => c.name === name);
      const profileItems = fromProfile ? fromProfile.items : [];
      const fromAi = chosen.find((c) => c.name === name);
      if (!fromAi || !fromAi.items.length) return { name, items: profileItems };

      const keep = new Set(fromAi.items.map((i) => i.toLowerCase()));
      const items = profileItems.filter((i) => keep.has(i.toLowerCase()));
      return { name, items: items.length ? items : profileItems };
    }),
  };

  // Same treatment for coursework: filter to what the model kept, in profile order.
  const courseworkKeep = new Set(toStringArray(ai.coursework).map((c) => c.toLowerCase()));
  const coursework = courseworkKeep.size
    ? (profile.coursework || []).filter((c) => courseworkKeep.has(c.toLowerCase()))
    : profile.coursework || [];

  // Experience and projects are matched back to the profile by position so the
  // AI cannot add, drop, or reattribute a role — only its bullets are taken.
  const experience = profile.experience.map((original, i) => {
    const generated = Array.isArray(ai.experience) ? ai.experience[i] : null;
    const bullets = generated ? toStringArray(generated.bullets) : [];
    return { ...original, bullets: bullets.length ? bullets : original.bullets };
  });

  const projects = profile.projects
    .map((original, i) => {
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
        // Missing flag means keep it: dropping content needs a deliberate signal.
        include: !generated || generated.include !== false,
      };
    })
    .filter((p) => p.include)
    .map(({ include, ...project }) => project);

  // Never return an empty projects section just because the model rejected
  // everything — fall back to what the profile had.
  const finalProjects = projects.length ? projects : profile.projects;

  return {
    // personalInfo, education, certifications, coursework and languages are
    // taken straight from the profile — the AI never sees or supplies them.
    personalInfo: profile.personalInfo,
    summary: typeof ai.summary === 'string' && ai.summary.trim() ? ai.summary.trim() : profile.summary,
    skills,
    education: profile.education,
    certifications: profile.certifications,
    coursework,
    experience,
    projects: finalProjects,
    languages: profile.languages,
    keywordsUsed: toStringArray(ai.keywordsUsed),
    keywordsMissing: toStringArray(ai.keywordsMissing),
  };
}

// The letter is mostly free text, so there is less to enforce structurally than
// with the resume — but the shape still has to be right before it reaches a
// template, and the model must not invent a company or role the posting never named.
function normalizeCoverLetter(ai, profile) {
  const paragraphs = toStringArray(ai && ai.paragraphs).map((p) => p.trim());

  if (!paragraphs.length) {
    const err = new Error('The AI returned an empty cover letter. Please try again.');
    err.status = 502;
    err.expose = true;
    throw err;
  }

  const text = (value, fallback = '') =>
    typeof value === 'string' && value.trim() ? value.trim() : fallback;

  return {
    fullName: profile.personalInfo.fullName,
    companyName: text(ai.companyName),
    roleTitle: text(ai.roleTitle),
    greeting: text(ai.greeting, 'Dear Hiring Manager,'),
    paragraphs,
    closing: text(ai.closing, 'Sincerely,'),
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

  // Sequential, not parallel: the letter is written from the FINISHED resume, so
  // it argues for the document the employer will actually read and never raises
  // material that was trimmed out of it. Costs roughly double the wall-clock time
  // of running both at once, which is the price of the two staying consistent.
  const resumeResponse = await deepseek.chatJson({
    system: resumePrompt.SYSTEM_PROMPT,
    user: resumePrompt.buildUserPrompt({ profile, jobDescription: jd, resumeType }),
    // Low but non-zero: tailoring needs some flexibility of phrasing, while
    // staying well away from the creativity that invites invented facts.
    temperature: 0.3,
  });

  const resume = normalizeAiOutput(resumeResponse.json, profile);

  const letterResponse = await deepseek.chatJson({
    system: coverLetterPrompt.SYSTEM_PROMPT,
    user: coverLetterPrompt.buildUserPrompt({ resume, jobDescription: jd, resumeType }),
    // Slightly higher than the resume: prose reads badly when it is too rigid,
    // and the factual claims here are constrained by the prompt rather than by
    // structure, so the extra latitude affects wording rather than content.
    temperature: 0.5,
  });

  const coverLetter = normalizeCoverLetter(letterResponse.json, profile);

  // Both documents live in generated_json: they are produced together, replaced
  // wholesale on each run, and never queried field by field — the same reasoning
  // that kept the resume out of normalised tables. No schema change needed.
  const result = await query(
    `INSERT INTO generations (user_id, profile_id, resume_type, generated_json)
     VALUES (?, (SELECT id FROM profiles WHERE user_id = ?), ?, ?)`,
    [userId, userId, resumeType, JSON.stringify({ ...resume, coverLetter })]
  );

  const tokens = [resumeResponse.usage, letterResponse.usage]
    .filter(Boolean)
    .reduce((sum, u) => sum + (u.prompt_tokens || 0) + (u.completion_tokens || 0), 0);
  if (tokens) console.log(`Generation ${result.insertId}: ${tokens} tokens total`);

  return { id: result.insertId, resumeType, resume, coverLetter };
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
  // mysql2 returns JSON columns already parsed; older setups hand back a string.
  const stored =
    typeof row.generated_json === 'string' ? JSON.parse(row.generated_json) : row.generated_json;

  // The cover letter is stored alongside the resume fields; split them back out
  // so callers get the same shape `generate()` returns. Generations created
  // before cover letters existed simply have none.
  const { coverLetter = null, ...resume } = stored;

  return {
    id: row.id,
    resumeType: row.resume_type,
    resume,
    coverLetter,
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
