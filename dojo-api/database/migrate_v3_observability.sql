-- Migration v3: audit trail + general API rate limiting.
-- Run once against an existing dojo_platform database:
--   mysql -u root -p dojo_platform < migrate_v3_observability.sql

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
