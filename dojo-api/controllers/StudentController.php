<?php
declare(strict_types=1);

require_once __DIR__ . '/../core/Database.php';
require_once __DIR__ . '/../core/Response.php';
require_once __DIR__ . '/../core/Mailer.php';
require_once __DIR__ . '/../core/Tenant.php';
require_once __DIR__ . '/../core/Validator.php';
require_once __DIR__ . '/../middleware/Auth.php';

class StudentController {
    private PDO $db;

    public function __construct() { $this->db = Database::get(); }

    // GET /students
    // dojoId always comes from the token. Parents only ever see their own
    // children -- a parentUid query param from any other role is honored
    // (staff/coach/admin filtering their own dojo's list by parent), but a
    // parent role can never widen scope past themselves.
    public function list(): never {
        $auth      = AuthMiddleware::require();
        $parentUid = $_GET['parentUid'] ?? null;
        if ($auth['role'] === 'parent') $parentUid = $auth['uid'];

        $sql    = "SELECT s.*, b.name AS belt_name, b.color_hex, d.name AS discipline_name
                   FROM students s
                   LEFT JOIN belts b       ON b.id = s.current_belt_id
                   LEFT JOIN disciplines d ON d.id = s.discipline_id
                   WHERE s.dojo_id = ? AND s.is_active = 1";
        $params = [Tenant::dojoId($auth)];

        if ($parentUid) { $sql .= " AND s.parent_uid = ?"; $params[] = $parentUid; }
        $sql .= " ORDER BY s.first_name";

        $stmt = $this->db->prepare($sql);
        $stmt->execute($params);
        Response::ok($stmt->fetchAll());
    }

    // GET /students/:id
    public function get(int $id): never {
        $auth = AuthMiddleware::require();
        Response::ok(Tenant::student($this->db, $auth, $id));
    }

    // POST /students
    public function create(): never {
        $auth = AuthMiddleware::require();
        AuthMiddleware::requireRole($auth, 'admin');
        $b = $this->body();
        Validator::make($b)
            ->required('parentUid')
            ->required('firstName')->string('firstName', 1, 60)
            ->required('lastName')->string('lastName', 1, 60)
            ->date('dob')
            ->in('gender', ['M', 'F', 'Other'])
            ->int('disciplineId')
            ->check();
        $stmt = $this->db->prepare("
            INSERT INTO students (dojo_id, parent_uid, first_name, last_name, dob, gender, discipline_id)
            VALUES (?, ?, ?, ?, ?, ?, ?)");
        $stmt->execute([
            $auth['dojoId'], $b['parentUid'] ?? '', $b['firstName'] ?? '',
            $b['lastName'] ?? '', $b['dob'] ?? null, $b['gender'] ?? null,
            $b['disciplineId'] ?? null,
        ]);
        $id = $this->db->lastInsertId();
        Response::ok(Tenant::student($this->db, $auth, (int)$id));
    }

    // PATCH /students/:id
    public function update(int $id): never {
        $auth = AuthMiddleware::require();
        AuthMiddleware::requireRole($auth, 'admin', 'coach');
        Tenant::student($this->db, $auth, $id);
        $b = $this->body();
        Validator::make($b)
            ->required('firstName')->string('firstName', 1, 60)
            ->required('lastName')->string('lastName', 1, 60)
            ->date('dob')
            ->in('gender', ['M', 'F', 'Other'])
            ->int('disciplineId')
            ->int('currentBeltId')
            ->check();
        $this->db->prepare("
            UPDATE students SET first_name=?, last_name=?, dob=?, gender=?,
            discipline_id=?, current_belt_id=? WHERE id=?")
            ->execute([
                $b['firstName'] ?? '', $b['lastName'] ?? '',
                $b['dob'] ?? null, $b['gender'] ?? null,
                $b['disciplineId'] ?? null, $b['currentBeltId'] ?? null, $id,
            ]);
        Response::ok(Tenant::student($this->db, $auth, $id));
    }

    // GET /students/:id/belt-history
    public function beltHistory(int $id): never {
        $auth = AuthMiddleware::require();
        Tenant::student($this->db, $auth, $id);
        $stmt = $this->db->prepare("SELECT * FROM belt_history WHERE student_id = ? ORDER BY awarded_at DESC");
        $stmt->execute([$id]);
        Response::ok($stmt->fetchAll());
    }

    // POST /students/:id/belt-history
    public function awardBelt(int $id): never {
        $auth = AuthMiddleware::require();
        AuthMiddleware::requireRole($auth, 'admin', 'coach');
        $student = Tenant::student($this->db, $auth, $id);
        $b = $this->body();
        $this->db->prepare("INSERT INTO belt_history (student_id, belt_name, awarded_by, notes) VALUES (?,?,?,?)")
            ->execute([$id, $b['beltName'] ?? '', $b['awardedBy'] ?? '', $b['notes'] ?? null]);
        if (!empty($b['currentBeltId'])) {
            $this->db->prepare("UPDATE students SET current_belt_id = ? WHERE id = ?")
                ->execute([$b['currentBeltId'], $id]);
        }
        $this->notify($student['parent_uid'], 'belt', "🥋 {$student['first_name']} earned a new belt!",
            "Congratulations! {$b['beltName']} awarded by {$b['awardedBy']}.");
        Response::created(['id' => $this->db->lastInsertId()]);
    }

    // GET /students/:id/objectives
    public function objectives(int $id): never {
        $auth = AuthMiddleware::require();
        Tenant::student($this->db, $auth, $id);
        $stmt = $this->db->prepare("SELECT * FROM student_objectives WHERE student_id = ? ORDER BY is_complete, created_at");
        $stmt->execute([$id]);
        Response::ok($stmt->fetchAll());
    }

    // GET /students/:id/comments
    public function comments(int $id): never {
        $auth = AuthMiddleware::require();
        Tenant::student($this->db, $auth, $id);
        $stmt = $this->db->prepare("
            SELECT * FROM session_comments WHERE student_id = ? ORDER BY created_at DESC LIMIT 50");
        $stmt->execute([$id]);
        Response::ok($stmt->fetchAll());
    }

    // POST /students/:id/comments
    public function addComment(int $id): never {
        $auth = AuthMiddleware::require();
        AuthMiddleware::requireRole($auth, 'admin', 'coach');
        $student = Tenant::student($this->db, $auth, $id);
        $b      = $this->body();
        $skills = !empty($b['skills']) ? json_encode($b['skills']) : null;
        $this->db->prepare("
            INSERT INTO session_comments (session_id, student_id, coach_uid, coach_name, comment, skills)
            VALUES (NULL, ?, ?, ?, ?, ?)")
            ->execute([
                $id, $auth['uid'], $b['coachName'] ?? '',
                $b['comment'] ?? '', $skills,
            ]);
        $this->notify($student['parent_uid'], 'message', "New note from {$b['coachName']}",
            substr($b['comment'] ?? '', 0, 100));
        Response::created(['id' => $this->db->lastInsertId()]);
    }

    // POST /students/:id/objectives
    public function addObjective(int $id): never {
        $auth = AuthMiddleware::require();
        AuthMiddleware::requireRole($auth, 'admin', 'coach');
        Tenant::student($this->db, $auth, $id);
        $b = $this->body();
        $this->db->prepare("INSERT INTO student_objectives (student_id, description, set_by) VALUES (?,?,?)")
            ->execute([$id, $b['description'] ?? '', $auth['uid']]);
        Response::created(['id' => $this->db->lastInsertId()]);
    }

    // PATCH /students/:id/objectives/:objId
    public function updateObjective(int $id, int $objId): never {
        $auth = AuthMiddleware::require();
        AuthMiddleware::requireRole($auth, 'admin', 'coach');
        $student = Tenant::student($this->db, $auth, $id);
        $b = $this->body();
        $completedAt = !empty($b['isComplete']) ? date('Y-m-d H:i:s') : null;
        $this->db->prepare("UPDATE student_objectives SET is_complete=?, completed_at=? WHERE id=? AND student_id=?")
            ->execute([(int)($b['isComplete'] ?? 0), $completedAt, $objId, $id]);
        if (!empty($b['isComplete'])) {
            $this->notify($student['parent_uid'], 'achievement',
                "🎯 {$student['first_name']} completed an objective!", '');
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
