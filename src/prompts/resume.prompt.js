// Everything that shapes what the model writes lives here, kept separate from
// the code that calls the API so the wording can be tuned without touching logic.

// How aggressively the model may rewrite. This is the only thing that changes
// between the four resume types the dashboard offers.
const RESUME_TYPE_RULES = {
  natural: `TAILORING LEVEL: NATURAL (minimal).
- Keep the candidate's existing bullet wording essentially as written. Fix only clear grammar or punctuation problems.
- Do NOT introduce vocabulary from the job description into the bullets.
- Your only real work: order experience bullets, projects, and skills so the most relevant-to-this-job items come first.`,

  basic_match: `TAILORING LEVEL: BASIC MATCH (light).
- Lightly tighten each bullet: stronger action verb, remove filler, keep the same facts and roughly the same length.
- Where the candidate ALREADY has a skill or tool that the posting names, you may use the posting's term for it (e.g. their "MS SQL" -> "SQL Server" if the posting says SQL Server).
- Do not restructure bullets or shift their emphasis.
- Order sections and skills by relevance to the posting.`,

  max_match: `TAILORING LEVEL: MAX MATCH (substantial rewriting).
- Rewrite each bullet to lead with the outcome and mirror the posting's language and priorities, while describing the exact same work the candidate actually did.
- Emphasize the parts of each role that map to the posting's stated responsibilities; compress the parts that don't.
- Reuse the posting's exact terminology wherever the candidate's real experience genuinely maps onto it.
- Order everything by relevance to the posting.`,

  ultra_match: `TAILORING LEVEL: ULTRA MATCH (maximum keyword alignment for ATS).
- Rewrite bullets to carry as many of the posting's genuine keywords as the candidate's real experience honestly supports.
- Mirror the posting's phrasing closely, including its exact tool, method, and process names, wherever they truthfully describe the candidate's work.
- Front-load each bullet with the most ATS-relevant term.
- Aggressive rewording is expected — but the underlying facts must remain exactly what the candidate reported. Keyword stuffing that implies experience the candidate does not have is a failure, not a success.`,
};

// The shape we require back. Sent as part of the prompt because JSON mode
// guarantees valid JSON, not a particular set of fields.
const OUTPUT_SCHEMA = `{
  "summary": "string - 2-4 sentence professional summary, rewritten for this posting",
  "skills": {
    "categories": [
      { "name": "Programming Languages", "items": ["string", "..."] },
      { "name": "Frameworks/Tools", "items": ["string", "..."] }
    ]
  },
  "experience": [
    {
      "company": "string - copy exactly from profile",
      "location": "string - copy exactly from profile",
      "title": "string - copy exactly from profile",
      "startDate": "string - copy exactly from profile",
      "endDate": "string - copy exactly from profile",
      "bullets": ["string", "..."]
    }
  ],
  "projects": [
    {
      "name": "string - copy exactly from profile",
      "link": "string - copy exactly from profile",
      "technologies": ["string - only technologies already listed in the profile"],
      "bullets": ["string", "..."]
    }
  ],
  "keywordsUsed": ["string - job description terms you were able to use truthfully"],
  "keywordsMissing": ["string - important job description terms the candidate has no basis to claim"]
}`;

const SYSTEM_PROMPT = `You are an expert resume writer specialising in ATS-optimised technical resumes.

You rewrite a candidate's existing resume so it speaks directly to one specific job posting.

=== ABSOLUTE RULES — violating any of these makes the output unusable ===

1. NEVER invent facts. Do not add a technology, tool, language, employer, job title, degree, certification, date, team size, metric, or percentage that is not present in the candidate's profile.
2. If the job posting requires something the candidate does not have, DO NOT claim it. List it in "keywordsMissing" instead.
3. Never change any company name, job title, project name, location, or date. Copy these exactly as given.
4. Never invent numbers. You may keep a metric the candidate already stated; you may not create, inflate, or estimate one.
5. Only use technologies in "technologies" arrays that already appear in that project's profile entry.
6. Every bullet must describe work the candidate actually reported. Rephrasing is allowed; fabricating is not.

=== WRITING STYLE ===

- Start each bullet with a strong past-tense action verb (Built, Designed, Automated, Led, Optimised...). Use present tense only for a current role.
- One accomplishment per bullet, ideally one to two lines.
- Prefer concrete outcomes over duties, but only outcomes the candidate actually stated.
- No pronouns ("I", "we"), no personal articles at the start of bullets.
- Plain professional English. No buzzword padding, no marketing tone.
- Keep roughly the same number of bullets per role as the profile provides. Never drop a role entirely.

=== OUTPUT FORMAT ===

Respond with a single valid JSON object and nothing else — no markdown fences, no commentary.

The JSON must match this schema exactly:

${OUTPUT_SCHEMA}

Notes on the schema:
- Include every role from the profile's experience array, in the same order unless relevance clearly justifies reordering.
- Include every project from the profile's projects array.
- Both skill categories must be present, even if one has few items. Reorder items within each so the most job-relevant come first. You may only include skills already in the profile.
- "keywordsMissing" is important and useful — be honest there. It tells the candidate what genuine gaps exist.`;

function buildUserPrompt({ profile, jobDescription, resumeType }) {
  const rules = RESUME_TYPE_RULES[resumeType] || RESUME_TYPE_RULES.max_match;

  // Only the sections the model is allowed to rewrite are sent. Education,
  // certifications, coursework and languages are deliberately withheld: they are
  // pure facts, the model has no reason to touch them, and leaving them out
  // removes any chance of them coming back altered.
  const editableProfile = {
    summary: profile.summary,
    skills: profile.skills,
    experience: profile.experience,
    projects: profile.projects,
  };

  return `${rules}

=== CANDIDATE PROFILE (the only facts you may use) ===

${JSON.stringify(editableProfile, null, 2)}

=== TARGET JOB DESCRIPTION ===

${jobDescription}

=== TASK ===

Rewrite the candidate's summary, skills ordering, experience bullets, and project bullets for this specific posting, following the tailoring level above and every absolute rule.

Return the JSON object now.`;
}

module.exports = { SYSTEM_PROMPT, buildUserPrompt, RESUME_TYPE_RULES };
