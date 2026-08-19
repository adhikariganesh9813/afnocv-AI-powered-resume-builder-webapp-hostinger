const { query } = require('../config/db');
const profileService = require('./profile.service');
const deepseek = require('./deepseek.service');
const resumePrompt = require('../prompts/resume.prompt');
const coverLetterPrompt = require('../prompts/coverLetter.prompt');

// Three levels, not four. "ultra_match" was folded into max_match, which is now
// the strongest alignment available. The database enum still lists ultra_match so
// that generations created before the change remain readable; it is simply no
// longer an accepted input.
const RESUME_TYPES = ['natural', 'basic_match', 'max_match'];

const RESUME_TYPE_TEMPERATURE = {
  natural: 0,
  basic_match: 0.35,
  max_match: 0.5,
};
const SKILL_CATEGORIES = ['Programming Languages', 'Frameworks/Tools'];

function badRequest(message) {
  const err = new Error(message);
  err.status = 400;
  throw err;
}

function toStringArray(value) {
  return Array.isArray(value) ? value.filter((v) => typeof v === 'string' && v.trim()) : [];
}

// Fraction of words two passages share, ignoring case and punctuation.
// 1 means the same words in the same quantities, 0 means nothing in common.
// Deliberately crude: it only has to tell "reworded" from "barely touched".
function wordSimilarity(a, b) {
  const words = (text) =>
    String(text || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .split(' ')
      .filter(Boolean);

  const left = words(a);
  const right = words(b);
  if (!left.length || !right.length) return 0;

  const remaining = new Map();
  right.forEach((word) => remaining.set(word, (remaining.get(word) || 0) + 1));

  let shared = 0;
  left.forEach((word) => {
    const count = remaining.get(word) || 0;
    if (count > 0) {
      shared += 1;
      remaining.set(word, count - 1);
    }
  });

  return shared / Math.max(left.length, right.length);
}

// Role nouns a summary uses to state what the candidate *is*. "engineering" and
// similar gerunds are excluded on purpose: describing the work is allowed, it is
// claiming the identity that is not.
const ROLE_NOUNS = [
  'engineer',
  'developer',
  'analyst',
  'scientist',
  'architect',
  'administrator',
  'consultant',
  'specialist',
  'programmer',
];

// Finds job titles the summary claims that the candidate does not actually hold.
//
// The model kept opening summaries with "Data engineer" for a candidate whose
// only title is "Software Engineer" — a good fit for the posting and a plain
// fabrication. Titles are checked against the profile's real ones; anything else
// is reported so the caller can ask again.
function inventedTitles(summary, profile) {
  const text = String(summary || '');
  if (!text.trim()) return [];

  const held = (profile.experience || [])
    .map((e) => String(e.title || '').toLowerCase())
    .filter(Boolean);

  const pattern = new RegExp(`\\b([a-z][\\w-]*)[\\s-]+(${ROLE_NOUNS.join('|')})\\b`, 'gi');
  const found = new Set();

  for (const match of text.matchAll(pattern)) {
    const phrase = `${match[1]} ${match[2]}`.toLowerCase();
    // "senior software engineer" in the profile covers "software engineer" here.
    if (!held.some((title) => title.includes(phrase))) found.add(match[0]);
  }

  // "Data Engineering professional with 2+ years..." is the same fabrication in
  // different clothes, but "professional" cannot simply be banned — it is normal
  // in "professional experience" and appears inside certificate names. So it is
  // only treated as a title when it opens the summary as an identity claim.
  const opening = text.match(/^\s*([\w-]+(?:\s+[\w-]+)?)\s+professional\b/i);
  if (opening) {
    const claimed = opening[1].toLowerCase();
    const isRealField = held.some((title) => title.includes(claimed.replace(/ing\b/, '')));
    if (!isRealField) found.add(opening[0].trim());
  }

  return [...found];
}

// Counts bullets that came back byte-identical to the profile.
//
// Compared bullet by bullet rather than array against array: the model often
// rewrites some bullets and leaves others alone, and a whole-array comparison
// calls that "changed" — which let a resume through with its first, most visible
// bullet untouched. Project bullets count too, and are matched by project name
// because irrelevant projects may have been dropped.
function countUnchangedBullets(resume, profile) {
  let unchanged = 0;
  let total = 0;

  // The summary counts as a rewritable item. It sits at the top of the page and
  // is the first thing a reader compares between two resumes, so leaving it as
  // the profile's own paragraph makes every tailoring level look identical even
  // when the bullets underneath were rewritten properly.
  //
  // Judged by similarity rather than equality: an observed run changed "with a
  // focus on" to "focusing on" and nothing else, which passes an equality test
  // while reading as the same paragraph to anyone comparing two resumes.
  if ((profile.summary || '').trim()) {
    total += 1;
    if (wordSimilarity(resume.summary, profile.summary) >= 0.85) unchanged += 1;
  }

  const compare = (generatedEntry, profileEntry) => {
    (profileEntry.bullets || []).forEach((original, i) => {
      total += 1;
      const produced = generatedEntry && (generatedEntry.bullets || [])[i];
      if (produced === original) unchanged += 1;
    });
  };

  (profile.experience || []).forEach((entry, i) => compare((resume.experience || [])[i], entry));

  (resume.projects || []).forEach((generated) => {
    const original = (profile.projects || []).find((p) => p.name === generated.name);
    if (original) compare(generated, original);
  });

  return { unchanged, total };
}

// The model can return valid JSON that still doesn't match our schema, so every
// field is checked and normalised before it reaches the database or a template.
function normalizeAiOutput(ai, profile, resumeType) {
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

  // Certifications likewise: the model picks which are worth the space, but the
  // rows themselves come from the profile, so a name or issuer can never be
  // altered or invented. An empty selection is honoured — a certification with no
  // bearing on the job is worth dropping — unless the model returned nothing at
  // all, which is treated as "no opinion" rather than "remove them".
  const certKeep = new Set(toStringArray(ai.certifications).map((c) => c.toLowerCase()));
  const certifications = Array.isArray(ai.certifications)
    ? (profile.certifications || []).filter((c) => certKeep.has((c.name || '').toLowerCase()))
    : profile.certifications || [];

  // Experience and projects are matched back to the profile by position so the
  // AI cannot add, drop, or reattribute a role — only its bullets are taken.
  // At "natural" the contract is that wording is untouched, so the profile's own
  // bullets are used directly. Enforcing it here rather than asking the model to
  // copy makes the level exact instead of merely likely.
  const keepOriginalWording = resumeType === 'natural';

  const experience = profile.experience.map((original, i) => {
    if (keepOriginalWording) return { ...original };
    const generated = Array.isArray(ai.experience) ? ai.experience[i] : null;
    const bullets = generated ? toStringArray(generated.bullets) : [];
    return { ...original, bullets: bullets.length ? bullets : original.bullets };
  });

  const projects = profile.projects
    .map((original, i) => {
      const generated = Array.isArray(ai.projects) ? ai.projects[i] : null;
      const bullets = keepOriginalWording ? [] : generated ? toStringArray(generated.bullets) : [];
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
    certifications,
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
  const askForResume = (extraInstruction, temperatureBoost = 0) =>
    deepseek.chatJson({
      system: resumePrompt.buildSystemPrompt(resumeType),
      user: resumePrompt.buildUserPrompt({ profile, jobDescription: jd, resumeType, extraInstruction }),
      // Sampling follows the level: "natural" is a copying task and wants none,
      // while heavier rewriting needs enough latitude to find new phrasing. All
      // stay well below the range where invented facts start appearing.
      temperature: Math.min(RESUME_TYPE_TEMPERATURE[resumeType] + temperatureBoost, 0.8),
    });

  let resumeResponse = await askForResume();
  let resume = normalizeAiOutput(resumeResponse.json, profile, resumeType);

  // Levels above "natural" promise rewritten wording, but the model sometimes
  // plays safe and echoes the profile back — the stricter the anti-fabrication
  // rules, the likelier that is. Up to two retries, each with the failure named
  // directly and a higher temperature: repeating the same request at the same
  // temperature risks landing on the same "safe copy" response again, since that
  // response is what the model considers safest at that setting.
  // The best attempt is kept, not the most recent one. Each retry raises the
  // temperature, which makes a later attempt genuinely capable of being worse
  // than an earlier one — an observed run went 7/7 unchanged, then 2/7, then
  // back to 4/7, and shipping "last" would have thrown away the good middle
  // result. Tracking the minimum means retrying can only ever help.
  const scoreOf = (candidate) => ({
    resume: candidate,
    ...countUnchangedBullets(candidate, profile),
    titles: inventedTitles(candidate.summary, profile),
  });

  let best = scoreOf(resume);

  for (
    let attempt = 1;
    attempt <= 2 && resumeType !== 'natural' && (best.unchanged > 0 || best.titles.length);
    attempt += 1
  ) {
    if (best.titles.length) {
      console.warn(
        `Generation: ${resumeType} claimed a title the candidate does not hold (${best.titles.join(', ')}); retrying (attempt ${attempt}).`
      );
    } else {
      console.warn(
        `Generation: ${resumeType} left ${best.unchanged}/${best.total} bullets unchanged; retrying (attempt ${attempt}).`
      );
    }

    resumeResponse = await askForResume(
      `YOUR PREVIOUS ATTEMPT FAILED: ${best.unchanged} of ${best.total} bullets came back word for word ` +
        'identical to the candidate\'s original text. That is only correct at level 1, and this ' +
        'is not level 1. Rewrite EVERY item — the professional summary and every experience ' +
        'and project bullet — so that not one of them matches the original wording. The summary ' +
        'in particular must be re-angled toward this posting, not repeated from the profile. ' +
        'Keep every fact exactly as given; change only how it is worded. Rewriting is not fabricating. ' +
        'If a bullet already reads well, rewrite it anyway — "it was already good" is not a valid ' +
        'reason to return it unchanged at this level.' +
        (best.titles.length
          ? ` YOU ALSO GAVE THE CANDIDATE A JOB TITLE THEY DO NOT HOLD: ${best.titles.join(', ')}. ` +
            'Use only the titles listed under JOB TITLES, or describe the work without naming a role. ' +
            'Never relabel the person to suit the posting.'
          : ''),
      attempt * 0.2
    );

    const score = scoreOf(normalizeAiOutput(resumeResponse.json, profile, resumeType));

    // A fabricated title outranks leftover wording: a resume that reads a little
    // close to the original is a weak result, one that misstates the candidate's
    // role is a wrong one.
    const better =
      best.titles.length && !score.titles.length
        ? true
        : !best.titles.length && score.titles.length
          ? false
          : score.unchanged < best.unchanged;

    if (better) best = score;
  }

  // Last resort: if every attempt invented a title, fall back to the profile's own
  // summary. Less tailored, but it never misrepresents who the candidate is.
  if (best.titles.length) {
    console.warn(
      `Generation: ${resumeType} kept claiming ${best.titles.join(', ')}; falling back to the profile summary.`
    );
    best = { ...best, resume: { ...best.resume, summary: profile.summary }, titles: [] };
  }

  resume = best.resume;

  if (resumeType !== 'natural' && best.unchanged > 0) {
    // Retries exhausted. The resume is still valid and factual, just less
    // tailored than asked for, so it ships rather than failing the request.
    console.warn(
      `Generation: ${resumeType} still has ${best.unchanged}/${best.total} original bullets after retries.`
    );
  }

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
