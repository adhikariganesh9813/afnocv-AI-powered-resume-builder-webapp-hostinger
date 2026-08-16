# AFNOCV — AI Resume Builder

A web app for building a tailored, ATS-friendly resume from your work history and a target job description, with an exportable PDF/DOCX and a hand-computed resume-to-job-description match score.

## Features

- Intake form for personal info, education, experience, projects, and skills
- Paste a job description to tailor the resume against
- AI-generated, structured resume content aligned to the job description
- Clean, ATS-friendly resume template
- Export to PDF and DOCX
- Match score between resume and job description (embeddings + cosine similarity)

## Stack

- Node.js + Express (backend)
- Vanilla HTML/CSS/JS (frontend)

## Getting started

```bash
npm install
npm start
```

Then open `http://localhost:3000` in your browser.
