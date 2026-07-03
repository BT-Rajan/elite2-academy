<?php
declare(strict_types=1);

/**
 * Durable audit trail for sensitive actions (approvals, role changes,
 * evaluation overrules, forced promotions) — kept in its own table so it
 * can be queried/reported on, unlike the free-text app log.
 */
class Audit {
    public static function log(PDO $db, array $auth, string $action, string $targetType, string $targetId, array $meta = []): void {
        $db->prepare("
            INSERT INTO audit_log (actor_uid, actor_role, dojo_id, action, target_type, target_id, meta)
            VALUES (?, ?, ?, ?, ?, ?, ?)")
            ->execute([
                $auth['uid'] ?? null,
                $auth['role'] ?? null,
                $auth['dojoId'] ?? null,
                $action,
                $targetType,
                $targetId,
                $meta ? json_encode($meta) : null,
            ]);
    }
}
