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

Verified working: input validation (400s), auth guard (401 for missing/invalid/expired tokens), and graceful 500s when the database is unreachable. **The DB-backed paths have not been tested against a real database yet** — `.env` still holds dummy credentials, so every DB call currently fails with a handled 500. That's the expected state until real Hostinger credentials are filled in.

### Frontend (built)

| File | Page |
|---|---|
| `public/index.html` + `js/auth.js` | Homepage — marketing pitch + sign-in/create-account tabs. Redirects to the dashboard if already signed in. |
| `public/dashboard.html` + `js/dashboard.js` | Dashboard — job-description textarea + resume-type picker (Natural / Basic Match / Max Match / Ultra Match). Warns if the profile is empty. **The Generate button does not generate yet** — it validates input and reports that the generation step isn't built. |
| `public/profile.html` + `js/profile.js` | Profile page — the full intake form (was `index.html` before auth existed). Now loads from and saves to `/api/profile` instead of `localStorage`. |
| `public/js/api.js` | Shared helper — JWT storage, `fetch` wrapper, auto-redirect to homepage on 401, and the `api.*` methods each page calls. |
| `public/css/style.css` | All styling — cards, forms, tag chips, nav, landing page, resume-type picker. |

**Auth approach on the frontend:** the JWT is kept in `localStorage`; pages that require sign-in call `Auth.requirePage()` at the top and redirect if there's no token. Note this is a client-side convenience only — the real enforcement is `requireAuth` on the API, since static HTML files are served to anyone who requests them.

## Open questions / next steps

1. **Fill real Hostinger DB credentials into `.env`**, then test signup → login → profile save/load end-to-end against the live database. Nothing DB-backed has run for real yet.
2. Feature 3 (resume generation): wire the dashboard's Generate button to a new `/api/generate` endpoint → DeepSeek. Requires explaining structured-output/JSON-schema prompting **before** writing that code — per owner's explicit learning requirement. Takes profile + JD + `resume_type` as input, saves the result to `generations`.
3. Feature 4 (template rendering): the resume layout is **not database data** — it's a fixed HTML/CSS template file in the codebase (e.g. `src/templates/resume.html`), shared by every user/generation. Not built yet.
4. Feature 5: PDF + DOCX export from that template.
5. Feature 6: Match Score — embeddings + hand-written cosine similarity. Still blocked on choosing an embeddings source, since DeepSeek has no embeddings endpoint (see stack table).

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
