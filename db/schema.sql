-- AFNOCV — AI Resume Builder
-- MySQL / MariaDB schema (designed for Hostinger-hosted MySQL)
--
-- Run this against the empty database Hostinger already provisioned for you
-- (select it first in phpMyAdmin, or run `USE your_db_name;` in a SQL client).
-- Full design rationale lives in docs/DATABASE.md.

-- =========================================================
-- users — one row per account, used for login
-- =========================================================
CREATE TABLE IF NOT EXISTS users (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  email         VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =========================================================
-- profiles — the resume intake data, one per user
-- =========================================================
CREATE TABLE IF NOT EXISTS profiles (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id       INT UNSIGNED NOT NULL UNIQUE,
  full_name     VARCHAR(255),
  contact_email VARCHAR(255),
  phone         VARCHAR(50),
  location      VARCHAR(255),
  linkedin_url  VARCHAR(255),
  github_url    VARCHAR(255),
  summary       TEXT,
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_profiles_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =========================================================
-- skills — flat rows, tagged with one of the two fixed categories
-- =========================================================
CREATE TABLE IF NOT EXISTS skills (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  profile_id  INT UNSIGNED NOT NULL,
  category    ENUM('Programming Languages', 'Frameworks/Tools') NOT NULL,
  value       VARCHAR(255) NOT NULL,
  CONSTRAINT fk_skills_profile FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =========================================================
-- education
-- =========================================================
CREATE TABLE IF NOT EXISTS education (
  id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  profile_id   INT UNSIGNED NOT NULL,
  institution  VARCHAR(255),
  location     VARCHAR(255),
  degree       VARCHAR(255),
  gpa          VARCHAR(20),
  start_date   VARCHAR(50),
  end_date     VARCHAR(50),
  completed    TINYINT(1) NOT NULL DEFAULT 0,
  CONSTRAINT fk_education_profile FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =========================================================
-- certifications
-- =========================================================
CREATE TABLE IF NOT EXISTS certifications (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  profile_id  INT UNSIGNED NOT NULL,
  name        VARCHAR(255),
  issuer      VARCHAR(255),
  CONSTRAINT fk_certifications_profile FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =========================================================
-- coursework — flat list of course names
-- =========================================================
CREATE TABLE IF NOT EXISTS coursework (
  id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  profile_id   INT UNSIGNED NOT NULL,
  course_name  VARCHAR(255) NOT NULL,
  CONSTRAINT fk_coursework_profile FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =========================================================
-- experience
-- =========================================================
CREATE TABLE IF NOT EXISTS experience (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  profile_id  INT UNSIGNED NOT NULL,
  company     VARCHAR(255),
  location    VARCHAR(255),
  title       VARCHAR(255),
  start_date  VARCHAR(50),
  end_date    VARCHAR(50),
  CONSTRAINT fk_experience_profile FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS experience_bullets (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  experience_id INT UNSIGNED NOT NULL,
  bullet_text   TEXT NOT NULL,
  CONSTRAINT fk_experience_bullets_experience FOREIGN KEY (experience_id) REFERENCES experience(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =========================================================
-- projects
-- =========================================================
CREATE TABLE IF NOT EXISTS projects (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  profile_id  INT UNSIGNED NOT NULL,
  name        VARCHAR(255),
  link        VARCHAR(500),
  CONSTRAINT fk_projects_profile FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS project_technologies (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  project_id  INT UNSIGNED NOT NULL,
  technology  VARCHAR(100) NOT NULL,
  CONSTRAINT fk_project_technologies_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS project_bullets (
  id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  project_id   INT UNSIGNED NOT NULL,
  bullet_text  TEXT NOT NULL,
  CONSTRAINT fk_project_bullets_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =========================================================
-- languages
-- =========================================================
CREATE TABLE IF NOT EXISTS languages (
  id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  profile_id   INT UNSIGNED NOT NULL,
  name         VARCHAR(100),
  proficiency  VARCHAR(50),
  CONSTRAINT fk_languages_profile FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =========================================================
-- generations — one row per "Generate Resume" run
-- Job description text is NOT stored anywhere: it's pasted into the
-- dashboard and sent straight through to the LLM call and the match-score
-- calculation within a single request, then discarded. See docs/DATABASE.md.
-- =========================================================
CREATE TABLE IF NOT EXISTS generations (
  id                   INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id              INT UNSIGNED NOT NULL,
  profile_id           INT UNSIGNED NOT NULL,
  resume_type          ENUM('max_match', 'ultra_match', 'basic_match', 'natural') NOT NULL,
  generated_json       JSON NOT NULL,
  match_score          DECIMAL(5,2),
  created_at           TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_generations_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_generations_profile FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
