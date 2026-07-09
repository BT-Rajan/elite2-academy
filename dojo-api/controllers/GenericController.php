<?php
declare(strict_types=1);

require_once __DIR__ . '/../core/Database.php';
require_once __DIR__ . '/../core/Response.php';
require_once __DIR__ . '/../core/ErrorMessages.php';
require_once __DIR__ . '/../core/Tenant.php';
require_once __DIR__ . '/../core/Audit.php';
require_once __DIR__ . '/../core/Validator.php';
require_once __DIR__ . '/../middleware/Auth.php';

/**
 * GenericController — handles all remaining REST endpoints:
 *  disciplines, belts, schedules, threads/messages,
 *  loyalty, notifications, users, dojos, account approvals.
 *
 * RULE (see core/Tenant.php): dojoId/uid scoping always comes from the
 * authenticated JWT payload, never from client query/body params.
 */
class GenericController {
    private PDO $db;
    public function __construct() { $this->db = Database::get(); }

    // ── Disciplines ───────────────────────────────────────────────────────────
    public function listDisciplines(): never {
        $auth = AuthMiddleware::require();
        $stmt = $this->db->prepare("SELECT * FROM disciplines WHERE dojo_id = ? ORDER BY name");
        $stmt->execute([Tenant::dojoId($auth)]);
        Response::ok($stmt->fetchAll());
    }
    public function createDiscipline(): never {
        $auth = AuthMiddleware::require();
        AuthMiddleware::requireRole($auth, 'admin');
        $b = $this->body();
        Validator::make($b)->required('name')->string('name', 1, 100)->hexColor('color')->check();
        $this->db->prepare("INSERT INTO disciplines (dojo_id, name, description, color) VALUES (?,?,?,?)")
            ->execute([$auth['dojoId'], $b['name'] ?? '', $b['description'] ?? null, $b['color'] ?? '#6366f1']);
        Response::created(['id' => $this->db->lastInsertId()]);
    }
    public function updateDiscipline(int $id): never {
        $auth = AuthMiddleware::require();
        AuthMiddleware::requireRole($auth, 'admin');
        Tenant::discipline($this->db, $auth, $id);
        $b = $this->body();
        $this->db->prepare("UPDATE disciplines SET name=?, description=?, color=? WHERE id=? AND dojo_id=?")
            ->execute([$b['name'] ?? '', $b['description'] ?? null, $b['color'] ?? '#6366f1', $id, $auth['dojoId']]);
        Response::ok(['updated' => true]);
    }
    public function listBelts(int $discId): never {
        $auth = AuthMiddleware::require();
        Tenant::discipline($this->db, $auth, $discId);
        $stmt = $this->db->prepare("SELECT * FROM belts WHERE discipline_id = ? ORDER BY sort_order");
        $stmt->execute([$discId]);
        Response::ok($stmt->fetchAll());
    }
    public function createBelt(int $discId): never {
        $auth = AuthMiddleware::require();
        AuthMiddleware::requireRole($auth, 'admin');
        Tenant::discipline($this->db, $auth, $discId);
        $b = $this->body();
        Validator::make($b)
            ->required('name')->string('name', 1, 60)
            ->hexColor('colorHex')
            ->int('sortOrder', 1, 100)
            ->int('minClasses', 0)
            ->int('minScore', 0)
            ->int('seminarPointsRequired', 0)
            ->check();
        $this->db->prepare("
            INSERT INTO belts (discipline_id, name, color_hex, sort_order, min_classes, min_score,
                                kickboxing_level, bjj_stripe_label, seminar_points_required)
            VALUES (?,?,?,?,?,?,?,?,?)")
            ->execute([
                $discId, $b['name'] ?? '', $b['colorHex'] ?? '#fff', $b['sortOrder'] ?? 1,
                $b['minClasses'] ?? 0, $b['minScore'] ?? 0,
                $b['kickboxingLevel'] ?? null, $b['bjjStripeLabel'] ?? null, $b['seminarPointsRequired'] ?? 0,
            ]);
        Response::created(['id' => $this->db->lastInsertId()]);
    }
    public function updateBelt(int $discId, int $beltId): never {
        $auth = AuthMiddleware::require();
        AuthMiddleware::requireRole($auth, 'admin');
        Tenant::discipline($this->db, $auth, $discId);
        $b = $this->body();
        $this->db->prepare("
            UPDATE belts SET name=?, color_hex=?, sort_order=?, min_classes=?, min_score=?,
                              kickboxing_level=?, bjj_stripe_label=?, seminar_points_required=?
            WHERE id=? AND discipline_id=?")
            ->execute([
                $b['name'] ?? '', $b['colorHex'] ?? '#fff', $b['sortOrder'] ?? 1,
                $b['minClasses'] ?? 0, $b['minScore'] ?? 0,
                $b['kickboxingLevel'] ?? null, $b['bjjStripeLabel'] ?? null, $b['seminarPointsRequired'] ?? 0,
                $beltId, $discId,
            ]);
        Response::ok(['updated' => true]);
    }

    // ── Schedules ─────────────────────────────────────────────────────────────
    public function listSchedules(): never {
        $auth     = AuthMiddleware::require();
        $isActive = $_GET['isActive'] ?? '1';
        $branchId = isset($_GET['branchId']) ? (int)$_GET['branchId'] : null;
        $sql = "
            SELECT sc.*, d.name AS discipline_name, d.color AS discipline_color
            FROM schedules sc
            LEFT JOIN disciplines d ON d.id = sc.discipline_id
            WHERE sc.dojo_id = ? AND sc.is_active = ?";
        $p = [Tenant::dojoId($auth), (int)$isActive];
        if ($branchId) { $sql .= " AND sc.branch_id = ?"; $p[] = $branchId; }
        $sql .= " ORDER BY sc.day_of_week, sc.start_time";
        $stmt = $this->db->prepare($sql);
        $stmt->execute($p);
        Response::ok($stmt->fetchAll());
    }
    public function createSchedule(): never {
        $auth = AuthMiddleware::require();
        AuthMiddleware::requireRole($auth, 'admin', 'coach');
        $b = $this->body();
        Validator::make($b)
            ->required('name')->string('name', 1, 100)
            ->int('dayOfWeek', 0, 6)
            ->time('startTime')
            ->time('endTime')
            ->int('branchId', 1)
            ->check();
        $branchId = !empty($b['branchId']) ? (int)$b['branchId'] : Tenant::branchId($auth);
        if (!$branchId) Response::error('branchId is required.', 422);
        Tenant::assertBranchWriteAccess($auth, $branchId);
        Tenant::branch($this->db, $auth, $branchId); // validates it belongs to this dojo
        $this->db->prepare("INSERT INTO schedules (dojo_id, branch_id, discipline_id, coach_uid, name, day_of_week, start_time, end_time, location) VALUES (?,?,?,?,?,?,?,?,?)")
            ->execute([$auth['dojoId'], $branchId, $b['disciplineId'] ?? null, $b['coachUid'] ?? $auth['uid'], $b['name'] ?? 'Class', $b['dayOfWeek'] ?? 0, $b['startTime'] ?? '09:00', $b['endTime'] ?? '10:00', $b['location'] ?? null]);
        Response::created(['id' => $this->db->lastInsertId()]);
    }
    public function updateSchedule(int $id): never {
        $auth = AuthMiddleware::require();
        AuthMiddleware::requireRole($auth, 'admin', 'coach');
        $existing = $this->db->prepare("SELECT branch_id FROM schedules WHERE id = ? AND dojo_id = ?");
        $existing->execute([$id, $auth['dojoId']]);
        $row = $existing->fetch();
        if (!$row) Response::notFound('Schedule not found.');
        Tenant::assertBranchWriteAccess($auth, (int)$row['branch_id']);
        $b = $this->body();
        $stmt = $this->db->prepare("UPDATE schedules SET name=?, day_of_week=?, start_time=?, end_time=?, location=?, is_active=? WHERE id=? AND dojo_id=?");
        $stmt->execute([$b['name'] ?? '', $b['dayOfWeek'] ?? 0, $b['startTime'] ?? '09:00', $b['endTime'] ?? '10:00', $b['location'] ?? null, (int)($b['isActive'] ?? 1), $id, $auth['dojoId']]);
        Response::ok(['updated' => true]);
    }

    // ── Threads & Messages ────────────────────────────────────────────────────
    public function listThreads(): never {
        $auth = AuthMiddleware::require();
        $sql = "SELECT t.*, s.first_name AS student_first, s.last_name AS student_last
                FROM threads t LEFT JOIN students s ON s.id = t.student_id
                WHERE t.dojo_id = ?";
        $p = [Tenant::dojoId($auth)];
        // Non-admin/staff only ever see their own threads, regardless of any
        // coachUid/parentUid the client might pass.
        if ($auth['role'] === 'coach')  { $sql .= " AND t.coach_uid = ?";  $p[] = $auth['uid']; }
        if ($auth['role'] === 'parent') { $sql .= " AND t.parent_uid = ?"; $p[] = $auth['uid']; }
        $sql .= " ORDER BY t.last_at DESC LIMIT 50";
        $stmt = $this->db->prepare($sql); $stmt->execute($p);
        Response::ok($stmt->fetchAll());
    }
    public function createThread(): never {
        $auth = AuthMiddleware::require();
        AuthMiddleware::requireRole($auth, 'admin', 'coach');
        $b = $this->body();
        Tenant::student($this->db, $auth, (int)($b['studentId'] ?? 0));
        $this->db->prepare("INSERT INTO threads (dojo_id, student_id, parent_uid, coach_uid) VALUES (?,?,?,?)")
            ->execute([$auth['dojoId'], $b['studentId'] ?? 0, $b['parentUid'] ?? '', $auth['uid']]);
        Response::created(['id' => $this->db->lastInsertId()]);
    }
    public function listMessages(int $threadId): never {
        $auth = AuthMiddleware::require();
        Tenant::thread($this->db, $auth, $threadId);
        $stmt = $this->db->prepare("
            SELECT id, thread_id, from_uid, from_name, from_role,
                   body AS text, sent_at, read_at
            FROM messages WHERE thread_id = ? ORDER BY sent_at ASC LIMIT 100");
        $stmt->execute([$threadId]);
        Response::ok($stmt->fetchAll());
    }
    public function sendMessage(int $threadId): never {
        $auth = AuthMiddleware::require();
        $thread = Tenant::thread($this->db, $auth, $threadId);
        $b = $this->body();
        $this->db->prepare("INSERT INTO messages (thread_id, from_uid, from_name, from_role, body) VALUES (?,?,?,?,?)")
            ->execute([$threadId, $auth['uid'], $b['fromName'] ?? '', $auth['role'], $b['text'] ?? '']);
        $this->db->prepare("UPDATE threads SET last_message=?, last_at=NOW(), unread_parent = unread_parent + IF(?='coach',1,0), unread_coach = unread_coach + IF(?='parent',1,0) WHERE id=?")
            ->execute([substr($b['text'] ?? '', 0, 200), $auth['role'], $auth['role'], $threadId]);
        $recipientUid = $auth['role'] === 'coach' ? $thread['parent_uid'] : $thread['coach_uid'];
        $this->db->prepare("INSERT INTO notifications (uid, type, title, body) VALUES (?,?,?,?)")
            ->execute([$recipientUid, 'message', 'New message from ' . ($b['fromName'] ?? ''), substr($b['text'] ?? '', 0, 100)]);
        Response::created(['id' => $this->db->lastInsertId()]);
    }
    public function markThreadRead(int $threadId): never {
        $auth = AuthMiddleware::require();
        Tenant::thread($this->db, $auth, $threadId);
        $col = $auth['role'] === 'coach' ? 'unread_coach' : 'unread_parent';
        $this->db->prepare("UPDATE threads SET $col = 0 WHERE id = ?")->execute([$threadId]);
        Response::ok(['updated' => true]);
    }

    // ── Loyalty ───────────────────────────────────────────────────────────────
    public function getLoyalty(string $parentUid): never {
        $auth = AuthMiddleware::require();
        Tenant::assertOwnUidOrStaff($auth, $parentUid);
        $stmt = $this->db->prepare("SELECT * FROM loyalty_accounts WHERE parent_uid = ? AND dojo_id = ?");
        $stmt->execute([$parentUid, Tenant::dojoId($auth)]);
        Response::ok($stmt->fetch() ?: null);
    }
    // GET /loyalty-accounts — Admin/Staff/Coach only. Dojo-wide list for
    // reporting (tier distribution, etc.) -- the single-parent lookup
    // above can't answer "how many families are in each tier".
    public function listLoyaltyAccounts(): never {
        $auth = AuthMiddleware::require();
        AuthMiddleware::requireRole($auth, 'admin', 'coach', 'staff');
        $stmt = $this->db->prepare("
            SELECT la.*, u.display_name AS parent_name
            FROM loyalty_accounts la
            JOIN users u ON u.uid = la.parent_uid
            WHERE la.dojo_id = ?
            ORDER BY la.points DESC");
        $stmt->execute([Tenant::dojoId($auth)]);
        Response::ok($stmt->fetchAll());
    }
    public function awardLoyalty(string $parentUid): never {
        $auth = AuthMiddleware::require();
        AuthMiddleware::requireRole($auth, 'admin', 'coach');
        $dojoId = Tenant::dojoId($auth);
        $b      = $this->body();
        $amount = (int)($b['amount'] ?? 0);
        $reason = $b['reason'] ?? 'manual';
        $note   = $b['note']   ?? null;

        $acct = $this->db->prepare("SELECT id, lifetime_points FROM loyalty_accounts WHERE parent_uid = ? AND dojo_id = ?");
        $acct->execute([$parentUid, $dojoId]);
        $row = $acct->fetch();

        if ($row) {
            $newLifetime = $row['lifetime_points'] + max(0, $amount);
            $tier = $newLifetime >= 3000 ? 'platinum' : ($newLifetime >= 1500 ? 'gold' : ($newLifetime >= 500 ? 'silver' : 'bronze'));
            $this->db->prepare("UPDATE loyalty_accounts SET points = points + ?, lifetime_points = ?, tier = ? WHERE id = ?")
                ->execute([$amount, $newLifetime, $tier, $row['id']]);
            $accountId = $row['id'];
        } else {
            $this->db->prepare("INSERT INTO loyalty_accounts (parent_uid, dojo_id, points, lifetime_points) VALUES (?,?,?,?)")
                ->execute([$parentUid, $dojoId, $amount, max(0, $amount)]);
            $accountId = $this->db->lastInsertId();
        }

        $this->db->prepare("INSERT INTO loyalty_transactions (account_id, amount, reason, note) VALUES (?,?,?,?)")
            ->execute([$accountId, $amount, $reason, $note]);

        Response::ok(['awarded' => $amount]);
    }
    public function listTransactions(string $parentUid): never {
        $auth = AuthMiddleware::require();
        Tenant::assertOwnUidOrStaff($auth, $parentUid);
        $acct = $this->db->prepare("SELECT id FROM loyalty_accounts WHERE parent_uid = ? AND dojo_id = ?");
        $acct->execute([$parentUid, Tenant::dojoId($auth)]);
        $row = $acct->fetch();
        if (!$row) Response::ok([]);
        $stmt = $this->db->prepare("SELECT * FROM loyalty_transactions WHERE account_id = ? ORDER BY created_at DESC LIMIT 50");
        $stmt->execute([$row['id']]);
        Response::ok($stmt->fetchAll());
    }
    public function listRewards(): never {
        $auth = AuthMiddleware::require();
        $stmt = $this->db->prepare("SELECT * FROM loyalty_rewards WHERE dojo_id = ? AND is_active = 1");
        $stmt->execute([Tenant::dojoId($auth)]);
        Response::ok($stmt->fetchAll());
    }
    public function createReward(): never {
        $auth = AuthMiddleware::require();
        AuthMiddleware::requireRole($auth, 'admin');
        $b = $this->body();
        Validator::make($b)
            ->required('name')->string('name', 1, 100)
            ->required('pointsCost')->int('pointsCost', 1)
            ->in('type', ['discount', 'free_class', 'merchandise', 'custom'])
            ->int('discountPct', 0, 100)
            ->check();
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
        Tenant::assertOwnUidOrStaff($auth, $parentUid);
        $dojoId = Tenant::dojoId($auth);
        $b = $this->body();
        $reward = $this->db->prepare("SELECT * FROM loyalty_rewards WHERE id = ? AND dojo_id = ? AND is_active = 1");
        $reward->execute([$b['rewardId'] ?? 0, $dojoId]);
        $r = $reward->fetch();
        if (!$r) Response::notFound('Reward not found.');
        $acct = $this->db->prepare("SELECT * FROM loyalty_accounts WHERE parent_uid = ? AND dojo_id = ?");
        $acct->execute([$parentUid, $dojoId]);
        $a = $acct->fetch();
        if (!$a || $a['points'] < $r['points_cost']) Response::error('Insufficient points.', 400);
        $this->db->prepare("UPDATE loyalty_accounts SET points = points - ? WHERE parent_uid = ?")
            ->execute([$r['points_cost'], $parentUid]);
        $this->db->prepare("INSERT INTO loyalty_transactions (account_id, amount, reason, note) VALUES (?,?,?,?)")
            ->execute([$a['id'], -$r['points_cost'], 'redemption', "Redeemed: {$r['name']}"]);
        Response::ok(['redeemed' => $r['name'], 'pointsUsed' => $r['points_cost']]);
    }

    // ── Notifications ─────────────────────────────────────────────────────────
    // Always the caller's own uid -- never a client-supplied one.
    public function listNotifications(): never {
        $auth = AuthMiddleware::require();
        $stmt = $this->db->prepare("SELECT * FROM notifications WHERE uid = ? ORDER BY created_at DESC LIMIT 50");
        $stmt->execute([$auth['uid']]);
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
        $this->db->prepare("UPDATE notifications SET is_read=1 WHERE uid=?")->execute([$auth['uid']]);
        Response::ok(['updated' => true]);
    }

    // ── Users ─────────────────────────────────────────────────────────────────
    public function listUsers(): never {
        $auth     = AuthMiddleware::require();
        $role     = $_GET['role'] ?? null;
        $branchId = isset($_GET['branchId']) ? (int)$_GET['branchId'] : null;
        $sql = "SELECT uid, email, display_name, role, is_head_coach, dojo_id, branch_id, avatar_url, created_at
                FROM users WHERE dojo_id = ? AND is_active = 1 AND approval_status = 'approved'";
        $p = [Tenant::dojoId($auth)];
        if ($role)     { $sql .= " AND role = ?";      $p[] = $role; }
        if ($branchId) { $sql .= " AND branch_id = ?"; $p[] = $branchId; }
        $sql .= " ORDER BY display_name";
        $stmt = $this->db->prepare($sql); $stmt->execute($p);
        Response::ok($stmt->fetchAll());
    }

    // PATCH /users/:uid/head-coach — admin promotes/demotes a coach to Head Coach.
    // Bumps token_version so the change takes effect immediately, same as a
    // password change or force-revoke -- without this, a demoted Head Coach's
    // existing token still carries isHeadCoach:true (it's baked into the JWT
    // at login and never re-checked against the DB mid-session) and would
    // keep passing every requireHeadCoach() check until it naturally expires.
    public function setHeadCoach(string $uid): never {
        $auth = AuthMiddleware::require();
        AuthMiddleware::requireRole($auth, 'admin');
        $b = $this->body();
        $stmt = $this->db->prepare("SELECT role FROM users WHERE uid = ? AND dojo_id = ?");
        $stmt->execute([$uid, $auth['dojoId']]);
        $row = $stmt->fetch();
        if (!$row) Response::notFound('User not found.');
        if ($row['role'] !== 'coach') Response::error('Only coaches can be designated Head Coach.', 422);
        $this->db->prepare("UPDATE users SET is_head_coach = ?, token_version = token_version + 1 WHERE uid = ?")
            ->execute([!empty($b['isHeadCoach']) ? 1 : 0, $uid]);
        Audit::log($this->db, $auth, 'user.head_coach', 'user', $uid, ['isHeadCoach' => !empty($b['isHeadCoach'])]);
        Response::ok(['updated' => true]);
    }

    // ── Account approvals ────────────────────────────────────────────────────
    // GET /users/pending — staff/admin/head-coach see everyone awaiting
    // approval in their dojo (including pending admins, so a head coach
    // can find them without an admin having to hand-forward the request).
    public function listPendingUsers(): never {
        $auth = AuthMiddleware::require();
        AuthMiddleware::requireRole($auth, 'admin', 'staff', 'coach');
        if ($auth['role'] === 'coach' && empty($auth['isHeadCoach'])) Response::forbidden();
        $stmt = $this->db->prepare("
            SELECT uid, email, display_name, role, created_at
            FROM users WHERE dojo_id = ? AND approval_status = 'pending'
            ORDER BY created_at");
        $stmt->execute([Tenant::dojoId($auth)]);
        Response::ok($stmt->fetchAll());
    }

    // GET /users/history — full account lifecycle: every sign-up regardless
    // of approval_status (pending/approved/rejected) plus is_active/is_head_coach
    // so the approvals page can show history, not just what's still pending.
    // Same visibility rule as listPendingUsers (admin/staff/head-coach).
    public function listUserHistory(): never {
        $auth = AuthMiddleware::require();
        AuthMiddleware::requireRole($auth, 'admin', 'staff', 'coach');
        if ($auth['role'] === 'coach' && empty($auth['isHeadCoach'])) Response::forbidden();
        $stmt = $this->db->prepare("
            SELECT u.uid, u.email, u.display_name, u.role, u.approval_status, u.is_active,
                   u.is_head_coach, u.approved_by, approver.display_name AS approved_by_name,
                   u.approved_at, u.created_at
            FROM users u
            LEFT JOIN users approver ON approver.uid = u.approved_by
            WHERE u.dojo_id = ?
            ORDER BY u.created_at DESC");
        $stmt->execute([Tenant::dojoId($auth)]);
        Response::ok($stmt->fetchAll());
    }

    // PATCH /users/:uid/approve
    // Approving a pending 'admin' signup requires a Head Coach or existing
    // Admin. Any other pending role (coach/parent/staff) can be approved by
    // staff or admin. Also doubles as "reinstate" for a previously rejected
    // account -- a rejection isn't a permanent lock-out, just a decision
    // that can be revisited (and there'd otherwise be no way back in: the
    // account can't re-register with the same email either).
    public function approveUser(string $uid): never {
        $auth = AuthMiddleware::require();
        $stmt = $this->db->prepare("SELECT role, approval_status FROM users WHERE uid = ? AND dojo_id = ?");
        $stmt->execute([$uid, Tenant::dojoId($auth)]);
        $target = $stmt->fetch();
        if (!$target) Response::notFound('User not found.');
        if (!in_array($target['approval_status'], ['pending', 'rejected'], true)) {
            Response::error('User is already approved.', 422);
        }

        if ($target['role'] === 'admin') {
            AuthMiddleware::requireHeadCoach($auth);
        } else {
            AuthMiddleware::requireRole($auth, 'admin', 'staff');
        }

        $this->db->prepare("
            UPDATE users SET approval_status = 'approved', approved_by = ?, approved_at = NOW()
            WHERE uid = ?")->execute([$auth['uid'], $uid]);
        Audit::log($this->db, $auth, 'user.approve', 'user', $uid, ['role' => $target['role'], 'wasRejected' => $target['approval_status'] === 'rejected']);

        $this->db->prepare("INSERT INTO notifications (uid, type, title, body) VALUES (?,?,?,?)")
            ->execute([$uid, 'system', 'Account approved', 'Your account has been approved. You now have full access.']);

        Response::ok(['updated' => true]);
    }

    // PATCH /users/:uid/reject
    public function rejectUser(string $uid): never {
        $auth = AuthMiddleware::require();
        $stmt = $this->db->prepare("SELECT role, approval_status FROM users WHERE uid = ? AND dojo_id = ?");
        $stmt->execute([$uid, Tenant::dojoId($auth)]);
        $target = $stmt->fetch();
        if (!$target) Response::notFound('User not found.');
        if ($target['approval_status'] !== 'pending') Response::error('User is not pending approval.', 422);

        if ($target['role'] === 'admin') {
            AuthMiddleware::requireHeadCoach($auth);
        } else {
            AuthMiddleware::requireRole($auth, 'admin', 'staff');
        }

        $this->db->prepare("
            UPDATE users SET approval_status = 'rejected', approved_by = ?, approved_at = NOW()
            WHERE uid = ?")->execute([$auth['uid'], $uid]);
        Audit::log($this->db, $auth, 'user.reject', 'user', $uid, ['role' => $target['role']]);

        Response::ok(['updated' => true]);
    }

    // PATCH /users/:uid/block — revoke access without deleting the account.
    // Sets is_active = 0, which AuthMiddleware::authenticate() checks on
    // every request, so this takes effect immediately (their current token
    // stops working on their very next request, no separate session store
    // needed). Head Coach or Admin only -- more consequential than a routine
    // approve/reject, so staff isn't given this one. Head Coach can block
    // anyone, including an Admin -- except a Head Coach account, which
    // nobody (not even another Head Coach or an Admin) can block. Can't
    // block yourself either.
    public function blockUser(string $uid): never {
        $auth = AuthMiddleware::require();
        AuthMiddleware::requireHeadCoach($auth);
        if ($uid === $auth['uid']) Response::error('You cannot block your own account.', 422);

        $stmt = $this->db->prepare("SELECT role, approval_status, is_active, is_head_coach FROM users WHERE uid = ? AND dojo_id = ?");
        $stmt->execute([$uid, Tenant::dojoId($auth)]);
        $target = $stmt->fetch();
        if (!$target) Response::notFound('User not found.');
        if ($target['approval_status'] !== 'approved') {
            Response::error('Only an approved account can be blocked.', 422);
        }
        if ($target['is_head_coach']) Response::forbidden('A Head Coach account cannot be blocked.');
        if (!$target['is_active']) Response::error('User is already blocked.', 422);

        $this->db->prepare("UPDATE users SET is_active = 0 WHERE uid = ?")->execute([$uid]);
        Audit::log($this->db, $auth, 'user.block', 'user', $uid, ['role' => $target['role']]);
        Response::ok(['updated' => true]);
    }

    // PATCH /users/:uid/unblock — restore access for a previously blocked account.
    public function unblockUser(string $uid): never {
        $auth = AuthMiddleware::require();
        AuthMiddleware::requireHeadCoach($auth);

        $stmt = $this->db->prepare("SELECT role, approval_status, is_active FROM users WHERE uid = ? AND dojo_id = ?");
        $stmt->execute([$uid, Tenant::dojoId($auth)]);
        $target = $stmt->fetch();
        if (!$target) Response::notFound('User not found.');
        if ($target['approval_status'] !== 'approved') {
            Response::error('Only an approved account can be unblocked.', 422);
        }
        if ($target['is_active']) Response::error('User is not blocked.', 422);

        $this->db->prepare("UPDATE users SET is_active = 1 WHERE uid = ?")->execute([$uid]);
        Audit::log($this->db, $auth, 'user.unblock', 'user', $uid, ['role' => $target['role']]);
        Response::ok(['updated' => true]);
    }

    // PATCH /users/:uid/downgrade-to-staff — Head Coach/Admin call for a
    // coach who should no longer hold coaching duties/permissions but stays
    // employed. Only valid coach -> staff; any other starting role is a
    // no-op error rather than silently reinterpreting the request. Clears
    // is_head_coach and branch_id stays untouched (staff keep their branch).
    public function downgradeCoachToStaff(string $uid): never {
        $auth = AuthMiddleware::require();
        AuthMiddleware::requireHeadCoach($auth);

        $stmt = $this->db->prepare("SELECT role, approval_status, is_head_coach FROM users WHERE uid = ? AND dojo_id = ?");
        $stmt->execute([$uid, Tenant::dojoId($auth)]);
        $target = $stmt->fetch();
        if (!$target) Response::notFound('User not found.');
        if ($target['role'] !== 'coach') Response::error('Only a coach can be downgraded to staff.', 422);
        if ($target['approval_status'] !== 'approved') {
            Response::error('Only an approved coach can be downgraded to staff.', 422);
        }
        if ($target['is_head_coach']) Response::forbidden('A Head Coach account cannot be downgraded.');

        $this->db->prepare("UPDATE users SET role = 'staff', is_head_coach = 0 WHERE uid = ?")
            ->execute([$uid]);
        Audit::log($this->db, $auth, 'user.downgrade_to_staff', 'user', $uid, []);
        Response::ok(['updated' => true]);
    }

    // ── Dojos ─────────────────────────────────────────────────────────────────
    public function getDojo(string $id): never {
        $auth = AuthMiddleware::require();
        if ($id !== $auth['dojoId']) Response::forbidden();
        $stmt = $this->db->prepare("SELECT * FROM dojos WHERE id = ?");
        $stmt->execute([$id]);
        Response::ok($stmt->fetch() ?: null);
    }
    public function updateDojo(string $id): never {
        $auth = AuthMiddleware::require();
        AuthMiddleware::requireRole($auth, 'admin');
        if ($id !== $auth['dojoId']) Response::forbidden();
        $b = $this->body();
        $this->db->prepare("INSERT INTO dojos (id, name, email, phone, address, timezone) VALUES (?,?,?,?,?,?) ON DUPLICATE KEY UPDATE name=VALUES(name), email=VALUES(email), phone=VALUES(phone), address=VALUES(address), timezone=VALUES(timezone)")
            ->execute([$id, $b['name'] ?? '', $b['email'] ?? null, $b['phone'] ?? null, $b['address'] ?? null, $b['timezone'] ?? 'UTC']);
        Response::ok(['updated' => true]);
    }
    public function updateDojoSettings(string $id): never {
        $auth = AuthMiddleware::require();
        AuthMiddleware::requireRole($auth, 'admin');
        if ($id !== $auth['dojoId']) Response::forbidden();
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
