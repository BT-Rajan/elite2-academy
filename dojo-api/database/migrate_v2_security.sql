-- Migration v2: approval workflow, JWT revocation, login throttling.
-- Run once against an existing dojo_platform database:
--   mysql -u root -p dojo_platform < migrate_v2_security.sql

ALTER TABLE users
  ADD COLUMN approval_status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'approved' AFTER role,
  ADD COLUMN approved_by     VARCHAR(36) NULL AFTER approval_status,
  ADD COLUMN approved_at     DATETIME NULL AFTER approved_by,
  ADD COLUMN token_version   INT UNSIGNED NOT NULL DEFAULT 1 AFTER approved_at,
  ADD INDEX idx_approval (dojo_id, approval_status);

-- Existing rows default to 'approved' above so nobody already using the
-- system gets locked out. New signups are set to 'pending' by the app.

CREATE TABLE IF NOT EXISTS login_attempts (
  identifier       VARCHAR(120) PRIMARY KEY,   -- lowercased email
  attempts         INT UNSIGNED NOT NULL DEFAULT 0,
  first_attempt_at DATETIME NOT NULL,
  locked_until     DATETIME NULL,
  updated_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;
