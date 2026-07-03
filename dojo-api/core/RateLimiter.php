<?php
declare(strict_types=1);

require_once __DIR__ . '/Env.php';

/**
 * Simple per-identifier (email, lowercased) login throttle backed by the
 * login_attempts table. No Redis dependency needed at this scale.
 */
class RateLimiter {
    private PDO $db;
    private int $maxAttempts;
    private int $lockoutMinutes;

    public function __construct(PDO $db) {
        $this->db             = $db;
        $this->maxAttempts    = (int)(Env::get('LOGIN_MAX_ATTEMPTS', '5'));
        $this->lockoutMinutes = (int)(Env::get('LOGIN_LOCKOUT_MINUTES', '15'));
    }

    /** Returns minutes remaining if locked out, or null if the attempt may proceed. */
    public function checkLocked(string $identifier): ?int {
        $identifier = strtolower(trim($identifier));
        $stmt = $this->db->prepare("SELECT locked_until FROM login_attempts WHERE identifier = ?");
        $stmt->execute([$identifier]);
        $lockedUntil = $stmt->fetchColumn();
        if (!$lockedUntil) return null;

        $remaining = strtotime($lockedUntil) - time();
        return $remaining > 0 ? (int)ceil($remaining / 60) : null;
    }

    public function recordFailure(string $identifier): void {
        $identifier = strtolower(trim($identifier));
        $this->db->prepare("
            INSERT INTO login_attempts (identifier, attempts, first_attempt_at, updated_at)
            VALUES (?, 1, NOW(), NOW())
            ON DUPLICATE KEY UPDATE
                attempts = IF(locked_until IS NOT NULL AND locked_until < NOW(), 1, attempts + 1),
                first_attempt_at = IF(locked_until IS NOT NULL AND locked_until < NOW(), NOW(), first_attempt_at),
                locked_until = CASE
                    WHEN (IF(locked_until IS NOT NULL AND locked_until < NOW(), 1, attempts + 1)) >= ?
                    THEN DATE_ADD(NOW(), INTERVAL ? MINUTE)
                    ELSE locked_until
                END,
                updated_at = NOW()
        ")->execute([$identifier, $this->maxAttempts, $this->lockoutMinutes]);
    }

    public function recordSuccess(string $identifier): void {
        $identifier = strtolower(trim($identifier));
        $this->db->prepare("DELETE FROM login_attempts WHERE identifier = ?")->execute([$identifier]);
    }
}
