const { query, withTransaction } = require('../config/db');

const SKILL_CATEGORIES = ['Programming Languages', 'Frameworks/Tools'];

async function getProfileRow(userId) {
  const rows = await query('SELECT * FROM profiles WHERE user_id = ?', [userId]);
  if (rows.length === 0) {
    // Older accounts (or a failed signup) may not have a profile row yet.
    const result = await query('INSERT INTO profiles (user_id) VALUES (?)', [userId]);
    return { id: result.insertId, user_id: userId };
  }
  return rows[0];
}

// Returns the full ResumeProfile shape the frontend form expects.
async function getProfile(userId) {
  const profile = await getProfileRow(userId);
  const profileId = profile.id;

  const [skills, education, certifications, coursework, experience, projects, languages] =
    await Promise.all([
      query('SELECT category, value FROM skills WHERE profile_id = ? ORDER BY id', [profileId]),
      query(
        'SELECT institution, location, degree, gpa, start_date, end_date, completed FROM education WHERE profile_id = ? ORDER BY id',
        [profileId]
      ),
      query('SELECT name, issuer FROM certifications WHERE profile_id = ? ORDER BY id', [profileId]),
      query('SELECT course_name FROM coursework WHERE profile_id = ? ORDER BY id', [profileId]),
      query(
        'SELECT id, company, location, title, start_date, end_date FROM experience WHERE profile_id = ? ORDER BY id',
        [profileId]
      ),
      query('SELECT id, name, link FROM projects WHERE profile_id = ? ORDER BY id', [profileId]),
      query('SELECT name, proficiency FROM languages WHERE profile_id = ? ORDER BY id', [profileId]),
    ]);

  const experienceIds = experience.map((e) => e.id);
  const projectIds = projects.map((p) => p.id);

  const experienceBullets = experienceIds.length
    ? await query(
        `SELECT experience_id, bullet_text FROM experience_bullets
         WHERE experience_id IN (${experienceIds.map(() => '?').join(',')}) ORDER BY id`,
        experienceIds
      )
    : [];

  const projectBullets = projectIds.length
    ? await query(
        `SELECT project_id, bullet_text FROM project_bullets
         WHERE project_id IN (${projectIds.map(() => '?').join(',')}) ORDER BY id`,
        projectIds
      )
    : [];

  const projectTechnologies = projectIds.length
    ? await query(
        `SELECT project_id, technology FROM project_technologies
         WHERE project_id IN (${projectIds.map(() => '?').join(',')}) ORDER BY id`,
        projectIds
      )
    : [];

  return {
    personalInfo: {
      fullName: profile.full_name || '',
      email: profile.contact_email || '',
      phone: profile.phone || '',
      location: profile.location || '',
      linkedin: profile.linkedin_url || '',
      github: profile.github_url || '',
    },
    summary: profile.summary || '',
    skills: {
      categories: SKILL_CATEGORIES.map((name) => ({
        name,
        items: skills.filter((s) => s.category === name).map((s) => s.value),
      })),
    },
    education: education.map((e) => ({
      institution: e.institution || '',
      location: e.location || '',
      degree: e.degree || '',
      gpa: e.gpa || '',
      startDate: e.start_date || '',
      endDate: e.end_date || '',
      completed: Boolean(e.completed),
    })),
    certifications: certifications.map((c) => ({
      name: c.name || '',
      issuer: c.issuer || '',
    })),
    coursework: coursework.map((c) => c.course_name),
    experience: experience.map((e) => ({
      company: e.company || '',
      location: e.location || '',
      title: e.title || '',
      startDate: e.start_date || '',
      endDate: e.end_date || '',
      bullets: experienceBullets
        .filter((b) => b.experience_id === e.id)
        .map((b) => b.bullet_text),
    })),
    projects: projects.map((p) => ({
      name: p.name || '',
      link: p.link || '',
      technologies: projectTechnologies
        .filter((t) => t.project_id === p.id)
        .map((t) => t.technology),
      bullets: projectBullets.filter((b) => b.project_id === p.id).map((b) => b.bullet_text),
    })),
    languages: languages.map((l) => ({
      name: l.name || '',
      proficiency: l.proficiency || '',
    })),
  };
}

// Replaces the user's entire profile. The form always submits the complete
// picture, so child rows are cleared and re-inserted rather than diffed —
// all inside one transaction so a failure can't leave a half-saved profile.
async function saveProfile(userId, profileData) {
  const profile = await getProfileRow(userId);
  const profileId = profile.id;

  const personal = profileData.personalInfo || {};

  await withTransaction(async (conn) => {
    await conn.execute(
      `UPDATE profiles SET full_name = ?, contact_email = ?, phone = ?, location = ?,
         linkedin_url = ?, github_url = ?, summary = ? WHERE id = ?`,
      [
        personal.fullName || null,
        personal.email || null,
        personal.phone || null,
        personal.location || null,
        personal.linkedin || null,
        personal.github || null,
        profileData.summary || null,
        profileId,
      ]
    );

    // Bullets/technologies are removed automatically via ON DELETE CASCADE
    // when their parent experience/project rows go.
    for (const table of [
      'skills',
      'education',
      'certifications',
      'coursework',
      'experience',
      'projects',
      'languages',
    ]) {
      await conn.execute(`DELETE FROM ${table} WHERE profile_id = ?`, [profileId]);
    }

    const categories = (profileData.skills && profileData.skills.categories) || [];
    for (const category of categories) {
      if (!SKILL_CATEGORIES.includes(category.name)) continue;
      for (const value of category.items || []) {
        await conn.execute('INSERT INTO skills (profile_id, category, value) VALUES (?, ?, ?)', [
          profileId,
          category.name,
          value,
        ]);
      }
    }

    for (const entry of profileData.education || []) {
      await conn.execute(
        `INSERT INTO education (profile_id, institution, location, degree, gpa, start_date, end_date, completed)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          profileId,
          entry.institution || null,
          entry.location || null,
          entry.degree || null,
          entry.gpa || null,
          entry.startDate || null,
          entry.endDate || null,
          entry.completed ? 1 : 0,
        ]
      );
    }

    for (const entry of profileData.certifications || []) {
      await conn.execute('INSERT INTO certifications (profile_id, name, issuer) VALUES (?, ?, ?)', [
        profileId,
        entry.name || null,
        entry.issuer || null,
      ]);
    }

    for (const course of profileData.coursework || []) {
      await conn.execute('INSERT INTO coursework (profile_id, course_name) VALUES (?, ?)', [
        profileId,
        course,
      ]);
    }

    for (const entry of profileData.experience || []) {
      const [result] = await conn.execute(
        `INSERT INTO experience (profile_id, company, location, title, start_date, end_date)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          profileId,
          entry.company || null,
          entry.location || null,
          entry.title || null,
          entry.startDate || null,
          entry.endDate || null,
        ]
      );
      for (const bullet of entry.bullets || []) {
        await conn.execute(
          'INSERT INTO experience_bullets (experience_id, bullet_text) VALUES (?, ?)',
          [result.insertId, bullet]
        );
      }
    }

    for (const entry of profileData.projects || []) {
      const [result] = await conn.execute(
        'INSERT INTO projects (profile_id, name, link) VALUES (?, ?, ?)',
        [profileId, entry.name || null, entry.link || null]
      );
      for (const tech of entry.technologies || []) {
        await conn.execute(
          'INSERT INTO project_technologies (project_id, technology) VALUES (?, ?)',
          [result.insertId, tech]
        );
      }
      for (const bullet of entry.bullets || []) {
        await conn.execute('INSERT INTO project_bullets (project_id, bullet_text) VALUES (?, ?)', [
          result.insertId,
          bullet,
        ]);
      }
    }

    for (const entry of profileData.languages || []) {
      await conn.execute('INSERT INTO languages (profile_id, name, proficiency) VALUES (?, ?, ?)', [
        profileId,
        entry.name || null,
        entry.proficiency || null,
      ]);
    }
  });

  return getProfile(userId);
}

module.exports = { getProfile, saveProfile };
