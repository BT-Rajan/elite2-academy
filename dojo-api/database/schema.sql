-- Dojo Platform MySQL Schema
-- Run: mysql -u root -p < database/schema.sql

CREATE DATABASE IF NOT EXISTS dojo_platform CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE dojo_platform;

CREATE TABLE IF NOT EXISTS users (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  uid           VARCHAR(36) NOT NULL UNIQUE,
  email         VARCHAR(120) NOT NULL UNIQUE,
  password      VARCHAR(255) NOT NULL,
  display_name  VARCHAR(100) NOT NULL,
  salutation    VARCHAR(10),
  first_name    VARCHAR(60),
  last_name     VARCHAR(60),
  role          ENUM('admin','coach','parent','staff') NOT NULL,
  approval_status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  approved_by   VARCHAR(36) NULL,
  approved_at   DATETIME NULL,
  token_version INT UNSIGNED NOT NULL DEFAULT 1,
  is_head_coach TINYINT(1) NOT NULL DEFAULT 0,
  dojo_id       VARCHAR(50) NOT NULL,
  -- Home branch for coach/staff (which branch's students/sessions they
  -- operate on day to day). NULL for admin, and for coach/staff pending
  -- branch assignment by an admin/head coach -- a coach/staff with no
  -- branch_id has no branch-scoped access until assigned. Admin and Head
  -- Coach are never restricted to a single branch regardless of this value.
  branch_id     INT UNSIGNED NULL,
  avatar_url    VARCHAR(255),
  phone         VARCHAR(30),
  is_active     TINYINT(1) NOT NULL DEFAULT 1,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_dojo_role (dojo_id, role),
  INDEX idx_approval (dojo_id, approval_status),
  INDEX idx_branch (branch_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS login_attempts (
  identifier       VARCHAR(120) PRIMARY KEY,
  attempts         INT UNSIGNED NOT NULL DEFAULT 0,
  first_attempt_at DATETIME NOT NULL,
  locked_until     DATETIME NULL,
  updated_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS audit_log (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  actor_uid   VARCHAR(36) NULL,
  actor_role  VARCHAR(20) NULL,
  dojo_id     VARCHAR(50) NULL,
  action      VARCHAR(60) NOT NULL,
  target_type VARCHAR(40) NOT NULL,
  target_id   VARCHAR(60) NOT NULL,
  meta        JSON NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_dojo_action (dojo_id, action),
  INDEX idx_target (target_type, target_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS api_rate_limits (
  identifier   VARCHAR(120) NOT NULL,
  window_start INT UNSIGNED NOT NULL,
  count        INT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (identifier, window_start)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS dojos (
  id         VARCHAR(50) PRIMARY KEY,
  name       VARCHAR(120) NOT NULL DEFAULT 'My Dojo',
  email      VARCHAR(120),
  phone      VARCHAR(30),
  address    TEXT,
  timezone   VARCHAR(50) NOT NULL DEFAULT 'UTC',
  settings   JSON,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- A dojo can operate multiple physical locations. Every operationally
-- significant table below (users, students, sessions, attendance,
-- evaluations, schedules) carries a branch_id so day-to-day data is scoped
-- to a location, while curriculum (disciplines/belts) stays dojo-wide and
-- shared across branches. Deleting a branch is a soft delete (is_active=0)
-- via the API -- rows here are never hard-deleted while they still have
-- students/staff assigned.
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

CREATE TABLE IF NOT EXISTS disciplines (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  dojo_id     VARCHAR(50) NOT NULL,
  name        VARCHAR(80) NOT NULL,
  description TEXT,
  color       VARCHAR(10) NOT NULL DEFAULT '#6366f1',
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_dojo (dojo_id)
) ENGINE=InnoDB;

-- `belts` doubles as the curriculum "roadmap" row for a discipline. For a
-- classic single-track discipline only name/color/sort_order/min_classes/
-- min_score are used. For a multi-track discipline (e.g. Elita's integrated
-- Kaju + Kickboxing + BJJ + Self-Defense program) the three curriculum_*
-- columns describe the parallel-track requirements attached to that belt.
CREATE TABLE IF NOT EXISTS belts (
  id                      INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  discipline_id           INT UNSIGNED NOT NULL,
  name                    VARCHAR(60) NOT NULL,
  color_hex               VARCHAR(10) NOT NULL DEFAULT '#ffffff',
  sort_order              TINYINT UNSIGNED NOT NULL DEFAULT 1,
  min_classes             SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  min_score               TINYINT UNSIGNED NOT NULL DEFAULT 0,
  kickboxing_level        VARCHAR(30) NULL,   -- e.g. "Beginner", "Intermediate", "Advanced", "Expert"
  bjj_stripe_label        VARCHAR(60) NULL,   -- e.g. "1 × White", "Belt is marker", "None"
  seminar_points_required SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  created_at              DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (discipline_id) REFERENCES disciplines(id) ON DELETE CASCADE,
  INDEX idx_discipline (discipline_id, sort_order)
) ENGINE=InnoDB;

-- Per-belt syllabus text for each of the three parallel tracks. Lets admins
-- edit the curriculum content (what's actually taught/tested) without
-- touching code.
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

CREATE TABLE IF NOT EXISTS students (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  dojo_id         VARCHAR(50) NOT NULL,
  branch_id       INT UNSIGNED NOT NULL,
  parent_uid      VARCHAR(36) NOT NULL,
  first_name      VARCHAR(60) NOT NULL,
  last_name       VARCHAR(60) NOT NULL,
  dob             DATE,
  gender          ENUM('M','F','Other'),
  avatar_url      VARCHAR(255),
  discipline_id   INT UNSIGNED,
  current_belt_id INT UNSIGNED,
  bjj_stripes     TINYINT UNSIGNED NOT NULL DEFAULT 0,  -- stripes earned on the current belt
  seminar_points  SMALLINT UNSIGNED NOT NULL DEFAULT 0, -- toward current belt's seminar_points_required
  enrolled_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  is_active       TINYINT(1) NOT NULL DEFAULT 1,
  INDEX idx_dojo   (dojo_id),
  INDEX idx_branch (branch_id),
  INDEX idx_parent (parent_uid),
  FOREIGN KEY (discipline_id)   REFERENCES disciplines(id) ON DELETE SET NULL,
  FOREIGN KEY (current_belt_id) REFERENCES belts(id)       ON DELETE SET NULL,
  FOREIGN KEY (branch_id)       REFERENCES branches(id)    ON DELETE RESTRICT
) ENGINE=InnoDB;

-- Audit trail every time a student moves branches (transfer) or a
-- staff/admin changes their assigned batch/discipline as part of that move.
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

CREATE TABLE IF NOT EXISTS belt_history (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  student_id INT UNSIGNED NOT NULL,
  belt_id    INT UNSIGNED NULL,
  belt_name  VARCHAR(60) NOT NULL,
  awarded_by VARCHAR(100) NOT NULL,
  notes      TEXT,
  awarded_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  FOREIGN KEY (belt_id)    REFERENCES belts(id)     ON DELETE SET NULL,
  INDEX idx_student (student_id)
) ENGINE=InnoDB;

-- A coach's per-track evaluation of a student against the belt they're
-- currently working toward. Promotion aggregates the three tracks. A head
-- coach (users.is_head_coach = 1) may overrule any evaluating coach's call.
-- branch_id is copied from the student at insert time (same rationale as
-- attendance above) so a coach's write access can be checked against the
-- evaluation row itself without an extra join back to students.
CREATE TABLE IF NOT EXISTS student_evaluations (
  id                 INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  student_id         INT UNSIGNED NOT NULL,
  branch_id          INT UNSIGNED NOT NULL,
  belt_id            INT UNSIGNED NOT NULL,   -- belt being evaluated for
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
  FOREIGN KEY (branch_id)  REFERENCES branches(id)  ON DELETE RESTRICT,
  INDEX idx_student_belt (student_id, belt_id),
  INDEX idx_branch (branch_id)
) ENGINE=InnoDB;

-- Audit trail for seminar points (Self-Defense & Traditional track), which
-- accumulate toward a belt's seminar_points_required and reset on promotion.
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

CREATE TABLE IF NOT EXISTS student_objectives (
  id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  student_id   INT UNSIGNED NOT NULL,
  description  TEXT NOT NULL,
  is_complete  TINYINT(1) NOT NULL DEFAULT 0,
  set_by       VARCHAR(36) NOT NULL,
  completed_at DATETIME,
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS schedules (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  dojo_id       VARCHAR(50) NOT NULL,
  branch_id     INT UNSIGNED NOT NULL,
  discipline_id INT UNSIGNED,
  coach_uid     VARCHAR(36) NOT NULL,
  name          VARCHAR(120) NOT NULL,
  day_of_week   TINYINT UNSIGNED NOT NULL,
  start_time    TIME NOT NULL,
  end_time      TIME NOT NULL,
  location      VARCHAR(100),
  is_active     TINYINT(1) NOT NULL DEFAULT 1,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_dojo   (dojo_id, is_active, day_of_week),
  INDEX idx_branch (branch_id, is_active, day_of_week),
  FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS sessions (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  dojo_id       VARCHAR(50) NOT NULL,
  branch_id     INT UNSIGNED NOT NULL,
  class_name    VARCHAR(120) NOT NULL,
  coach_uid     VARCHAR(36) NOT NULL,
  date          DATE NOT NULL,
  start_time    TIME NOT NULL DEFAULT '00:00:00',
  end_time      TIME NOT NULL DEFAULT '00:00:00',
  location      VARCHAR(100),
  is_closed     TINYINT(1) NOT NULL DEFAULT 0,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_dojo   (dojo_id),
  INDEX idx_branch (branch_id, date),
  INDEX idx_coach  (coach_uid, date),
  FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS session_comments (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  session_id INT UNSIGNED NULL,
  student_id INT UNSIGNED NOT NULL,
  coach_uid  VARCHAR(36) NOT NULL,
  coach_name VARCHAR(100) NOT NULL,
  comment    TEXT NOT NULL,
  skills     JSON,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE SET NULL,
  INDEX idx_session (session_id),
  INDEX idx_student (student_id)
) ENGINE=InnoDB;

-- branch_id is copied from the session at insert time (rather than joined
-- every read) so attendance rows are directly branch-filterable/auditable
-- even if a session's branch were ever corrected after the fact.
CREATE TABLE IF NOT EXISTS attendance (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  session_id INT UNSIGNED NOT NULL,
  branch_id  INT UNSIGNED NOT NULL,
  student_id INT UNSIGNED NOT NULL,
  status     ENUM('present','late','excused','absent') NOT NULL,
  marked_by  VARCHAR(36) NOT NULL,
  marked_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
  FOREIGN KEY (branch_id)  REFERENCES branches(id) ON DELETE RESTRICT,
  UNIQUE KEY uq_session_student (session_id, student_id),
  INDEX idx_student (student_id, marked_at),
  INDEX idx_branch  (branch_id, marked_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS threads (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  dojo_id       VARCHAR(50) NOT NULL,
  student_id    INT UNSIGNED NOT NULL,
  parent_uid    VARCHAR(36) NOT NULL,
  coach_uid     VARCHAR(36) NOT NULL,
  last_message  TEXT,
  last_at       DATETIME,
  unread_parent SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  unread_coach  SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_coach  (coach_uid,  last_at),
  INDEX idx_parent (parent_uid, last_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS messages (
  id        INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  thread_id INT UNSIGNED NOT NULL,
  from_uid  VARCHAR(36) NOT NULL,
  from_name VARCHAR(100) NOT NULL,
  from_role ENUM('admin','coach','parent','staff') NOT NULL,
  body      TEXT NOT NULL,
  sent_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  read_at   DATETIME,
  FOREIGN KEY (thread_id) REFERENCES threads(id) ON DELETE CASCADE,
  INDEX idx_thread (thread_id, sent_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS loyalty_accounts (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  parent_uid      VARCHAR(36) NOT NULL UNIQUE,
  dojo_id         VARCHAR(50) NOT NULL,
  points          INT NOT NULL DEFAULT 0,
  lifetime_points INT UNSIGNED NOT NULL DEFAULT 0,
  tier            ENUM('bronze','silver','gold','platinum') NOT NULL DEFAULT 'bronze',
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS loyalty_transactions (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  account_id INT UNSIGNED NOT NULL,
  amount     INT NOT NULL,
  reason     VARCHAR(50) NOT NULL,
  note       VARCHAR(255),
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (account_id) REFERENCES loyalty_accounts(id) ON DELETE CASCADE,
  INDEX idx_account (account_id, created_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS loyalty_rewards (
  id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  dojo_id      VARCHAR(50) NOT NULL,
  name         VARCHAR(120) NOT NULL,
  description  TEXT,
  points_cost  INT UNSIGNED NOT NULL,
  type         ENUM('discount','free_class','merchandise','custom') NOT NULL,
  discount_pct TINYINT UNSIGNED,
  is_active    TINYINT(1) NOT NULL DEFAULT 1,
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS notifications (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  uid        VARCHAR(36) NOT NULL,
  type       ENUM('message','attendance','belt','loyalty','system') NOT NULL,
  title      VARCHAR(200) NOT NULL,
  body       TEXT NOT NULL,
  is_read    TINYINT(1) NOT NULL DEFAULT 0,
  link       VARCHAR(255),
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_uid (uid, created_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS password_resets (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  email      VARCHAR(120) NOT NULL,
  token      VARCHAR(100) NOT NULL UNIQUE,
  expires_at DATETIME NOT NULL,
  used       TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_token (token)
) ENGINE=InnoDB;
