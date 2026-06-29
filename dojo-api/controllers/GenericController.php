<?php
declare(strict_types=1);

require_once __DIR__ . '/../core/Database.php';
require_once __DIR__ . '/../core/Response.php';
require_once __DIR__ . '/../middleware/Auth.php';

/**
 * GenericController — handles all remaining REST endpoints:
 *  disciplines, belts, schedules, threads/messages,
 *  loyalty, notifications, users, dojos
 */
class GenericController {
    private PDO $db;
    public function __construct() { $this->db = Database::get(); }

    // ── Disciplines ───────────────────────────────────────────────────────────
    public function listDisciplines(): never {
        $auth = AuthMiddleware::require();
        $dojoId = $_GET['dojoId'] ?? $auth['dojoId'];
        $stmt = $this->db->prepare("SELECT * FROM disciplines WHERE dojo_id = ? ORDER BY name");
        $stmt->execute([$dojoId]);
        Response::ok($stmt->fetchAll());
    }
    public function createDiscipline(): never {
        $auth = AuthMiddleware::require();
        AuthMiddleware::requireRole($auth, 'admin');
        $b = $this->body();
        $this->db->prepare("INSERT INTO disciplines (dojo_id, name, description, color) VALUES (?,?,?,?)")
            ->execute([$auth['dojoId'], $b['name'] ?? '', $b['description'] ?? null, $b['color'] ?? '#6366f1']);
        Response::created(['id' => $this->db->lastInsertId()]);
    }
    public function updateDiscipline(int $id): never {
        $auth = AuthMiddleware::require();
        AuthMiddleware::requireRole($auth, 'admin');
        $b = $this->body();
        $this->db->prepare("UPDATE disciplines SET name=?, description=?, color=? WHERE id=? AND dojo_id=?")
            ->execute([$b['name'] ?? '', $b['description'] ?? null, $b['color'] ?? '#6366f1', $id, $auth['dojoId']]);
        Response::ok(['updated' => true]);
    }
    public function listBelts(int $discId): never {
        AuthMiddleware::require();
        $stmt = $this->db->prepare("SELECT * FROM belts WHERE discipline_id = ? ORDER BY sort_order");
        $stmt->execute([$discId]);
        Response::ok($stmt->fetchAll());
    }
    public function createBelt(int $discId): never {
        $auth = AuthMiddleware::require();
        AuthMiddleware::requireRole($auth, 'admin');
        $b = $this->body();
        $this->db->prepare("INSERT INTO belts (discipline_id, name, color_hex, sort_order, min_classes, min_score) VALUES (?,?,?,?,?,?)")
            ->execute([$discId, $b['name'] ?? '', $b['colorHex'] ?? '#fff', $b['sortOrder'] ?? 1, $b['minClasses'] ?? 0, $b['minScore'] ?? 0]);
        Response::created(['id' => $this->db->lastInsertId()]);
    }
    public function updateBelt(int $discId, int $beltId): never {
        $auth = AuthMiddleware::require();
        AuthMiddleware::requireRole($auth, 'admin');
        $b = $this->body();
        $this->db->prepare("UPDATE belts SET name=?, color_hex=?, sort_order=?, min_classes=?, min_score=? WHERE id=? AND discipline_id=?")
            ->execute([$b['name'] ?? '', $b['colorHex'] ?? '#fff', $b['sortOrder'] ?? 1, $b['minClasses'] ?? 0, $b['minScore'] ?? 0, $beltId, $discId]);
        Response::ok(['updated' => true]);
    }

    // ── Schedules ─────────────────────────────────────────────────────────────
    public function listSchedules(): never {
        $dojoId   = $_GET['dojoId']   ?? '';
        $isActive = $_GET['isActive'] ?? '1';
        if (!$dojoId) Response::error('dojoId required.');
        $stmt = $this->db->prepare("
            SELECT sc.*, d.name AS discipline_name, d.color AS discipline_color
            FROM schedules sc
            LEFT JOIN disciplines d ON d.id = sc.discipline_id
            WHERE sc.dojo_id = ? AND sc.is_active = ?
            ORDER BY sc.day_of_week, sc.start_time");
        $stmt->execute([$dojoId, (int)$isActive]);
        Response::ok($stmt->fetchAll());
    }
    public function createSchedule(): never {
        $auth = AuthMiddleware::require();
        AuthMiddleware::requireRole($auth, 'admin', 'coach');
        $b = $this->body();
        $this->db->prepare("INSERT INTO schedules (dojo_id, discipline_id, coach_uid, name, day_of_week, start_time, end_time, location) VALUES (?,?,?,?,?,?,?,?)")
            ->execute([$auth['dojoId'], $b['disciplineId'] ?? null, $b['coachUid'] ?? $auth['uid'], $b['name'] ?? 'Class', $b['dayOfWeek'] ?? 0, $b['startTime'] ?? '09:00', $b['endTime'] ?? '10:00', $b['location'] ?? null]);
        Response::created(['id' => $this->db->lastInsertId()]);
    }
    public function updateSchedule(int $id): never {
        $auth = AuthMiddleware::require();
        AuthMiddleware::requireRole($auth, 'admin', 'coach');
        $b = $this->body();
        $this->db->prepare("UPDATE schedules SET name=?, day_of_week=?, start_time=?, end_time=?, location=?, is_active=? WHERE id=? AND dojo_id=?")
            ->execute([$b['name'] ?? '', $b['dayOfWeek'] ?? 0, $b['startTime'] ?? '09:00', $b['endTime'] ?? '10:00', $b['location'] ?? null, (int)($b['isActive'] ?? 1), $id, $auth['dojoId']]);
        Response::ok(['updated' => true]);
    }

    // ── Threads & Messages ────────────────────────────────────────────────────
    public function listThreads(): never {
        $auth      = AuthMiddleware::require();
        $coachUid  = $_GET['coachUid']  ?? null;
        $parentUid = $_GET['parentUid'] ?? null;
        $sql = "SELECT t.*, s.first_name AS student_first, s.last_name AS student_last FROM threads t LEFT JOIN students s ON s.id = t.student_id WHERE 1=1";
        $p = [];
        if ($coachUid)  { $sql .= " AND t.coach_uid = ?";  $p[] = $coachUid; }
        if ($parentUid) { $sql .= " AND t.parent_uid = ?"; $p[] = $parentUid; }
        $sql .= " ORDER BY t.last_at DESC LIMIT 50";
        $stmt = $this->db->prepare($sql); $stmt->execute($p);
        Response::ok($stmt->fetchAll());
    }
    public function createThread(): never {
        $auth = AuthMiddleware::require();
        AuthMiddleware::requireRole($auth, 'admin', 'coach');
        $b = $this->body();
        $this->db->prepare("INSERT INTO threads (dojo_id, student_id, parent_uid, coach_uid) VALUES (?,?,?,?)")
            ->execute([$auth['dojoId'], $b['studentId'] ?? 0, $b['parentUid'] ?? '', $auth['uid']]);
        Response::created(['id' => $this->db->lastInsertId()]);
    }
    public function listMessages(int $threadId): never {
        AuthMiddleware::require();
        $stmt = $this->db->prepare("SELECT * FROM messages WHERE thread_id = ? ORDER BY sent_at ASC LIMIT 100");
        $stmt->execute([$threadId]);
        Response::ok($stmt->fetchAll());
    }
    public function sendMessage(int $threadId): never {
        $auth = AuthMiddleware::require();
        $b = $this->body();
        $this->db->prepare("INSERT INTO messages (thread_id, from_uid, from_name, from_role, body) VALUES (?,?,?,?,?)")
            ->execute([$threadId, $auth['uid'], $b['fromName'] ?? '', $auth['role'], $b['text'] ?? '']);
        $this->db->prepare("UPDATE threads SET last_message=?, last_at=NOW(), unread_parent = unread_parent + IF(?='coach',1,0), unread_coach = unread_coach + IF(?='parent',1,0) WHERE id=?")
            ->execute([substr($b['text'] ?? '', 0, 200), $auth['role'], $auth['role'], $threadId]);
        // Notify recipient
        $thread = $this->db->prepare("SELECT parent_uid, coach_uid FROM threads WHERE id = ?")->execute([$threadId]);
        $t = $this->db->query("SELECT parent_uid, coach_uid FROM threads WHERE id = $threadId")->fetch();
        if ($t) {
            $recipientUid = $auth['role'] === 'coach' ? $t['parent_uid'] : $t['coach_uid'];
            $this->db->prepare("INSERT INTO notifications (uid, type, title, body) VALUES (?,?,?,?)")
                ->execute([$recipientUid, 'message', 'New message from ' . ($b['fromName'] ?? ''), substr($b['text'] ?? '', 0, 100)]);
        }
        Response::created(['id' => $this->db->lastInsertId()]);
    }
    public function markThreadRead(int $threadId): never {
        $auth = AuthMiddleware::require();
        $b = $this->body();
        $role = $b['role'] ?? $auth['role'];
        $col  = $role === 'coach' ? 'unread_coach' : 'unread_parent';
        $this->db->prepare("UPDATE threads SET $col = 0 WHERE id = ?")->execute([$threadId]);
        Response::ok(['updated' => true]);
    }

    // ── Loyalty ───────────────────────────────────────────────────────────────
    public function getLoyalty(string $parentUid): never {
        AuthMiddleware::require();
        $stmt = $this->db->prepare("SELECT * FROM loyalty_accounts WHERE parent_uid = ?");
        $stmt->execute([$parentUid]);
        $row = $stmt->fetch();
        Response::ok($row ?: null);
    }
    public function listTransactions(string $parentUid): never {
        AuthMiddleware::require();
        $acct = $this->db->prepare("SELECT id FROM loyalty_accounts WHERE parent_uid = ?");
        $acct->execute([$parentUid]);
        $row = $acct->fetch();
        if (!$row) Response::ok([]);
        $stmt = $this->db->prepare("SELECT * FROM loyalty_transactions WHERE account_id = ? ORDER BY created_at DESC LIMIT 50");
        $stmt->execute([$row['id']]);
        Response::ok($stmt->fetchAll());
    }
    public function listRewards(): never {
        AuthMiddleware::require();
        $dojoId = $_GET['dojoId'] ?? '';
        if (!$dojoId) Response::error('dojoId required.');
        $stmt = $this->db->prepare("SELECT * FROM loyalty_rewards WHERE dojo_id = ? AND is_active = 1");
        $stmt->execute([$dojoId]);
        Response::ok($stmt->fetchAll());
    }
    public function createReward(): never {
        $auth = AuthMiddleware::require();
        AuthMiddleware::requireRole($auth, 'admin');
        $b = $this->body();
        $this->db->prepare("INSERT INTO loyalty_rewards (dojo_id, name, description, points_cost, type, discount_pct, is_active) VALUES (?,?,?,?,?,?,1)")
            ->execute([$auth['dojoId'], $b['name'] ?? '', $b['description'] ?? null, $b['pointsCost'] ?? 0, $b['type'] ?? 'custom', $b['discountPct'] ?? null]);
        Response::created(['id' => $this->db->lastInsertId()]);
    }
    public function updateReward(int $id): never {
        $auth = AuthMiddleware::require();
        AuthMiddleware::requireRole($auth, 'admin');
        $b = $this->body();
        $this->db->prepare("UPDATE loyalty_rewards SET is_active=? WHERE id=? AND dojo_id=?")
            ->execute([(int)($b['isActive'] ?? 1), $id, $auth['dojoId']]);
        Response::ok(['updated' => true]);
    }
    public function redeemReward(string $parentUid): never {
        $auth = AuthMiddleware::require();
        $b = $this->body();
        $reward = $this->db->prepare("SELECT * FROM loyalty_rewards WHERE id = ? AND is_active = 1");
        $reward->execute([$b['rewardId'] ?? 0]);
        $r = $reward->fetch();
        if (!$r) Response::notFound('Reward not found.');
        $acct = $this->db->prepare("SELECT * FROM loyalty_accounts WHERE parent_uid = ?");
        $acct->execute([$parentUid]);
        $a = $acct->fetch();
        if (!$a || $a['points'] < $r['points_cost']) Response::error('Insufficient points.', 400);
        $this->db->prepare("UPDATE loyalty_accounts SET points = points - ? WHERE parent_uid = ?")
            ->execute([$r['points_cost'], $parentUid]);
        $this->db->prepare("INSERT INTO loyalty_transactions (account_id, amount, reason, note) VALUES (?,?,?,?)")
            ->execute([$a['id'], -$r['points_cost'], 'redemption', "Redeemed: {$r['name']}"]);
        Response::ok(['redeemed' => $r['name'], 'pointsUsed' => $r['points_cost']]);
    }

    // ── Notifications ─────────────────────────────────────────────────────────
    public function listNotifications(): never {
        $auth = AuthMiddleware::require();
        $uid = $_GET['uid'] ?? $auth['uid'];
        $stmt = $this->db->prepare("SELECT * FROM notifications WHERE uid = ? ORDER BY created_at DESC LIMIT 50");
        $stmt->execute([$uid]);
        Response::ok($stmt->fetchAll());
    }
    public function updateNotification(int $id): never {
        $auth = AuthMiddleware::require();
        $b = $this->body();
        $this->db->prepare("UPDATE notifications SET is_read=? WHERE id=? AND uid=?")
            ->execute([(int)($b['isRead'] ?? 1), $id, $auth['uid']]);
        Response::ok(['updated' => true]);
    }
    public function markAllNotificationsRead(): never {
        $auth = AuthMiddleware::require();
        $b = $this->body();
        $uid = $b['uid'] ?? $auth['uid'];
        $this->db->prepare("UPDATE notifications SET is_read=1 WHERE uid=?")->execute([$uid]);
        Response::ok(['updated' => true]);
    }

    // ── Users ─────────────────────────────────────────────────────────────────
    public function listUsers(): never {
        $auth   = AuthMiddleware::require();
        $dojoId = $_GET['dojoId'] ?? $auth['dojoId'];
        $role   = $_GET['role']   ?? null;
        $sql = "SELECT uid, email, display_name, role, dojo_id, avatar_url, created_at FROM users WHERE dojo_id = ? AND is_active = 1";
        $p = [$dojoId];
        if ($role) { $sql .= " AND role = ?"; $p[] = $role; }
        $sql .= " ORDER BY display_name";
        $stmt = $this->db->prepare($sql); $stmt->execute($p);
        Response::ok($stmt->fetchAll());
    }

    // ── Dojos ─────────────────────────────────────────────────────────────────
    public function getDojo(string $id): never {
        $auth = AuthMiddleware::require();
        $stmt = $this->db->prepare("SELECT * FROM dojos WHERE id = ?");
        $stmt->execute([$id]);
        $row = $stmt->fetch();
        Response::ok($row ?: null);
    }
    public function updateDojo(string $id): never {
        $auth = AuthMiddleware::require();
        AuthMiddleware::requireRole($auth, 'admin');
        $b = $this->body();
        $this->db->prepare("INSERT INTO dojos (id, name, email, phone, address, timezone) VALUES (?,?,?,?,?,?) ON DUPLICATE KEY UPDATE name=VALUES(name), email=VALUES(email), phone=VALUES(phone), address=VALUES(address), timezone=VALUES(timezone)")
            ->execute([$id, $b['name'] ?? '', $b['email'] ?? null, $b['phone'] ?? null, $b['address'] ?? null, $b['timezone'] ?? 'UTC']);
        Response::ok(['updated' => true]);
    }
    public function updateDojoSettings(string $id): never {
        $auth = AuthMiddleware::require();
        AuthMiddleware::requireRole($auth, 'admin');
        $b = $this->body();
        $settings = json_encode($b);
        $this->db->prepare("UPDATE dojos SET settings = JSON_MERGE_PATCH(COALESCE(settings,'{}'), ?) WHERE id=?")
            ->execute([$settings, $id]);
        Response::ok(['updated' => true]);
    }

    private function body(): array {
        return (array)json_decode(file_get_contents('php://input'), true);
    }
}
