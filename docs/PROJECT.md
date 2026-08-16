# AI-Assisted Resume Builder — Project Doc

> Living document. Updated as decisions get made. Read this first before touching the code — it exists so any collaborator (human or AI) can pick up the project with zero prior context.

## What this is

A web app where a user fills in their resume info once, pastes a target job description, and an AI model generates a tailored resume (rewritten bullets, reordered/emphasized skills, JD keyword alignment for ATS). User can export to PDF and DOCX. It also computes a "Match Score %" between the resume and the JD using embeddings + **hand-written cosine similarity** (dot product / magnitude implemented from scratch, not a library call).

## Why it's being built this way

The owner is building this **to learn core AI-engineering concepts hands-on**, not just to ship a working tool. Every new AI concept (structured output prompting, embeddings, cosine similarity, prompt engineering for tailoring text) is explained in plain language first, confirmed understood, then implemented together — no black-box copy-paste. Treat this constraint as load-bearing: don't skip the explanation step when extending AI-related code.

The owner also has no prior React experience and has never built an API in a professional folder-structure (controllers/services/routes) before — those are being taught as part of this build, not assumed knowledge.

**Deadline: 2026-08-18.** Scope is deliberately kept tight — no gold-plating, no speculative features.

## Decided stack

| Layer | Choice | Why |
|---|---|---|
| Frontend | Vanilla HTML/CSS/JS (no framework) | Owner has zero React experience; deadline is 6 days out at project start. All learning time should go to the AI concepts, not a UI framework. Decided 2026-08-12. |
| Backend | Node.js + Express | Owner already has working knowledge of this. Will use a professional folder layout (routes/controllers/services) as a teaching goal. |
| AI provider | DeepSeek API (`deepseek-chat` / `deepseek-reasoner`) | Owner already holds an API key. **Known limitation: DeepSeek's platform has no embeddings endpoint** — only chat completions. This blocks feature 6 (Match Score) using DeepSeek directly; a separate embeddings source will be picked when we reach that feature (candidates: OpenAI embeddings, Google embeddings, or a hand-rolled TF-IDF vector as a teaching stand-in). Decided 2026-08-12. |
| Storage | Flat local JSON file (e.g. `data/profile.json`) | No login/auth, single user. Simplest thing that works. No database server needed for v1. Decided 2026-08-12. |
| Auth | None | Not a stated requirement; would be pure scope creep given the deadline. |

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

- **Backend skeleton built and verified working**: `server.js` → `src/app.js` → `src/routes/` → `src/controllers/` → `src/services/`. Proven end-to-end with a `GET /api/ping` health-check route (service returns data, controller sends JSON, route maps the URL). Run with `npm start`, serves on `http://localhost:3000`.
- **Feature 1 (Intake form) — frontend built**, backend not yet wired:
  - `public/index.html` — full form matching the finalized schema (personal info, summary, skills as two tag inputs, and repeatable sections for education/certifications/coursework/experience/projects/languages, using `<template>` elements cloned via JS for each repeatable entry).
  - `public/css/style.css` — card-based layout, Inter font, indigo accent color, sticky save bar.
  - `public/js/intake.js` — handles add/remove for all repeatable sections, tag-chip inputs (skills, coursework, project technologies), bullet add/remove within experience/project cards, serializes the whole form into the `ResumeProfile` JSON shape, and currently persists to **`localStorage`** (temporary — no backend endpoint exists yet, so nothing is saved to a real file/server).
- Express is serving `public/` as static files via `express.static` (configured in `src/app.js`).

## Open questions / next steps

1. Build the real backend for Feature 1: a route/controller/service to `POST` (save) and `GET` (load) a `ResumeProfile`, persisted to `data/profile.json` — then swap `intake.js`'s `localStorage` calls for `fetch()` calls to that endpoint.
2. Feature 2: JD input.
3. Feature 3 (resume generation) requires explaining structured-output/JSON-schema prompting before writing that code — per owner's explicit learning requirement.

## Decisions log

- **2026-08-12** — Chose vanilla JS frontend over React (owner has no React background; deadline pressure).
- **2026-08-12** — Chose DeepSeek as the generation provider (owner already has API access); flagged that it lacks an embeddings endpoint, deferred that decision to feature 6.
- **2026-08-12** — Chose no-auth, single-user, flat-JSON-file storage over a database — avoids unrequested scope.
- **2026-08-12** — Owner shared real resume (`Resume_General_TX.pdf`); schema revised to match: categorized skills (not flat), added Projects/Certifications/Coursework/Languages sections, split LinkedIn/GitHub as distinct fields.
- **2026-08-12** — Owner cemented skills categorization to exactly two fixed categories: "Programming Languages" and "Frameworks/Tools" (dropping the resume's original third category, "Foundations").
- **2026-08-12** — Schema and ATS template structure both finalized.
