<?php
require_once __DIR__ . '/core/Env.php';
Env::load();

return [
    'db_host'          => Env::get('DB_HOST', 'localhost'),
    'db_name'          => Env::get('DB_NAME', 'dojo_platform'),
    'db_user'          => Env::get('DB_USER', 'root'),
    'db_pass'          => Env::get('DB_PASS', ''),
    'jwt_secret'       => Env::get('JWT_SECRET', 'CHANGE_THIS_TO_A_64_CHAR_RANDOM_STRING_BEFORE_USE'),
    'jwt_expiry'       => (int)Env::get('JWT_EXPIRY', '3600'),
    'mail_from'        => Env::get('MAIL_FROM', 'noreply@yourdojo.com'),
    'mail_from_name'   => Env::get('MAIL_FROM_NAME', 'Dojo Platform'),
    'app_url'          => Env::get('APP_URL', 'http://localhost:4200'),
    'allowed_origins'  => array_filter(array_map('trim', explode(',', Env::get('ALLOWED_ORIGINS', 'http://localhost:4200')))),
];
