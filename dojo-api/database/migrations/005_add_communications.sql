-- Migration: Communication Layer (WhatsApp / SMS / Email integration).
-- Run: mysql -u root -p dojo_platform < database/migrations/005_add_communications.sql
--
-- Purely additive -- five new tables, no changes to existing ones. Safe to
-- run on any install that already has 004_add_branches.sql applied (branches
-- is referenced by communication_logs/communication_campaigns).

CREATE TABLE IF NOT EXISTS communication_templates (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  dojo_id    VARCHAR(50) NOT NULL,
  event_type ENUM('admission','attendance','evaluation','promotion','announcement',
                   'otp','email_campaign','newsletter','marketing_promo',
                   'parent_engagement','report') NOT NULL,
  channel    ENUM('whatsapp','sms','email','chat') NOT NULL,
  name       VARCHAR(120) NOT NULL,
  subject    VARCHAR(200),
  body       TEXT NOT NULL,
  variables  JSON,
  is_active  TINYINT(1) NOT NULL DEFAULT 1,
  created_by VARCHAR(36) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_dojo_event (dojo_id, event_type, channel, is_active)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS communication_provider_configs (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  dojo_id    VARCHAR(50) NOT NULL,
  channel    ENUM('whatsapp','sms','email') NOT NULL,
  provider   VARCHAR(40) NOT NULL DEFAULT 'log',
  config     JSON,
  is_active  TINYINT(1) NOT NULL DEFAULT 1,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_dojo_channel (dojo_id, channel)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS communication_logs (
  id                  INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  dojo_id             VARCHAR(50) NOT NULL,
  branch_id           INT UNSIGNED NULL,
  event_type          ENUM('admission','attendance','evaluation','promotion','announcement',
                            'otp','email_campaign','newsletter','marketing_promo',
                            'parent_engagement','report') NOT NULL,
  channel             ENUM('whatsapp','sms','email','chat') NOT NULL,
  template_id         INT UNSIGNED NULL,
  campaign_id         INT UNSIGNED NULL,
  recipient_type      ENUM('student','parent','user','custom') NOT NULL,
  recipient_ref       VARCHAR(64),
  recipient_name      VARCHAR(120),
  recipient_address   VARCHAR(190) NOT NULL,
  subject             VARCHAR(200),
  body                TEXT NOT NULL,
  status              ENUM('queued','sent','failed') NOT NULL DEFAULT 'queued',
  provider            VARCHAR(40),
  provider_message_id VARCHAR(120),
  error               TEXT,
  sent_by             VARCHAR(36) NOT NULL,
  sent_at             DATETIME NULL,
  created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (branch_id)   REFERENCES branches(id)                 ON DELETE SET NULL,
  FOREIGN KEY (template_id) REFERENCES communication_templates(id)  ON DELETE SET NULL,
  INDEX idx_dojo_created (dojo_id, created_at),
  INDEX idx_event_channel (dojo_id, event_type, channel)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS communication_campaigns (
  id                INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  dojo_id           VARCHAR(50) NOT NULL,
  branch_id         INT UNSIGNED NULL,
  type              ENUM('email_campaign','newsletter','marketing_promo') NOT NULL,
  channel           ENUM('email','whatsapp') NOT NULL,
  template_id       INT UNSIGNED NOT NULL,
  name              VARCHAR(150) NOT NULL,
  audience_filter   JSON,
  status            ENUM('draft','sending','sent','failed') NOT NULL DEFAULT 'draft',
  total_recipients  INT UNSIGNED NOT NULL DEFAULT 0,
  sent_count        INT UNSIGNED NOT NULL DEFAULT 0,
  failed_count      INT UNSIGNED NOT NULL DEFAULT 0,
  created_by        VARCHAR(36) NOT NULL,
  created_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  sent_at           DATETIME NULL,
  FOREIGN KEY (branch_id)   REFERENCES branches(id)                ON DELETE SET NULL,
  FOREIGN KEY (template_id) REFERENCES communication_templates(id) ON DELETE RESTRICT,
  INDEX idx_dojo (dojo_id, status)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS communication_campaign_recipients (
  id                INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  campaign_id       INT UNSIGNED NOT NULL,
  parent_uid        VARCHAR(36),
  recipient_name    VARCHAR(120),
  recipient_address VARCHAR(190) NOT NULL,
  status            ENUM('pending','sent','failed') NOT NULL DEFAULT 'pending',
  error             TEXT,
  sent_at           DATETIME NULL,
  FOREIGN KEY (campaign_id) REFERENCES communication_campaigns(id) ON DELETE CASCADE,
  INDEX idx_campaign (campaign_id, status)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS otp_codes (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  dojo_id     VARCHAR(50) NOT NULL,
  phone       VARCHAR(30) NOT NULL,
  purpose     VARCHAR(40) NOT NULL DEFAULT 'verify_phone',
  code_hash   VARCHAR(255) NOT NULL,
  attempts    TINYINT UNSIGNED NOT NULL DEFAULT 0,
  expires_at  DATETIME NOT NULL,
  consumed_at DATETIME NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_phone (dojo_id, phone, purpose)
) ENGINE=InnoDB;

-- Every dojo gets a 'log' provider row per channel so /communication/providers
-- has something to show immediately (no NULL-provider special-casing needed
-- in the app). Real credentials are added later via PATCH /communication/providers/:channel.
INSERT INTO communication_provider_configs (dojo_id, channel, provider)
SELECT id, 'whatsapp', 'log' FROM dojos
WHERE NOT EXISTS (SELECT 1 FROM communication_provider_configs c WHERE c.dojo_id = dojos.id AND c.channel = 'whatsapp');
INSERT INTO communication_provider_configs (dojo_id, channel, provider)
SELECT id, 'sms', 'log' FROM dojos
WHERE NOT EXISTS (SELECT 1 FROM communication_provider_configs c WHERE c.dojo_id = dojos.id AND c.channel = 'sms');
INSERT INTO communication_provider_configs (dojo_id, channel, provider)
SELECT id, 'email', 'smtp' FROM dojos
WHERE NOT EXISTS (SELECT 1 FROM communication_provider_configs c WHERE c.dojo_id = dojos.id AND c.channel = 'email');
