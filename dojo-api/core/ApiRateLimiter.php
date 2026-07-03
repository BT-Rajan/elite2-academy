<?php
declare(strict_types=1);

require_once __DIR__ . '/Response.php';
require_once __DIR__ . '/Env.php';

/**
 * Fixed-window request limiter for the whole API (not just login). Keyed by
 * uid when authenticated, otherwise by IP, so anonymous endpoints (login,
 * register, forgot-password) are covered too. One row per identifier per
 * 60-second window.
 */
class ApiRateLimiter {
    public static function check(PDO $db, string $identifier, ?int $limit = null): void {
        $limit  = $limit ?? (int)Env::get('API_RATE_LIMIT_PER_MINUTE', '300');
        $window = intdiv(time(), 60) * 60;

        $db->prepare("
            INSERT INTO api_rate_limits (identifier, window_start, count)
            VALUES (?, ?, 1)
            ON DUPLICATE KEY UPDATE count = count + 1")
            ->execute([$identifier, $window]);

        $stmt = $db->prepare("SELECT count FROM api_rate_limits WHERE identifier = ? AND window_start = ?");
        $stmt->execute([$identifier, $window]);
        $count = (int)$stmt->fetchColumn();

        if ($count > $limit) Response::tooManyRequests();

        // Cheap opportunistic cleanup of old windows -- no cron needed.
        if (random_int(1, 200) === 1) {
            $db->prepare("DELETE FROM api_rate_limits WHERE window_start < ?")->execute([$window - 300]);
        }
    }

    public static function clientIdentifier(): string {
        return $_SERVER['HTTP_X_FORWARDED_FOR'] ?? $_SERVER['REMOTE_ADDR'] ?? 'unknown';
    }
}
