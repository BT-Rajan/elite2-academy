<?php
declare(strict_types=1);

require_once __DIR__ . '/../core/Database.php';
require_once __DIR__ . '/../core/Response.php';
require_once __DIR__ . '/../core/Mailer.php';
require_once __DIR__ . '/../middleware/Auth.php';

class StudentController {
    private PDO $db;

    public function __construct() { $this->db = Database::get(); }

    // GET /students
    public function list(): never {
        $auth = AuthMiddleware::require();
        $dojoId    = $_GET['dojoId']    ?? $auth['dojoId'];
        $parentUid = $_GET['parentUid'] ?? null;

        $sql    = "SELECT s.*, b.name AS belt_name, b.color_hex, d.name AS discipline_name
                   FROM students s
                   LEFT JOIN belts b       ON b.id = s.current_belt_id
                   LEFT JOIN disciplines d ON d.id = s.discipline_id
                   WHERE s.dojo_id = ? AND s.is_active = 1";
        $params = [$dojoId];

        if ($parentUid) { $sql .= " AND s.parent_uid = ?"; $params[] = $parentUid; }
        $sql .= " ORDER BY s.first_name";

        $stmt = $this->db->prepare($sql);
        $stmt->execute($params);
        Response::ok($stmt->fetchAll());
    }

    // GET /students/:id
    public function get(int $id): never {
        AuthMiddleware::require();
        $stmt = $this->db->prepare("
            SELECT s.*, b.name AS belt_name, b.color_hex, d.name AS discipline_name
            FROM students s
            LEFT JOIN belts b       ON b.id = s.current_belt_id
            LEFT JOIN disciplines d ON d.id = s.discipline_id
            WHERE s.id = ?");
        $stmt->execute([$id]);
        $row = $stmt->fetch();
        if (!$row) Response::notFound('Student not found.');
        Response::ok($row);
    }

    // POST /students
    public function create(): never {
        $auth = AuthMiddleware::require();
        AuthMiddleware::requireRole($auth, 'admin');
        $b = $this->body();
        $stmt = $this->db->prepare("
            INSERT INTO students (dojo_id, parent_uid, first_name, last_name, dob, gender, discipline_id)
            VALUES (?, ?, ?, ?, ?, ?, ?)");
        $stmt->execute([
            $auth['dojoId'], $b['parentUid'] ?? '', $b['firstName'] ?? '',
            $b['lastName'] ?? '', $b['dob'] ?? null, $b['gender'] ?? null,
            $b['disciplineId'] ?? null,
        ]);
        $id = $this->db->lastInsertId();
        $this->get((int)$id);
    }

    // PATCH /students/:id
    public function update(int $id): never {
        $auth = AuthMiddleware::require();
        AuthMiddleware::requireRole($auth, 'admin', 'coach');
        $b = $this->body();
        $this->db->prepare("
            UPDATE students SET first_name=?, last_name=?, dob=?, gender=?,
            discipline_id=?, current_belt_id=? WHERE id=?")
            ->execute([
                $b['firstName'] ?? '', $b['lastName'] ?? '',
                $b['dob'] ?? null, $b['gender'] ?? null,
                $b['disciplineId'] ?? null, $b['currentBeltId'] ?? null, $id,
            ]);
        $this->get($id);
    }

    // GET /students/:id/belt-history
    public function beltHistory(int $id): never {
        AuthMiddleware::require();
        $stmt = $this->db->prepare("SELECT * FROM belt_history WHERE student_id = ? ORDER BY awarded_at DESC");
        $stmt->execute([$id]);
        Response::ok($stmt->fetchAll());
    }

    // POST /students/:id/belt-history
    public function awardBelt(int $id): never {
        $auth = AuthMiddleware::require();
        AuthMiddleware::requireRole($auth, 'admin', 'coach');
        $b = $this->body();
        $this->db->prepare("INSERT INTO belt_history (student_id, belt_name, awarded_by, notes) VALUES (?,?,?,?)")
            ->execute([$id, $b['beltName'] ?? '', $b['awardedBy'] ?? '', $b['notes'] ?? null]);
        if (!empty($b['currentBeltId'])) {
            $this->db->prepare("UPDATE students SET current_belt_id = ? WHERE id = ?")
                ->execute([$b['currentBeltId'], $id]);
        }
        // Notify parent
        $student = $this->db->prepare("SELECT parent_uid, first_name FROM students WHERE id = ?");
        $student->execute([$id]);
        $s = $student->fetch();
        if ($s) $this->notify($s['parent_uid'], 'belt', "🥋 {$s['first_name']} earned a new belt!",
            "Congratulations! {$b['beltName']} awarded by {$b['awardedBy']}.");
        Response::created(['id' => $this->db->lastInsertId()]);
    }

    // GET /students/:id/objectives
    public function objectives(int $id): never {
        AuthMiddleware::require();
        $stmt = $this->db->prepare("SELECT * FROM student_objectives WHERE student_id = ? ORDER BY is_complete, created_at");
        $stmt->execute([$id]);
        Response::ok($stmt->fetchAll());
    }

    // GET /students/:id/comments — all session comments for this student, across all sessions
    public function comments(int $id): never {
        AuthMiddleware::require();
        $stmt = $this->db->prepare("
            SELECT * FROM session_comments WHERE student_id = ? ORDER BY created_at DESC LIMIT 50");
        $stmt->execute([$id]);
        Response::ok($stmt->fetchAll());
    }

    // POST /students/:id/comments — coach note or skill assessment not tied to a specific session
    public function addComment(int $id): never {
        $auth = AuthMiddleware::require();
        AuthMiddleware::requireRole($auth, 'admin', 'coach');
        $b      = $this->body();
        $skills = !empty($b['skills']) ? json_encode($b['skills']) : null;
        $this->db->prepare("
            INSERT INTO session_comments (session_id, student_id, coach_uid, coach_name, comment, skills)
            VALUES (NULL, ?, ?, ?, ?, ?)")
            ->execute([
                $id, $auth['uid'], $b['coachName'] ?? '',
                $b['comment'] ?? '', $skills,
            ]);

        // Notify parent
        $stmt = $this->db->prepare("SELECT parent_uid FROM students WHERE id = ?");
        $stmt->execute([$id]);
        $s = $stmt->fetch();
        if ($s) {
            $this->db->prepare("INSERT INTO notifications (uid, type, title, body) VALUES (?,?,?,?)")
                ->execute([
                    $s['parent_uid'], 'message',
                    "New note from {$b['coachName']}",
                    substr($b['comment'] ?? '', 0, 100),
                ]);
        }
        Response::created(['id' => $this->db->lastInsertId()]);
    }

    // POST /students/:id/objectives
    public function addObjective(int $id): never {
        $auth = AuthMiddleware::require();
        AuthMiddleware::requireRole($auth, 'admin', 'coach');
        $b = $this->body();
        $this->db->prepare("INSERT INTO student_objectives (student_id, description, set_by) VALUES (?,?,?)")
            ->execute([$id, $b['description'] ?? '', $auth['uid']]);
        Response::created(['id' => $this->db->lastInsertId()]);
    }

    // PATCH /students/:id/objectives/:objId
    public function updateObjective(int $id, int $objId): never {
        $auth = AuthMiddleware::require();
        AuthMiddleware::requireRole($auth, 'admin', 'coach');
        $b = $this->body();
        $completedAt = !empty($b['isComplete']) ? date('Y-m-d H:i:s') : null;
        $this->db->prepare("UPDATE student_objectives SET is_complete=?, completed_at=? WHERE id=? AND student_id=?")
            ->execute([(int)($b['isComplete'] ?? 0), $completedAt, $objId, $id]);
        // Notify parent on completion
        if (!empty($b['isComplete'])) {
            $stmt = $this->db->prepare("SELECT parent_uid, first_name FROM students WHERE id = ?");
            $stmt->execute([$id]);
            $s = $stmt->fetch();
            if ($s) $this->notify($s['parent_uid'], 'achievement',
                "🎯 {$s['first_name']} completed an objective!", '');
        }
        Response::ok(['updated' => true]);
    }

    private function body(): array {
        return (array)json_decode(file_get_contents('php://input'), true);
    }

    private function notify(string $uid, string $type, string $title, string $body): void {
        $this->db->prepare("INSERT INTO notifications (uid, type, title, body) VALUES (?,?,?,?)")
            ->execute([$uid, $type, $title, $body]);
    }
}
