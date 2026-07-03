<?php
declare(strict_types=1);

require_once __DIR__ . '/../core/Database.php';
require_once __DIR__ . '/../core/Response.php';
require_once __DIR__ . '/../core/Tenant.php';
require_once __DIR__ . '/../core/Validator.php';
require_once __DIR__ . '/../middleware/Auth.php';

class AttendanceController {
    private PDO $db;
    public function __construct() { $this->db = Database::get(); }

    // GET /sessions
    public function listSessions(): never {
        $auth     = AuthMiddleware::require();
        $coachUid = $_GET['coachUid'] ?? null;
        $sql = "SELECT * FROM sessions WHERE dojo_id = ?";
        $p   = [Tenant::dojoId($auth)];
        if ($coachUid) { $sql .= " AND coach_uid = ?"; $p[] = $coachUid; }
        $sql .= " ORDER BY date DESC, created_at DESC LIMIT 30";
        $stmt = $this->db->prepare($sql); $stmt->execute($p);
        Response::ok($stmt->fetchAll());
    }

    // GET /sessions/:id
    public function getSession(int $id): never {
        $auth = AuthMiddleware::require();
        Response::ok(Tenant::session($this->db, $auth, $id));
    }

    // POST /sessions
    public function createSession(): never {
        $auth = AuthMiddleware::require();
        AuthMiddleware::requireRole($auth, 'admin', 'coach');
        $b = $this->body();
        Validator::make($b)
            ->string('className', 1, 100)
            ->date('date')
            ->time('startTime')
            ->time('endTime')
            ->check();
        $this->db->prepare("
            INSERT INTO sessions (dojo_id, class_name, coach_uid, date, start_time, end_time, location)
            VALUES (?, ?, ?, ?, ?, ?, ?)")
            ->execute([
                $auth['dojoId'], $b['className'] ?? 'Class',
                $auth['uid'], $b['date'] ?? date('Y-m-d'),
                $b['startTime'] ?? '00:00', $b['endTime'] ?? '00:00',
                $b['location'] ?? null,
            ]);
        $id = (int)$this->db->lastInsertId();
        Response::ok(Tenant::session($this->db, $auth, $id));
    }

    // PATCH /sessions/:id
    public function updateSession(int $id): never {
        $auth = AuthMiddleware::require();
        AuthMiddleware::requireRole($auth, 'admin', 'coach');
        Tenant::session($this->db, $auth, $id);
        $b = $this->body();
        if (isset($b['isClosed']))
            $this->db->prepare("UPDATE sessions SET is_closed = ? WHERE id = ?")
                ->execute([(int)$b['isClosed'], $id]);
        Response::ok(Tenant::session($this->db, $auth, $id));
    }

    // GET /sessions/:id/comments
    public function listComments(int $sessionId): never {
        $auth = AuthMiddleware::require();
        Tenant::session($this->db, $auth, $sessionId);
        $stmt = $this->db->prepare("SELECT * FROM session_comments WHERE session_id = ? ORDER BY created_at ASC");
        $stmt->execute([$sessionId]);
        Response::ok($stmt->fetchAll());
    }

    // POST /sessions/:id/comments
    public function addComment(int $sessionId): never {
        $auth = AuthMiddleware::require();
        AuthMiddleware::requireRole($auth, 'admin', 'coach');
        Tenant::session($this->db, $auth, $sessionId);
        $b = $this->body();
        $student = Tenant::student($this->db, $auth, (int)($b['studentId'] ?? 0));
        $skills = !empty($b['skills']) ? json_encode($b['skills']) : null;
        $this->db->prepare("
            INSERT INTO session_comments (session_id, student_id, coach_uid, coach_name, comment, skills)
            VALUES (?, ?, ?, ?, ?, ?)")
            ->execute([
                $sessionId, $student['id'],
                $auth['uid'], $b['coachName'] ?? '',
                $b['comment'] ?? '', $skills,
            ]);
        $this->db->prepare("INSERT INTO notifications (uid, type, title, body) VALUES (?,?,?,?)")
            ->execute([
                $student['parent_uid'], 'message',
                "New note from {$b['coachName']}",
                substr($b['comment'] ?? '', 0, 100),
            ]);
        Response::created(['id' => $this->db->lastInsertId()]);
    }

    // GET /attendance
    public function listAttendance(): never {
        $auth      = AuthMiddleware::require();
        $sessionId = $_GET['sessionId'] ?? null;
        $studentId = $_GET['studentId'] ?? null;
        $limit     = min((int)($_GET['limit'] ?? 50), 200);
        if ($sessionId) Tenant::session($this->db, $auth, (int)$sessionId);
        if ($studentId) Tenant::student($this->db, $auth, (int)$studentId);

        $sql = "SELECT a.*, s.class_name, s.date FROM attendance a
                JOIN sessions s ON s.id = a.session_id WHERE s.dojo_id = ?";
        $p = [Tenant::dojoId($auth)];
        if ($sessionId) { $sql .= " AND a.session_id = ?"; $p[] = $sessionId; }
        if ($studentId) { $sql .= " AND a.student_id = ?"; $p[] = $studentId; }
        $sql .= " ORDER BY a.marked_at DESC LIMIT $limit";
        $stmt = $this->db->prepare($sql); $stmt->execute($p);
        Response::ok($stmt->fetchAll());
    }

    // POST /attendance
    public function markAttendance(): never {
        $auth = AuthMiddleware::require();
        AuthMiddleware::requireRole($auth, 'admin', 'coach');
        $b = $this->body();
        Validator::make($b)
            ->required('sessionId')->int('sessionId', 1)
            ->required('studentId')->int('studentId', 1)
            ->in('status', ['present', 'late', 'excused', 'absent'])
            ->check();
        Tenant::session($this->db, $auth, (int)($b['sessionId'] ?? 0));
        $student = Tenant::student($this->db, $auth, (int)($b['studentId'] ?? 0));

        $this->db->prepare("
            INSERT INTO attendance (session_id, student_id, status, marked_by)
            VALUES (?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE status = VALUES(status), marked_by = VALUES(marked_by), marked_at = NOW()")
            ->execute([
                $b['sessionId'] ?? 0, $b['studentId'] ?? 0,
                $b['status']    ?? 'present', $auth['uid'],
            ]);
        $status = $b['status'] ?? 'present';
        if ($status === 'present' || $status === 'late') {
            $pts = $status === 'present' ? 10 : 5;
            $this->awardLoyalty($student['parent_uid'], $student['dojo_id'], $pts,
                $status === 'present' ? 'attendance' : 'attendance_late',
                "{$student['first_name']} attended class");
        }
        Response::ok(['marked' => true]);
    }

    // POST /attendance/bulk
    public function bulkMark(): never {
        $auth = AuthMiddleware::require();
        AuthMiddleware::requireRole($auth, 'admin', 'coach');
        $b       = $this->body();
        $records = $b['records'] ?? [];
        foreach ($records as $rec) {
            $sessionId = (int)($rec['sessionId'] ?? 0);
            $studentId = (int)($rec['studentId'] ?? 0);
            Tenant::session($this->db, $auth, $sessionId);
            Tenant::student($this->db, $auth, $studentId);
            $this->db->prepare("
                INSERT INTO attendance (session_id, student_id, status, marked_by)
                VALUES (?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE status = VALUES(status), marked_at = NOW()")
                ->execute([$sessionId, $studentId, $rec['status'], $auth['uid']]);
        }
        Response::ok(['count' => count($records)]);
    }

    private function awardLoyalty(string $parentUid, string $dojoId, int $pts, string $reason, string $note): void {
        $acct = $this->db->prepare("SELECT id, points, lifetime_points FROM loyalty_accounts WHERE parent_uid = ? AND dojo_id = ?");
        $acct->execute([$parentUid, $dojoId]);
        $row = $acct->fetch();
        if ($row) {
            $newLifetime = $row['lifetime_points'] + $pts;
            $tier = $newLifetime >= 3000 ? 'platinum' : ($newLifetime >= 1500 ? 'gold' : ($newLifetime >= 500 ? 'silver' : 'bronze'));
            $this->db->prepare("UPDATE loyalty_accounts SET points = points + ?, lifetime_points = lifetime_points + ?, tier = ? WHERE id = ?")
                ->execute([$pts, $pts, $tier, $row['id']]);
            $this->db->prepare("INSERT INTO loyalty_transactions (account_id, amount, reason, note) VALUES (?,?,?,?)")
                ->execute([$row['id'], $pts, $reason, $note]);
        } else {
            $this->db->prepare("INSERT INTO loyalty_accounts (parent_uid, dojo_id, points, lifetime_points) VALUES (?,?,?,?)")
                ->execute([$parentUid, $dojoId, $pts, $pts]);
            $this->db->prepare("INSERT INTO loyalty_transactions (account_id, amount, reason, note) VALUES (LAST_INSERT_ID(),?,?,?)")
                ->execute([$pts, $reason, $note]);
        }
    }

    private function body(): array {
        return (array)json_decode(file_get_contents('php://input'), true);
    }
}
