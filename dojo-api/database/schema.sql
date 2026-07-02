-- Dojo Platform MySQL Schema
-- Run: mysql -u root -p < database/schema.sql

CREATE DATABASE IF NOT EXISTS dojo_platform CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE dojo_platform;

CREATE TABLE IF NOT EXISTS users (
  id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  uid          VARCHAR(36) NOT NULL UNIQUE,
  email        VARCHAR(120) NOT NULL UNIQUE,
  password     VARCHAR(255) NOT NULL,
  display_name VARCHAR(100) NOT NULL,
  salutation   VARCHAR(10),
  first_name   VARCHAR(60),
  last_name    VARCHAR(60),
  role         ENUM('admin','coach','parent','staff') NOT NULL,
  dojo_id      VARCHAR(50) NOT NULL,
  avatar_url   VARCHAR(255),
  phone        VARCHAR(30),
  is_active    TINYINT(1) NOT NULL DEFAULT 1,
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_dojo_role (dojo_id, role)
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

CREATE TABLE IF NOT EXISTS disciplines (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  dojo_id     VARCHAR(50) NOT NULL,
  name        VARCHAR(80) NOT NULL,
  description TEXT,
  color       VARCHAR(10) NOT NULL DEFAULT '#6366f1',
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_dojo (dojo_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS belts (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  discipline_id INT UNSIGNED NOT NULL,
  name          VARCHAR(60) NOT NULL,
  color_hex     VARCHAR(10) NOT NULL DEFAULT '#ffffff',
  sort_order    TINYINT UNSIGNED NOT NULL DEFAULT 1,
  min_classes   SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  min_score     TINYINT UNSIGNED NOT NULL DEFAULT 0,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (discipline_id) REFERENCES disciplines(id) ON DELETE CASCADE,
  INDEX idx_discipline (discipline_id, sort_order)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS students (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  dojo_id         VARCHAR(50) NOT NULL,
  parent_uid      VARCHAR(36) NOT NULL,
  first_name      VARCHAR(60) NOT NULL,
  last_name       VARCHAR(60) NOT NULL,
  dob             DATE,
  gender          ENUM('M','F','Other'),
  avatar_url      VARCHAR(255),
  discipline_id   INT UNSIGNED,
  current_belt_id INT UNSIGNED,
  enrolled_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  is_active       TINYINT(1) NOT NULL DEFAULT 1,
  INDEX idx_dojo   (dojo_id),
  INDEX idx_parent (parent_uid),
  FOREIGN KEY (discipline_id)   REFERENCES disciplines(id) ON DELETE SET NULL,
  FOREIGN KEY (current_belt_id) REFERENCES belts(id)       ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS belt_history (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  student_id INT UNSIGNED NOT NULL,
  belt_name  VARCHAR(60) NOT NULL,
  awarded_by VARCHAR(100) NOT NULL,
  notes      TEXT,
  awarded_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  INDEX idx_student (student_id)
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
  discipline_id INT UNSIGNED,
  coach_uid     VARCHAR(36) NOT NULL,
  name          VARCHAR(120) NOT NULL,
  day_of_week   TINYINT UNSIGNED NOT NULL,
  start_time    TIME NOT NULL,
  end_time      TIME NOT NULL,
  location      VARCHAR(100),
  is_active     TINYINT(1) NOT NULL DEFAULT 1,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_dojo (dojo_id, is_active, day_of_week)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS sessions (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  dojo_id       VARCHAR(50) NOT NULL,
  class_name    VARCHAR(120) NOT NULL,
  coach_uid     VARCHAR(36) NOT NULL,
  date          DATE NOT NULL,
  start_time    TIME NOT NULL DEFAULT '00:00:00',
  end_time      TIME NOT NULL DEFAULT '00:00:00',
  location      VARCHAR(100),
  is_closed     TINYINT(1) NOT NULL DEFAULT 0,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_dojo  (dojo_id),
  INDEX idx_coach (coach_uid, date)
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

CREATE TABLE IF NOT EXISTS attendance (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  session_id INT UNSIGNED NOT NULL,
  student_id INT UNSIGNED NOT NULL,
  status     ENUM('present','late','excused','absent') NOT NULL,
  marked_by  VARCHAR(36) NOT NULL,
  marked_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
  UNIQUE KEY uq_session_student (session_id, student_id),
  INDEX idx_student (student_id, marked_at)
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
