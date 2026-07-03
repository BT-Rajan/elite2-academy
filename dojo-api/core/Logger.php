<?php
declare(strict_types=1);

/**
 * Structured (JSON-lines) application logger. Not an APM replacement, but
 * gives grep-able, machine-parseable logs instead of nothing, and is what
 * ErrorMessages::logAndGet() and the request logger in api/index.php write
 * through.
 */
class Logger {
    private static function path(): string {
        return __DIR__ . '/../storage/logs/app.log';
    }

    private static function write(string $level, string $message, array $context = []): void {
        $path = self::path();
        $dir  = dirname($path);
        if (!is_dir($dir)) @mkdir($dir, 0755, true);
        $line = json_encode([
            'ts'      => date('c'),
            'level'   => $level,
            'message' => $message,
            'context' => $context,
        ], JSON_UNESCAPED_SLASHES) . "\n";
        @file_put_contents($path, $line, FILE_APPEND | LOCK_EX);
    }

    public static function info(string $message, array $context = []): void    { self::write('info', $message, $context); }
    public static function warning(string $message, array $context = []): void { self::write('warning', $message, $context); }
    public static function error(string $message, array $context = []): void   { self::write('error', $message, $context); }
}
