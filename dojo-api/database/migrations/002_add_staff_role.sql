-- Migration: add 'staff' as a valid role
-- Run: mysql -u root -p dojo_platform < database/migrations/002_add_staff_role.sql

ALTER TABLE users
  MODIFY COLUMN role ENUM('admin','coach','parent','staff') NOT NULL;

ALTER TABLE messages
  MODIFY COLUMN from_role ENUM('admin','coach','parent','staff') NOT NULL;
