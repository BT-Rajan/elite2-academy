-- Migration: add 'achievement' to notifications.type.
-- Run: mysql -u root -p dojo_platform < database/migrations/006_add_achievement_notification_type.sql
--
-- StudentController::updateObjective() has always called
-- notify($parentUid, 'achievement', ...) when a coach marks a student
-- objective complete, but the notifications.type ENUM never included
-- 'achievement' -- every completed-objective notification 500'd
-- (SQLSTATE truncation error on the INSERT) instead of ever notifying the
-- parent. This adds the missing enum value; no existing rows need
-- backfilling since no 'achievement' row could ever have been inserted.
ALTER TABLE notifications
  MODIFY COLUMN type ENUM('message','attendance','belt','loyalty','system','achievement') NOT NULL;
