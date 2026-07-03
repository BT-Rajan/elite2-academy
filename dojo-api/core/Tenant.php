<?php
declare(strict_types=1);

require_once __DIR__ . '/Response.php';

/**
 * Central tenant/ownership guards.
 *
 * RULE: dojoId is NEVER trusted from the client (query string or body).
 * It always comes from the authenticated JWT payload. Every lookup of a
 * single resource by ID must go through here so a user can't read/modify
 * another dojo's data by guessing IDs or passing a different dojoId param.
 */
class Tenant {
    public static function dojoId(array $auth): string {
        return $auth['dojoId'];
    }

    public static function student(PDO $db, array $auth, int $studentId): array {
        $stmt = $db->prepare("
            SELECT s.*, b.name AS belt_name, b.color_hex, d.name AS discipline_name
            FROM students s
            LEFT JOIN belts b       ON b.id = s.current_belt_id
            LEFT JOIN disciplines d ON d.id = s.discipline_id
            WHERE s.id = ? AND s.dojo_id = ?");
        $stmt->execute([$studentId, self::dojoId($auth)]);
        $row = $stmt->fetch();
        if (!$row) Response::notFound('Student not found.');
        self::assertParentOwnsOrStaff($auth, $row['parent_uid']);
        return $row;
    }

    public static function session(PDO $db, array $auth, int $sessionId): array {
        $stmt = $db->prepare("SELECT * FROM sessions WHERE id = ? AND dojo_id = ?");
        $stmt->execute([$sessionId, self::dojoId($auth)]);
        $row = $stmt->fetch();
        if (!$row) Response::notFound('Session not found.');
        return $row;
    }

    public static function thread(PDO $db, array $auth, int $threadId): array {
        $stmt = $db->prepare("SELECT * FROM threads WHERE id = ? AND dojo_id = ?");
        $stmt->execute([$threadId, self::dojoId($auth)]);
        $row = $stmt->fetch();
        if (!$row) Response::notFound('Thread not found.');
        $role = $auth['role'] ?? '';
        if ($role === 'parent' && $row['parent_uid'] !== $auth['uid']) Response::forbidden();
        if ($role === 'coach'  && $row['coach_uid']  !== $auth['uid']) Response::forbidden();
        return $row;
    }

    public static function discipline(PDO $db, array $auth, int $disciplineId): array {
        $stmt = $db->prepare("SELECT * FROM disciplines WHERE id = ? AND dojo_id = ?");
        $stmt->execute([$disciplineId, self::dojoId($auth)]);
        $row = $stmt->fetch();
        if (!$row) Response::notFound('Discipline not found.');
        return $row;
    }

    // Belts hang off a discipline, which hangs off a dojo — verify the whole chain.
    public static function belt(PDO $db, array $auth, int $beltId): array {
        $stmt = $db->prepare("
            SELECT b.* FROM belts b
            JOIN disciplines d ON d.id = b.discipline_id
            WHERE b.id = ? AND d.dojo_id = ?");
        $stmt->execute([$beltId, self::dojoId($auth)]);
        $row = $stmt->fetch();
        if (!$row) Response::notFound('Belt not found.');
        return $row;
    }

    // A parent may only see/act on their own uid's data. Coach/staff/admin
    // are scoped to the dojo already (caller must have resolved the row via
    // a dojo-scoped query first) so they're allowed through here.
    public static function assertParentOwnsOrStaff(array $auth, string $resourceParentUid): void {
        if (($auth['role'] ?? '') !== 'parent') return;
        if ($auth['uid'] !== $resourceParentUid) Response::forbidden();
    }

    // For uid-keyed resources (notifications, loyalty) where the client
    // must not be able to read/act on someone else's uid.
    public static function assertOwnUidOrStaff(array $auth, string $targetUid): void {
        if ($auth['uid'] === $targetUid) return;
        if (in_array($auth['role'] ?? '', ['admin', 'coach', 'staff'], true)) return;
        Response::forbidden();
    }
}
