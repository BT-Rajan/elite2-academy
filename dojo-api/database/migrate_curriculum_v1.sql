-- Curriculum Roadmap feature — migration for existing databases.
-- Safe to re-run (uses IF NOT EXISTS everywhere; requires MySQL 8.0.29+ /
-- MariaDB 10.5+ for the "ADD COLUMN IF NOT EXISTS" clause). Fresh installs
-- should just use schema.sql, which already includes all of this.
--
-- Run: mysql -u root -p dojo_platform < database/migrate_curriculum_v1.sql

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS is_head_coach TINYINT(1) NOT NULL DEFAULT 0 AFTER role;

ALTER TABLE belts
  ADD COLUMN IF NOT EXISTS kickboxing_level        VARCHAR(30) NULL,
  ADD COLUMN IF NOT EXISTS bjj_stripe_label         VARCHAR(60) NULL,
  ADD COLUMN IF NOT EXISTS seminar_points_required  SMALLINT UNSIGNED NOT NULL DEFAULT 0;

ALTER TABLE students
  ADD COLUMN IF NOT EXISTS bjj_stripes    TINYINT UNSIGNED NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS seminar_points SMALLINT UNSIGNED NOT NULL DEFAULT 0;

ALTER TABLE belt_history
  ADD COLUMN IF NOT EXISTS belt_id INT UNSIGNED NULL AFTER student_id;

-- Add the belt_history.belt_id FK only if it doesn't already exist.
SET @fk_exists := (
  SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = DATABASE()
    AND TABLE_NAME = 'belt_history'
    AND CONSTRAINT_NAME = 'fk_belt_history_belt'
);
SET @sql := IF(@fk_exists = 0,
  'ALTER TABLE belt_history ADD CONSTRAINT fk_belt_history_belt FOREIGN KEY (belt_id) REFERENCES belts(id) ON DELETE SET NULL',
  'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

CREATE TABLE IF NOT EXISTS curriculum_syllabus (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  belt_id     INT UNSIGNED NOT NULL,
  track       ENUM('striking','grappling','selfdefense') NOT NULL,
  title       VARCHAR(150) NOT NULL,
  description TEXT,
  sort_order  TINYINT UNSIGNED NOT NULL DEFAULT 1,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (belt_id) REFERENCES belts(id) ON DELETE CASCADE,
  INDEX idx_belt_track (belt_id, track)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS student_evaluations (
  id                 INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  student_id         INT UNSIGNED NOT NULL,
  belt_id            INT UNSIGNED NOT NULL,
  track              ENUM('striking','grappling','selfdefense') NOT NULL,
  result             ENUM('pass','fail') NOT NULL,
  notes              TEXT,
  coach_uid          VARCHAR(36) NOT NULL,
  coach_name         VARCHAR(100) NOT NULL,
  evaluated_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  overruled_by       VARCHAR(36) NULL,
  overruled_by_name  VARCHAR(100) NULL,
  overrule_result    ENUM('pass','fail') NULL,
  overrule_notes     TEXT NULL,
  overruled_at       DATETIME NULL,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  FOREIGN KEY (belt_id)    REFERENCES belts(id)     ON DELETE CASCADE,
  INDEX idx_student_belt (student_id, belt_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS seminar_points_log (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  student_id      INT UNSIGNED NOT NULL,
  points          SMALLINT NOT NULL,
  reason          VARCHAR(150) NOT NULL,
  awarded_by      VARCHAR(36) NOT NULL,
  awarded_by_name VARCHAR(100) NOT NULL,
  awarded_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  INDEX idx_student (student_id, awarded_at)
) ENGINE=InnoDB;
