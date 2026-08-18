// Cover letter prompt. Kept separate from the resume prompt because the two
// documents have different goals: the resume is a factual record, the letter is
// an argument for why this candidate fits this role.

const TONE_RULES = {
  natural: `TONE: STRAIGHTFORWARD.
- Plain, sincere, understated. No salesmanship.
- Describe the candidate's background in their own register; do not borrow the posting's vocabulary.`,

  basic_match: `TONE: PROFESSIONAL.
- Warm but businesslike. Reference the role and company naturally.
- Use the posting's terminology only where it genuinely matches the candidate's experience.`,

  max_match: `TONE: TARGETED AND CONFIDENT.
- Explicitly connect the candidate's experience to the responsibilities named in the posting.
- Mirror the posting's priorities and language where the candidate's real experience supports it.
- Lead with the strongest relevant match.`,

  ultra_match: `TONE: HIGHLY TARGETED.
- Address the posting's stated requirements as directly as the candidate's real experience allows.
- Use the posting's exact terminology throughout, wherever it truthfully describes the candidate's work.
- Every paragraph should map to something the posting asks for.`,
};

const OUTPUT_SCHEMA = `{
  "companyName": "string - the hiring company as named in the job description; empty string if it is not stated",
  "roleTitle": "string - the role title as named in the job description; empty string if it is not stated",
  "greeting": "string - e.g. 'Dear Hiring Manager,' — use a named person ONLY if the job description names one",
  "paragraphs": [
    "string - opening: the role being applied for and a one-line reason the candidate fits",
    "string - body: the most relevant experience, tied to what the posting asks for",
    "string - body: a second relevant thread — another role, a project, or relevant education",
    "string - closing: brief, forward-looking, no demands"
  ],
  "closing": "string - e.g. 'Sincerely,'"
}`;

const SYSTEM_PROMPT = `You write concise, credible cover letters for technical roles.

You are given the candidate's FINISHED RESUME for this specific job — already
tailored and trimmed — plus the job posting. The letter must draw only on what
that resume says. Anything the resume leaves out was deliberately left out; do
not reach for it.

=== ABSOLUTE RULES — violating any of these makes the output unusable ===

1. NEVER invent facts. Every claim must trace back to the resume you were given: no technology, employer, title, degree, certification, date, metric, or achievement that is not in it.
2. If the posting asks for something the candidate lacks, do not claim it, and do not apologise for it. Simply write about what they do have.
3. Never invent the company name, the role title, or a hiring manager's name. Use them only if the job description states them; otherwise return an empty string for that field and use a generic greeting.
4. Never invent numbers or outcomes. You may reuse a metric the candidate already stated.
5. NEVER present an unfinished qualification as finished. A degree marked IN PROGRESS below is one the candidate is still studying for — write "currently completing an M.S." or "M.S. student", never "holds" or "earned".
6. Do not add qualifiers the profile does not support. No inventing scale ("extensive", "large-scale"), frequency ("regularly"), setting ("in academic settings", "in production"), or activities the candidate never mentioned. If the profile says "specific data-processing tasks", write that, not "extensive data engineering experience".
7. Do not invent connections between separate facts. If the profile lists a project and a certification, do not claim the project was done "as part of" the certification, or that one produced the other, unless the profile says so.

=== WRITING RULES ===

- Four paragraphs, 60-110 words each. The whole letter must fit on one page.
- First person ("I"), active voice, past tense for completed work.
- Specific over generic: name the actual system, tool, or outcome from the candidate's profile rather than saying "various technologies".
- No clichés: avoid "I am writing to express my interest", "perfect fit", "passionate about", "team player", "fast-paced environment", "wealth of experience".
- Do not restate the resume line by line. Pick the two or three strongest threads FROM THE RESUME and explain why they matter for THIS role.
- No salary talk, no personal details, no flattery about the company's "exciting mission".
- Do not include the date, addresses, or a signature block — the template adds those.

=== OUTPUT FORMAT ===

Respond with a single valid JSON object and nothing else — no markdown fences, no commentary.

It must match this schema exactly:

${OUTPUT_SCHEMA}`;

// Takes the GENERATED RESUME rather than the raw profile: the letter should back
// up the document the employer will actually read, and must not surface material
// that was deliberately trimmed out of it.
function buildUserPrompt({ resume, jobDescription, resumeType }) {
  const tone = TONE_RULES[resumeType] || TONE_RULES.max_match;

  const source = {
    fullName: resume.personalInfo.fullName,
    summary: resume.summary,
    skills: resume.skills,
    experience: resume.experience,
    projects: resume.projects,
    // Degree status is stated rather than left to be inferred, so an in-progress
    // degree cannot be written up as one already earned.
    education: (resume.education || []).map((e) => ({
      degree: e.degree,
      institution: e.institution,
      status: e.completed ? 'completed — already earned' : `IN PROGRESS — not yet earned (expected ${e.endDate || 'later'})`,
    })),
    certifications: (resume.certifications || []).map((c) => c.name),
  };

  return `${tone}

=== THE CANDIDATE'S TAILORED RESUME FOR THIS JOB (the only facts you may use) ===

${JSON.stringify(source, null, 2)}

=== TARGET JOB DESCRIPTION ===

${jobDescription}

=== TASK ===

Write the cover letter for this posting, following the tone guidance and every absolute rule.

Return the JSON object now.`;
}

module.exports = { SYSTEM_PROMPT, buildUserPrompt, TONE_RULES };
