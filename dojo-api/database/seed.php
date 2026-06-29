<?php
/**
 * Seed a test admin user.
 * Run: php database/seed.php
 */
require_once __DIR__ . '/../core/Database.php';

$db  = Database::get();
$uid = bin2hex(random_bytes(18));

$existing = $db->prepare("SELECT id FROM users WHERE email = ?");
$existing->execute(['admin@yourdojo.com']);
if ($existing->fetch()) { echo "Admin already exists.\n"; exit; }

$dojoId = 'dojo-001';
$db->prepare("INSERT IGNORE INTO dojos (id, name) VALUES (?,?)")->execute([$dojoId, 'My Dojo']);
$db->prepare("
    INSERT INTO users (uid, email, password, display_name, role, dojo_id)
    VALUES (?,?,?,?,?,?)")
    ->execute([$uid, 'admin@yourdojo.com',
        password_hash('admin123', PASSWORD_BCRYPT, ['cost'=>12]),
        'Admin User', 'admin', $dojoId]);

echo "Created admin@yourdojo.com / admin123\n";
echo "Dojo ID: $dojoId\n";
