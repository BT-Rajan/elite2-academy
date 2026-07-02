-- Migration: add profile fields (salutation, split name, phone, photo already exists)
-- Run: mysql -u root -p dojo_platform < database/migrations/003_add_profile_fields.sql

ALTER TABLE users
  ADD COLUMN salutation VARCHAR(10)  NULL AFTER display_name,
  ADD COLUMN first_name VARCHAR(60)  NULL AFTER salutation,
  ADD COLUMN last_name  VARCHAR(60)  NULL AFTER first_name,
  ADD COLUMN phone      VARCHAR(30)  NULL AFTER email;

-- Best-effort backfill of first_name/last_name from the existing display_name
-- so existing accounts have something sensible pre-filled on the profile screen.
UPDATE users
SET first_name = TRIM(SUBSTRING_INDEX(display_name, ' ', 1)),
    last_name  = TRIM(SUBSTRING(display_name, LENGTH(SUBSTRING_INDEX(display_name, ' ', 1)) + 1))
WHERE first_name IS NULL;
