-- Migration: multi-branch support.
-- Run: mysql -u root -p dojo_platform < database/migrations/004_add_branches.sql
--
-- Adds a `branches` table and makes users/students/sessions/attendance/
-- student_evaluations/schedules branch-aware. Every dojo that already has
-- data gets a "Main Branch" auto-created and all its existing rows backfilled
-- into it, so nothing breaks on upgrade -- an admin can rename it or create
-- additional branches and start reassigning staff/students afterward.

CREATE TABLE IF NOT EXISTS branches (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  dojo_id    VARCHAR(50) NOT NULL,
  name       VARCHAR(120) NOT NULL,
  code       VARCHAR(20),
  address    TEXT,
  phone      VARCHAR(30),
  is_active  TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_dojo (dojo_id, is_active)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS student_branch_transfers (
  id             INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  student_id     INT UNSIGNED NOT NULL,
  from_branch_id INT UNSIGNED NULL,
  to_branch_id   INT UNSIGNED NOT NULL,
  transferred_by VARCHAR(36) NOT NULL,
  notes          TEXT,
  transferred_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (student_id)     REFERENCES students(id) ON DELETE CASCADE,
  FOREIGN KEY (from_branch_id) REFERENCES branches(id) ON DELETE SET NULL,
  FOREIGN KEY (to_branch_id)   REFERENCES branches(id) ON DELETE RESTRICT,
  INDEX idx_student (student_id, transferred_at)
) ENGINE=InnoDB;

-- One "Main Branch" per existing dojo, sourced from every table that
-- already carries a dojo_id, so every dojo (even one with e.g. only
-- students and no sessions yet) gets exactly one backfill branch.
INSERT INTO branches (dojo_id, name, code)
SELECT dojo_id, 'Main Branch', 'MAIN' FROM (
    SELECT dojo_id FROM users     WHERE dojo_id IS NOT NULL
    UNION SELECT dojo_id FROM students  WHERE dojo_id IS NOT NULL
    UNION SELECT dojo_id FROM sessions  WHERE dojo_id IS NOT NULL
    UNION SELECT dojo_id FROM schedules WHERE dojo_id IS NOT NULL
    UNION SELECT id      FROM dojos
) AS d
WHERE NOT EXISTS (SELECT 1 FROM branches b WHERE b.dojo_id = d.dojo_id);

-- ── users ────────────────────────────────────────────────────────────────
ALTER TABLE users
  ADD COLUMN branch_id INT UNSIGNED NULL AFTER dojo_id,
  ADD INDEX idx_branch (branch_id);

UPDATE users u
JOIN branches b ON b.dojo_id = u.dojo_id
SET u.branch_id = b.id
WHERE u.branch_id IS NULL;

-- ── students ─────────────────────────────────────────────────────────────
ALTER TABLE students
  ADD COLUMN branch_id INT UNSIGNED NULL AFTER dojo_id;

UPDATE students s
JOIN branches b ON b.dojo_id = s.dojo_id
SET s.branch_id = b.id
WHERE s.branch_id IS NULL;

ALTER TABLE students
  MODIFY COLUMN branch_id INT UNSIGNED NOT NULL,
  ADD INDEX idx_branch (branch_id),
  ADD FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE RESTRICT;

-- ── schedules ────────────────────────────────────────────────────────────
ALTER TABLE schedules
  ADD COLUMN branch_id INT UNSIGNED NULL AFTER dojo_id;

UPDATE schedules sc
JOIN branches b ON b.dojo_id = sc.dojo_id
SET sc.branch_id = b.id
WHERE sc.branch_id IS NULL;

ALTER TABLE schedules
  MODIFY COLUMN branch_id INT UNSIGNED NOT NULL,
  ADD INDEX idx_branch (branch_id, is_active, day_of_week),
  ADD FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE RESTRICT;

-- ── sessions ─────────────────────────────────────────────────────────────
ALTER TABLE sessions
  ADD COLUMN branch_id INT UNSIGNED NULL AFTER dojo_id;

UPDATE sessions se
JOIN branches b ON b.dojo_id = se.dojo_id
SET se.branch_id = b.id
WHERE se.branch_id IS NULL;

ALTER TABLE sessions
  MODIFY COLUMN branch_id INT UNSIGNED NOT NULL,
  ADD INDEX idx_branch (branch_id, date),
  ADD FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE RESTRICT;

-- ── attendance (denormalized from session) ──────────────────────────────
ALTER TABLE attendance
  ADD COLUMN branch_id INT UNSIGNED NULL AFTER session_id;

UPDATE attendance a
JOIN sessions se ON se.id = a.session_id
SET a.branch_id = se.branch_id
WHERE a.branch_id IS NULL;

ALTER TABLE attendance
  MODIFY COLUMN branch_id INT UNSIGNED NOT NULL,
  ADD INDEX idx_branch (branch_id, marked_at),
  ADD FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE RESTRICT;

-- ── student_evaluations (denormalized from student) ─────────────────────
ALTER TABLE student_evaluations
  ADD COLUMN branch_id INT UNSIGNED NULL AFTER student_id;

UPDATE student_evaluations e
JOIN students s ON s.id = e.student_id
SET e.branch_id = s.branch_id
WHERE e.branch_id IS NULL;

ALTER TABLE student_evaluations
  MODIFY COLUMN branch_id INT UNSIGNED NOT NULL,
  ADD INDEX idx_branch (branch_id),
  ADD FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE RESTRICT;
