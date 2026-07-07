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

    public static function branchId(array $auth): ?int {
        return isset($auth['branchId']) ? (int)$auth['branchId'] : null;
    }

    public static function branch(PDO $db, array $auth, int $branchId): array {
        $stmt = $db->prepare("SELECT * FROM branches WHERE id = ? AND dojo_id = ?");
        $stmt->execute([$branchId, self::dojoId($auth)]);
        $row = $stmt->fetch();
        if (!$row) Response::notFound('Branch not found.');
        return $row;
    }

    // Admin, Head Coach, and Staff are never restricted to a single branch --
    // they operate dojo-wide (branch CRUD/assignment is admin/head-coach
    // only, per AuthMiddleware::requireBranchManager; staff's dojo-wide reach
    // is specifically for adding/transferring students, per
    // AuthMiddleware::requireTransferPermission). A plain coach (or parent)
    // is scoped to their own branch_id.
    public static function isBranchUnrestricted(array $auth): bool {
        $role = $auth['role'] ?? '';
        if ($role === 'admin' || $role === 'staff') return true;
        if ($role === 'coach' && !empty($auth['isHeadCoach'])) return true;
        return false;
    }

    // General-purpose write guard for branch-tagged resources other than
    // students (sessions, schedules, evaluations): a plain coach may only
    // write within their own branch; everyone covered by
    // isBranchUnrestricted() may write to any branch in the dojo.
    public static function assertBranchWriteAccess(array $auth, int $resourceBranchId): void {
        if (self::isBranchUnrestricted($auth)) return;
        if ((int)$resourceBranchId !== self::branchId($auth)) {
            Response::forbidden('You can only do that within your own branch.');
        }
    }

    // A plain coach may always *view* a student regardless of branch (per
    // spec: "coach can view students in other branches"), but may only
    // *write* (evaluate, comment, mark attendance, edit) students in their
    // own branch. Admin/Staff/Head Coach can write across any branch.
    public static function assertStudentBranchAccess(array $auth, array $student, bool $write = false): void {
        if (self::isBranchUnrestricted($auth)) return;
        if (($auth['role'] ?? '') !== 'coach') return; // parent ownership already checked elsewhere
        if (!$write) return; // coaches can always view
        if ((int)$student['branch_id'] !== self::branchId($auth)) {
            Response::forbidden('You can only modify students in your own branch.');
        }
    }

    public static function student(PDO $db, array $auth, int $studentId): array {
        $stmt = $db->prepare("
            SELECT s.*, b.name AS belt_name, b.color_hex, d.name AS discipline_name, br.name AS branch_name
            FROM students s
            LEFT JOIN belts b       ON b.id = s.current_belt_id
            LEFT JOIN disciplines d ON d.id = s.discipline_id
            LEFT JOIN branches br   ON br.id = s.branch_id
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
