<?php
declare(strict_types=1);

class Database {
    private static ?PDO $instance = null;

    public static function get(): PDO {
        if (self::$instance) return self::$instance;
        $cfg = require __DIR__ . '/../config.php';
        $dsn = "mysql:host={$cfg['db_host']};dbname={$cfg['db_name']};charset=utf8mb4";
        self::$instance = new PDO($dsn, $cfg['db_user'], $cfg['db_pass'], [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false,
        ]);
        return self::$instance;
    }
}
