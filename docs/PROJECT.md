# AI-Assisted Resume Builder — Project Doc

> Living document. Updated as decisions get made. Read this first before touching the code — it exists so any collaborator (human or AI) can pick up the project with zero prior context.

## What this is

A web app where a user fills in their resume info once, pastes a target job description, and an AI model generates a tailored resume (rewritten bullets, reordered/emphasized skills, JD keyword alignment for ATS). User can export to PDF and DOCX. It also computes a "Match Score %" between the resume and the JD using embeddings + **hand-written cosine similarity** (dot product / magnitude implemented from scratch, not a library call).

## Why it's being built this way

The owner is building this **to learn core AI-engineering concepts hands-on**, not just to ship a working tool. Every new AI concept (structured output prompting, embeddings, cosine similarity, prompt engineering for tailoring text) is explained in plain language first, confirmed understood, then implemented together — no black-box copy-paste. Treat this constraint as load-bearing: don't skip the explanation step when extending AI-related code.

The owner also has no prior React experience and has never built an API in a professional folder-structure (controllers/services/routes) before — those are being taught as part of this build, not assumed knowledge.

**Deadline: 2026-08-18** (originally). As of 2026-08-16, scope grew (see below) and the owner explicitly accepted this deadline will likely slip — prioritizing a proper multi-user system over hitting the 18th. Outside of that one deliberate trade-off, scope is still kept tight — no other gold-plating, no other speculative features.

## Product shape (added 2026-08-16)

The app is a small multi-user SaaS, not a single-user local tool:

- **Homepage** with login/signup.
- After auth, user lands on a **dashboard** — the main engine of the app. Dashboard takes a **job description** and a **resume type** (`Max Match`, `Ultra Match`, `Basic Match`, `Natural` — how aggressively the AI tailors the resume to the JD) as input.
- A separate **profile page** is where the user fills in the intake-form data (personal info, education, experience, etc. — this is Feature 1, already built as a static form and now being migrated to per-user DB storage).
- Generation consumes: user's profile data (from DB) + pasted job description + selected resume type → AI → tailored resume.

## Decided stack

| Layer | Choice | Why |
|---|---|---|
| Frontend | Vanilla HTML/CSS/JS (no framework) | Owner has zero React experience; deadline pressure at project start. All learning time should go to the AI concepts, not a UI framework. Decided 2026-08-12. |
| Backend | Node.js + Express | Owner already has working knowledge of this. Uses a professional folder layout (routes/controllers/services) as a teaching goal. |
| AI provider | DeepSeek API (`deepseek-chat` / `deepseek-reasoner`) | Owner already holds an API key. **Known limitation: DeepSeek's platform has no embeddings endpoint** — only chat completions. This blocks feature 6 (Match Score) using DeepSeek directly; a separate embeddings source will be picked when we reach that feature (candidates: OpenAI embeddings, Google embeddings, or a hand-rolled TF-IDF vector as a teaching stand-in). Decided 2026-08-12. |
| Storage | **MySQL/MariaDB, hosted on Hostinger** (superseded 2026-08-16) | Owner pivoted from single-user/JSON-file to a full multi-user product (see Product shape above), which requires per-user relational storage. Full schema + rationale: [`db/schema.sql`](../db/schema.sql) and [`docs/DATABASE.md`](DATABASE.md). |
| Auth | **JWT-based login/signup** (superseded 2026-08-16) | Originally decided against auth entirely to protect the deadline; owner explicitly chose to build the full multi-user system anyway, accepting the deadline risk. Stateless JWT chosen over server-side sessions to avoid needing a `sessions` table. |

~~Previous (2026-08-12 → 2026-08-16): flat local JSON file, no auth, single user.~~ Superseded — kept here so the reasoning trail isn't lost, not because it's still active.

## Build order (from owner's brief)

1. Intake form — personal info, work experience, education, skills
2. JD input — paste target job description as plain text
3. Resume generation — user data + JD → AI → structured JSON (tailored bullets, reordered skills, ATS keyword alignment)
4. Template rendering — map JSON into one clean ATS-friendly resume template
5. Export — DOCX + PDF from the same template data
6. Match Score — embed resume + JD text, hand-written cosine similarity, display as %

## Status

- [x] Tech stack decided (2026-08-12)
- [ ] Resume data schema — **proposed, not yet finalized.** Waiting on owner's existing resume template (PDF) to confirm sections/fields match what they actually need before locking the schema.
- [ ] ATS-friendly template structure — blocked on the same PDF.
- [ ] Folder structure (controllers/services/routes) not yet created.
- [ ] No code written yet.

## Resume data schema (FINALIZED — grounded in owner's real resume, `Resume_General_TX.pdf`)

```
ResumeProfile
├── personalInfo
│   ├── fullName        string
│   ├── email           string
│   ├── phone           string
│   ├── location        string   e.g. "Lubbock, TX"
│   ├── linkedin         string   URL
│   └── github           string   URL
│
├── summary              string   paragraph; AI rewrites this per JD at generation time
│
├── skills
│   └── categories[]                exactly two fixed categories (owner's decision, 2026-08-12):
│       ├── name         string     "Programming Languages" | "Frameworks/Tools"
│       └── items[]       string[]
│
├── education[]
│   ├── institution      string
│   ├── location          string
│   ├── degree           string   e.g. "Master of Science in Computer Science"
│   ├── gpa               string   optional
│   ├── startDate        string
│   └── endDate            string   free text — supports "December 2026 (Expected)"
│
├── certifications[]      global, not tied to one degree
│   ├── name              string
│   └── issuer            string   optional
│
├── coursework[]           string[] flat list
│
├── experience[]
│   ├── company          string
│   ├── location          string
│   ├── title             string
│   ├── startDate        string
│   ├── endDate            string   supports "Present"
│   └── bullets[]           string[] raw, owner's own words — AI tailors these at generation
│                                     time, never overwrites the source
│
├── projects[]
│   ├── name              string
│   ├── technologies[]    string[]
│   ├── link               string   optional URL
│   └── bullets[]           string[]
│
└── languages[]
    ├── name               string
    └── proficiency         string   e.g. "Business"
```

Design intent (unchanged): `experience[].bullets` are raw input in the owner's own words; the AI generates a *separate* tailored version at generation time per-JD, so the source profile is reusable across multiple job applications without retyping.

**Skills categorization**: originally proposed flat, then categorized by owner's real resume (3 categories: Foundations/Programming/Tools & Platforms). Owner then explicitly cemented this down to exactly **two** categories: "Programming Languages" and "Frameworks/Tools" (decided 2026-08-12) — "Foundations" dropped.

## ATS-friendly template structure (FINALIZED — matches owner's existing PDF layout)

Single column, no tables/text-boxes/graphics (ATS parsers choke on multi-column layouts and text boxes):

```
[Full Name — bold, centered, large]
[email | phone | location — centered]
[LinkedIn: url | GitHub: url — centered, bold labels]

PROFESSIONAL SUMMARY   (bold header + horizontal rule)
  paragraph

TECHNICAL SKILLS
  • Programming Languages: item, item, item
  • Frameworks/Tools: item, item, item

EDUCATION
  Institution                                    Location
  Degree | GPA: x.xx                    StartDate – EndDate
  • Certifications: ...
  • Relevant Coursework: ...

PROFESSIONAL EXPERIENCE
  Company | (context)                            Location
  Title                                  StartDate – EndDate
    o bullet
    o bullet

KEY PROJECTS
  Project Name | tech, tech, tech
    o bullet(s)

LANGUAGES
  • Lang (Level), Lang (Level), ...
```

Company/institution + location on one line (location right-aligned), title/degree + dates on the next line (dates right-aligned) — predictable left-to-right reading order, no columns to confuse a parser.

## Progress so far

### Backend (built and verified)

Layered structure: `server.js` → `src/app.js` → `src/routes/` → `src/controllers/` → `src/services/` → `src/config/db.js`. Run with `npm start` (serves `http://localhost:3000`).

| File | Role |
|---|---|
| `src/config/db.js` | mysql2 connection pool. Exports `query()` and `withTransaction()` (used for profile saves, which touch many tables). |
| `src/middleware/auth.middleware.js` | `requireAuth` — rejects requests without a valid JWT, attaches `req.user`. |
| `src/services/auth.service.js` | `signup` (bcrypt hash, creates the user's 1:1 `profiles` row up front) / `login`. Login returns the same generic error for unknown-email and wrong-password so the endpoint can't be used to discover which emails have accounts. |
| `src/services/profile.service.js` | `getProfile` (assembles the full `ResumeProfile` shape from all tables) / `saveProfile` (replaces the whole profile inside one transaction: children are deleted and re-inserted rather than diffed, since the form always submits the complete picture). |
| `src/app.js` | Mounts routes, serves `public/` statically, and has a central error handler — controllers just call `next(err)` and never format error responses themselves. |

**API endpoints:**

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/api/ping` | — | Health check |
| POST | `/api/auth/signup` | — | Create account, returns `{token, user}` |
| POST | `/api/auth/login` | — | Sign in, returns `{token, user}` |
| GET | `/api/auth/me` | ✓ | Current user |
| GET | `/api/profile` | ✓ | Full `ResumeProfile` for the signed-in user |
| PUT | `/api/profile` | ✓ | Replace the signed-in user's whole profile |
| POST | `/api/generate` | ✓ | Generate a tailored resume **and cover letter** (body: `jobDescription`, `resumeType`) |
| GET | `/api/generate` | ✓ | List the user's recent generations |
| GET | `/api/generate/:id` | ✓ | One generation + both rendered documents |
| GET | `/api/generate/:id/download/:doc/:format` | ✓ | `doc` = `resume`\|`cover`, `format` = `pdf`\|`docx` |

### AI generation (Feature 3) — how it works

| File | Role |
|---|---|
| `src/prompts/resume.prompt.js` | All resume prompt text: the system prompt (absolute rules, writing style, output schema) and the four `resume_type` rule blocks. Kept separate from logic so wording can be tuned without touching code. |
| `src/prompts/coverLetter.prompt.js` | Cover letter prompt: same absolute anti-fabrication rules, plus writing constraints (four paragraphs, no clichés, one page) and four tone levels mapped to the same `resume_type` setting. |
| `src/services/deepseek.service.js` | Thin client for DeepSeek's OpenAI-compatible `/chat/completions`, using JSON mode (`response_format: {type: 'json_object'}`). Uses Node 20's built-in `fetch`; 120s timeout; maps provider failures to clear messages. |
| `src/services/generation.service.js` | Validates input, loads the profile, calls the model, **normalises and sanitises the response**, saves to `generations`. |

**Two documents per run.** One "Generate" produces a tailored resume *and* a cover letter, via **two parallel API calls** (`Promise.all`) rather than one combined call: each response stays well within output limits, neither schema can confuse the other, and the user waits for the slower call rather than the sum. Both are stored together in `generations.generated_json` — no schema change was needed, since they are produced together, replaced wholesale, and never queried field by field. Generations created before this feature simply have no `coverLetter` key; `getGeneration` returns `null` for it and the UI offers to regenerate.

Cover letter temperature is 0.5 versus the resume's 0.3 — prose reads badly when it is too rigid, and the letter's factual claims are constrained by the prompt rather than by structure, so the extra latitude affects wording rather than content. Its date, sender details, and signature are added by the template, never by the model.

**Anti-hallucination design (two layers).** This is the core risk: a prompt that asks a model to make someone look good for a job invites it to invent skills.

1. *Prompt-level* — hard rules forbid adding any technology, employer, title, degree, date, or metric not in the profile; the model reports unsupported job requirements in `keywordsMissing` instead of claiming them.
2. *Code-level* (the real guarantee, since prompts can be ignored) — in `normalizeAiOutput`:
   - `personalInfo`, `education`, `certifications`, `coursework`, `languages` are copied from the profile and **never sent to the model at all** — it cannot alter what it never sees.
   - Experience and projects are matched back to the profile **by position**; only `bullets` are taken from the model, so it cannot add, drop, rename, or re-date a role.
   - Skill items and project technologies are **filtered against the profile** (case-insensitive) — reordering for relevance is allowed, inventing is silently dropped.

Verified with a stubbed model response that deliberately tried to inject a fake employer, a fake extra role, altered dates, and three invented skills: all were stripped, while legitimate rewording and relevance-reordering survived.

`temperature` is 0.3 — enough flexibility to rephrase naturally, far enough from the creativity that invites fabrication.

### Export (Feature 5)

| File | Role |
|---|---|
| `src/services/resumeRender.service.js` | Generated resume JSON → ATS-friendly HTML (also exports `renderResumeText`, which Feature 6 will need). |
| `src/services/coverLetterRender.service.js` | Cover letter JSON → HTML. Opens straight at the greeting — no letterhead, date or address block, since the resume it accompanies already carries the contact details and the letter only gets one page. |
| `src/services/pdf.service.js` | PDF via **PDFKit** — pure JavaScript, so it runs on Hostinger shared hosting where a headless browser would not. Produces real selectable text, verified extractable (essential for ATS parsing). Exports `buildPdf` and `buildCoverLetterPdf`. |
| `src/services/docx.service.js` | DOCX via the **docx** package. Single column with right-aligned tab stops rather than tables, since ATS parsers mishandle tables. Exports `buildDocx` and `buildCoverLetterDocx`. |

All four downloads (resume/cover × PDF/DOCX) go through one `download` controller keyed on `:doc/:format`.

Verified working: input validation (400s), auth guard (401 for missing/invalid/expired tokens), and graceful 500s when the database is unreachable. **The DB-backed paths have not been tested against a real database yet** — `.env` still holds dummy credentials, so every DB call currently fails with a handled 500. That's the expected state until real Hostinger credentials are filled in.

### Frontend (built)

| File | Page |
|---|---|
| `public/index.html` + `js/auth.js` | Homepage — marketing pitch + sign-in/create-account tabs. Redirects to the dashboard if already signed in. |
| `public/dashboard.html` + `js/dashboard.js` | Dashboard — job-description textarea + resume-type picker (Natural / Basic Match / Max Match / Ultra Match). Warns if the profile is empty. Generate calls `/api/generate` and redirects to the result page. |
| `public/result.html` + `js/result.js` | Result page — resume and cover letter **side by side**, each with its own PDF/DOCX buttons (fetched as blobs so the auth header can be sent). Shows which job-description keywords were matched vs. unsupported. Stacks to one column under 1000px. Print stylesheet strips the app chrome and puts each document on its own page. |
| `public/profile.html` + `js/profile.js` | Profile page — the full intake form (was `index.html` before auth existed). Now loads from and saves to `/api/profile` instead of `localStorage`. |
| `public/js/api.js` | Shared helper — JWT storage, `fetch` wrapper, auto-redirect to homepage on 401, and the `api.*` methods each page calls. |
| `public/css/style.css` | All styling — cards, forms, tag chips, nav, landing page, resume-type picker. |

**Auth approach on the frontend:** the JWT is kept in `localStorage`; pages that require sign-in call `Auth.requirePage()` at the top and redirect if there's no token. Note this is a client-side convenience only — the real enforcement is `requireAuth` on the API, since static HTML files are served to anyone who requests them.

## Open questions / next steps

1. **Add a real `DEEPSEEK_API_KEY` to `.env`** (local) and to the Hostinger environment. Everything else in the generation pipeline is built and tested; with a dummy key the API returns a clear 503 ("The AI provider is not configured yet"). Nothing has run against the real DeepSeek API yet — the pipeline was verified with a stubbed model response.
2. **Feature 6 — Match Score** is the only feature left. Two things are still open:
   - *Which embeddings source*: DeepSeek has no embeddings endpoint. Candidates: OpenAI embeddings, Google embeddings, or a hand-rolled TF-IDF vector as a teaching stand-in.
   - The cosine similarity maths must be **explained before it is coded, and written by hand** (dot product / magnitudes, no library similarity call) — this is the owner's central deliberate learning goal for the project.
   - Groundwork is already in place: `generations.match_score` exists (nullable), and `resumeRender.service.js` exports `renderResumeText()` to flatten a resume to plain text for embedding.
3. Optional polish if time allows: a history view of past generations (the `GET /api/generate` endpoint already exists but nothing links to it).

## Decisions log

- **2026-08-12** — Chose vanilla JS frontend over React (owner has no React background; deadline pressure).
- **2026-08-12** — Chose DeepSeek as the generation provider (owner already has API access); flagged that it lacks an embeddings endpoint, deferred that decision to feature 6.
- **2026-08-12** — Chose no-auth, single-user, flat-JSON-file storage over a database — avoids unrequested scope. *(Superseded 2026-08-16.)*
- **2026-08-12** — Owner shared real resume (`Resume_General_TX.pdf`); schema revised to match: categorized skills (not flat), added Projects/Certifications/Coursework/Languages sections, split LinkedIn/GitHub as distinct fields.
- **2026-08-12** — Owner cemented skills categorization to exactly two fixed categories: "Programming Languages" and "Frameworks/Tools" (dropping the resume's original third category, "Foundations").
- **2026-08-12** — Schema and ATS template structure both finalized.
- **2026-08-16** — Found and fixed two duplicate-event-listener bugs in `public/js/intake.js`: (1) "+Add" buttons had two click handlers registered, causing double-added entries; (2) `initTagInput` was called twice on the same element when populating saved data (skills, coursework, project technologies), causing duplicate tag entries on new input. Refactored tag-input logic into `initTagInput` (wire once, now idempotent) / `addTag` / `setTags` (populate) to make the bug structurally impossible going forward.
- **2026-08-16** — Owner described the real product shape: multi-user SaaS with homepage login/signup, per-user dashboard (JD + resume-type input), and a separate profile page. This requires real auth + a relational database, which the earlier no-auth/JSON-file decision was explicitly avoiding. Given the choice between protecting the Aug 18 deadline vs. building the full system, owner chose the full system and accepted the deadline will likely slip.
- **2026-08-16** — Designed MySQL schema (`db/schema.sql`) for Hostinger: `users`, `profiles`, `skills`, `education`, `certifications`, `coursework`, `experience` (+ `experience_bullets`), `projects` (+ `project_technologies`, `project_bullets`), `languages`, `generations`. JWT chosen over server-side sessions (no `sessions` table needed). AI-generated resume output stored as a `JSON` column (`generations.generated_json`) rather than normalized, since it's replaced wholesale each run rather than edited field-by-field. Full rationale in `docs/DATABASE.md`. Not yet run against the real database or wired into any backend code.
- **2026-08-16** — Owner decided job descriptions are never persisted: no `job_descriptions` table. The JD is pasted into the dashboard and sent straight through to the LLM call and match-score calculation within one request, then discarded — removed the table and the `generations.job_description_id` FK accordingly. Trade-off (no generation history/re-run without re-pasting) accepted deliberately.
- **2026-08-16** — Clarified that the resume layout/template (Feature 4) is a fixed code asset (HTML/CSS template file), not database data — there's one shared template, not a per-user or per-generation row.
- **2026-08-16** — Owner ran `db/schema.sql` against the real Hostinger database; tables now exist.
- **2026-08-16** — Built the full auth + profile backend and all three pages (homepage/dashboard/profile). Chose `localStorage` for JWT storage over httpOnly cookies: simpler for a static-file frontend with no build step, and acceptable here since the API enforces auth on every request regardless. Trade-off noted: `localStorage` tokens are readable by any script on the page, so this would need revisiting before handling sensitive data or adding third-party scripts.
- **2026-08-16** — Profile saves replace the entire profile (delete + re-insert children in one transaction) rather than diffing individual rows. Chosen because the intake form always submits the complete profile; diffing would add complexity with no user-visible benefit.
- **2026-08-17** — Built Feature 3 (AI generation), Feature 4 (template rendering) and Feature 5 (PDF/DOCX export). Key decisions:
  - **Factual sections are withheld from the model entirely** rather than sent and checked afterwards — education, certifications, coursework, languages and personal info never enter the prompt, so they cannot come back altered. Also cuts token usage.
  - **Experience/projects are matched by array position**, taking only bullets from the model, so roles cannot be added, dropped, renamed or re-dated.
  - **Skills and project technologies are filtered against the profile.** Found during testing that the model could otherwise inject skills the candidate never listed (a stubbed response added Rust, Go and Kubernetes and they passed straight through) — exactly the "claims experience you don't have" failure the project is meant to avoid.
  - **PDFKit over a headless browser** for PDF: pure JS, runs on Hostinger shared hosting, and produces real extractable text rather than an image (verified by parsing the generated PDF back out).
  - **DOCX uses tab stops, not tables**, for right-aligned dates/locations — ATS parsers mishandle table layouts.
  - Error handler gained an `expose` flag: 5xx errors are normally masked behind a generic message, but deliberately-written provider messages ("Add a real DEEPSEEK_API_KEY", "insufficient balance") pass through, since they are actionable and leak nothing.
- **2026-08-18** — **Resume type had almost no effect.** Measured across repeated live runs: `basic_match` produced output identical to `natural`, and `ultra_match` echoed the profile back verbatim — only `max_match` actually tailored. Diagnosis and fixes:
  - *Cause*: the tailoring level sat in one block at the top of the user message while the system prompt carried nine forceful "never invent anything" rules. Faced with that imbalance the model took the safest available action — changing nothing. The ultra level was worst because its own text paired "be maximally aggressive" with a warning about keyword stuffing, a conflict it resolved by copying.
  - *Prompt fixes*: the tailoring level moved into the **system** prompt as the first and most prominent instruction (`buildSystemPrompt(resumeType)`), each level gained a **worked before/after example** using the same source bullet, the rules now state explicitly that caution about fabrication is never a reason to skip rewriting, and a closing check asks the model to compare its bullets against the level before answering. Temperature also scales with the level (0 → 0.5).
  - *Follow-up (the first fix was incomplete)*: the owner reported the levels still looked identical, and they were right. The guard compared the **whole bullet array** at once, so a response that rewrote bullets 2-5 but left bullet 1 alone counted as "changed" and no retry fired — while the most visible bullet on the page was untouched. `countUnchangedBullets` now compares **every bullet individually**, including project bullets (matched by project name, since irrelevant projects may have been dropped), and retries whenever any bullet comes back byte-identical. Lesson worth keeping: an aggregate comparison is the wrong instrument for a per-item guarantee.
  - *Code guarantees, because prompt wording alone stayed unreliable*: at `natural` the profile's bullets are used **directly** rather than asking the model to copy them, making that level exact instead of merely likely. At levels 2-4 the result is compared against the profile, and if the bullets came back untouched the request is **retried once with the failure named explicitly**. Prompt tuning got ultra from 0/4 to roughly 4/7; the check is what makes it dependable. Seven changes:
  - **Education gained a `completed` checkbox** (`db/migrations/001_education_completed.sql`, applied to the live database). Degree status is now a stated fact rather than something inferred from the date text. An unfinished degree renders its end date as "December 2026 (Expected)" — appended at render time by `educationDates()`, so the user never types it and it cannot end up doubled — and both prompts are told explicitly which degrees are earned.
  - **All reordering is disabled.** Prompts now say relevance is expressed by what you *include*, never by moving things; `normalizeAiOutput` re-sorts the model's skill and coursework selections back into profile order, so a selection can never double as a reorder.
  - **The model now selects what is relevant.** A profile is a long store; a resume is one page. Projects carry an `include` flag, coursework and skills are filtered — all judged generously ("if in doubt, include it"). Experience is never dropped: gaps in a work history look worse than a less-relevant role. Safety nets stop an empty section if the model rejects everything.
  - **The cover letter is now written from the finished resume, not the profile** — so it argues for the document the employer actually reads and cannot surface material the resume deliberately trimmed. This made generation **sequential rather than parallel** (~10s instead of ~6s); the consistency is worth the wait.
  - **Resume types show their hierarchy in the UI** — a four-segment meter (1/4 filled through 4/4) plus "listed from least to most aggressive". "Natural" is now truthfully described as "Only use Layout": at that level the prompt requires bullets be reproduced character for character.
  - **New signups land on the profile page**, not the dashboard, with a welcome banner explaining why. There is nothing to generate from until the profile exists.
  - **Justified text removed** from the resume summary and letter paragraphs; both now set ragged-right, which reads more naturally and avoids stretched word spacing.
- **2026-08-17** — First test against the **live DeepSeek API** (real key). Generation works end to end: two parallel calls, ~5-6s, ~5,300 tokens per run. Three problems found and fixed:
  - **The model claimed a degree the candidate has not earned** — it turned "M.S. Computer Science student" into "Holds an M.S. in Computer Science". Cause: education is deliberately withheld from the resume model, so it inferred degree status from the summary prose and upgraded it. Fix: education is now passed as clearly-labelled *read-only context* marking each degree IN PROGRESS or completed (anything the model returns for it is still discarded), plus explicit rules in both prompts against presenting unfinished qualifications as finished. Verified fixed against the live API.
  - **Invented qualifiers and connections** — "code reviews" (never mentioned), "extensive experience" where the profile said "specific tasks", "used Google Cloud in academic settings" (setting never stated), and a claim that an ETL pipeline was built "as part of my IBM certification" (the profile lists both facts but never links them). Added rules against inventing scale/frequency/setting/activities and against inventing causal links between separate facts.
  - **DeepSeek intermittently returns truncated, unparseable JSON** (seen once with `finish_reason: stop`, so not a token limit — just a bad emission). `chatJson` now retries once automatically before surfacing an error, since a second call is far cheaper than making the user re-run a generation.
  - Also fixed: long project URLs printed past the right margin, because runs are drawn on one line without wrapping. The *displayed* link text is now shortened with an ellipsis until the row fits, while the annotation still points at the full URL (verified by reading the URIs back out of the PDF).
- **2026-08-17** — Fixes from the owner's first real production test:
  - **Section order corrected** to Professional Summary → Education → Technical Skills → Professional Experience → Key Projects → Languages. This order is duplicated across `resumeRender`, `pdf.service` and `docx.service`; change all three together.
  - **Resume now guaranteed to fit one US Letter page.** `pdf.service` lays the document out at progressively tighter settings (`FIT_STEPS`) and returns the first that produces a single page. A separate `space` factor compresses vertical rhythm ahead of type size, because whitespace is cheaper to lose than legibility. Roughly 30 bullets fit comfortably; genuinely enormous content (40+ bullets) still overflows and returns the tightest version rather than failing.
  - Two bugs found while building that: PDFKit's `bufferedPageRange()` reports **0** after `end()` flushes the buffer, so the "did it fit?" check never matched and every resume silently shrank to the smallest setting — page counting now uses the `pageAdded` event with `autoFirstPage: false`. And PDFKit's inline `underline`/`link` text options compute their own geometry, which is `NaN` under `lineBreak: false`; links are now drawn as explicit annotations plus a hand-drawn rule from the measured run width.
  - **Institution and company locations are bold**; **all URLs are real hyperlinks** in HTML, PDF and DOCX (`toUrl` in `resumeRender.service.js` adds a missing scheme, since users type "github.com/name" rather than a full URL).
  - **Cover letter stripped back**: no letterhead, date or `Re:` block — it opens at "Dear Hiring Manager," and the gap between the closing and the signature is one line rather than a chasm. It also fits one page via its own fit steps.
  - **Profile form placeholders no longer use the owner's real details.** Seeing your own name as placeholder text reads as "already filled in", which is the most likely explanation for the truncated name found in production (see below). Placeholders are now generic examples.
- **2026-08-17** — Added cover letter generation (owner's request; not part of the original six-feature brief). One "Generate" now produces both documents, shown side by side on the result page, each downloadable as PDF or DOCX. Key decisions:
  - **Two parallel model calls instead of one combined call** — keeps each response inside output limits, stops the two schemas interfering, and costs no extra wall-clock time.
  - **Stored inside the existing `generated_json` column**, not a new column or table — same reasoning as the resume (produced together, replaced wholesale, never queried by sub-field), and it avoids asking the owner to run a migration against a live database.
  - **Old generations remain readable**: `getGeneration` returns `coverLetter: null` when the key is absent, and the UI invites the user to regenerate. Verified against a real pre-existing generation in the production database.
  - The letter's date, contact block and signature are produced by the template, not the model, so they cannot be invented or misformatted.
