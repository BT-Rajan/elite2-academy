<?php
declare(strict_types=1);

require_once __DIR__ . '/../core/Database.php';
require_once __DIR__ . '/../core/Response.php';
require_once __DIR__ . '/../core/Tenant.php';
require_once __DIR__ . '/../core/Audit.php';
require_once __DIR__ . '/../core/Validator.php';
require_once __DIR__ . '/../middleware/Auth.php';

/**
 * BranchController — branch CRUD, staff/coach/student assignment, student
 * transfers between branches, and the cross-branch read views used by
 * coaches (other branches' students) and parents (other branches' coaches
 * and programs).
 *
 * Access rules (see AuthMiddleware / Tenant for the enforcement helpers):
 *  - admin, head coach, staff, coach all have general branch-scoped access.
 *  - admin or staff can add/modify/transfer students between branches.
 *  - admin or head coach can CRUD branches and assign staff/coach/students.
 *  - coach can view (read-only) students in other branches.
 *  - parent can view (read-only) the list of coaches and programs in other
 *    branches, but nothing else cross-branch.
 */
class BranchController {
    private PDO $db;
    public function __construct() { $this->db = Database::get(); }

    // GET /branches — every role can see the branch directory itself
    // (name/address/phone); it's what lets a parent pick "other branches"
    // to view coaches/programs for in the first place.
    public function list(): never {
        $auth = AuthMiddleware::require();
        $stmt = $this->db->prepare("SELECT * FROM branches WHERE dojo_id = ? AND is_active = 1 ORDER BY name");
        $stmt->execute([Tenant::dojoId($auth)]);
        Response::ok($stmt->fetchAll());
    }

    // GET /branches/:id
    public function get(int $id): never {
        $auth = AuthMiddleware::require();
        Response::ok(Tenant::branch($this->db, $auth, $id));
    }

    // POST /branches — Admin or Head Coach only.
    public function create(): never {
        $auth = AuthMiddleware::require();
        AuthMiddleware::requireBranchManager($auth);
        $b = $this->body();
        Validator::make($b)
            ->required('name')->string('name', 1, 120)
            ->string('code', 0, 20)
            ->string('phone', 0, 30)
            ->check();
        $this->db->prepare("INSERT INTO branches (dojo_id, name, code, address, phone) VALUES (?,?,?,?,?)")
            ->execute([$auth['dojoId'], $b['name'], $b['code'] ?? null, $b['address'] ?? null, $b['phone'] ?? null]);
        $id = (int)$this->db->lastInsertId();
        Audit::log($this->db, $auth, 'branch.create', 'branch', (string)$id, ['name' => $b['name']]);
        Response::created(Tenant::branch($this->db, $auth, $id));
    }

    // PATCH /branches/:id — Admin or Head Coach only.
    public function update(int $id): never {
        $auth = AuthMiddleware::require();
        AuthMiddleware::requireBranchManager($auth);
        Tenant::branch($this->db, $auth, $id);
        $b = $this->body();
        Validator::make($b)
            ->required('name')->string('name', 1, 120)
            ->string('code', 0, 20)
            ->string('phone', 0, 30)
            ->check();
        $this->db->prepare("UPDATE branches SET name=?, code=?, address=?, phone=? WHERE id=? AND dojo_id=?")
            ->execute([$b['name'], $b['code'] ?? null, $b['address'] ?? null, $b['phone'] ?? null, $id, $auth['dojoId']]);
        Audit::log($this->db, $auth, 'branch.update', 'branch', (string)$id, ['name' => $b['name']]);
        Response::ok(Tenant::branch($this->db, $auth, $id));
    }

    // DELETE /branches/:id — Admin or Head Coach only. Soft delete
    // (is_active=0) rather than a hard row delete, and only when nothing is
    // currently assigned there -- otherwise staff/coaches/students would be
    // left pointing at a "deleted" branch. Reassign or transfer them first.
    public function deactivate(int $id): never {
        $auth = AuthMiddleware::require();
        AuthMiddleware::requireBranchManager($auth);
        Tenant::branch($this->db, $auth, $id);

        $students = $this->db->prepare("SELECT COUNT(*) c FROM students WHERE branch_id = ? AND is_active = 1");
        $students->execute([$id]);
        $staff = $this->db->prepare("SELECT COUNT(*) c FROM users WHERE branch_id = ? AND is_active = 1");
        $staff->execute([$id]);
        if ((int)$students->fetch()['c'] > 0 || (int)$staff->fetch()['c'] > 0) {
            Response::error('Reassign or transfer all students, coaches, and staff out of this branch before deleting it.', 422);
        }

        $this->db->prepare("UPDATE branches SET is_active = 0 WHERE id = ? AND dojo_id = ?")
            ->execute([$id, $auth['dojoId']]);
        Audit::log($this->db, $auth, 'branch.deactivate', 'branch', (string)$id);
        Response::ok(['deactivated' => true]);
    }

    // PATCH /users/:uid/branch — Admin or Head Coach assigns a coach/staff
    // member to a branch (or clears it by omitting branchId).
    public function assignUserBranch(string $uid): never {
        $auth = AuthMiddleware::require();
        AuthMiddleware::requireBranchManager($auth);
        $b = $this->body();
        Validator::make($b)->int('branchId', 1)->check();

        $stmt = $this->db->prepare("SELECT uid, role FROM users WHERE uid = ? AND dojo_id = ?");
        $stmt->execute([$uid, $auth['dojoId']]);
        $target = $stmt->fetch();
        if (!$target) Response::notFound('User not found.');

        $branchId = !empty($b['branchId']) ? (int)$b['branchId'] : null;
        if ($branchId) Tenant::branch($this->db, $auth, $branchId); // validates it belongs to this dojo

        $this->db->prepare("UPDATE users SET branch_id = ? WHERE uid = ?")->execute([$branchId, $uid]);
        Audit::log($this->db, $auth, 'user.branch_assign', 'user', $uid, ['branchId' => $branchId]);
        Response::ok(['updated' => true]);
    }

    // POST /students/:id/transfer — Admin or Staff moves a student (and
    // optionally their discipline/batch) from one branch to another,
    // logging a full audit trail entry.
    public function transferStudent(int $studentId): never {
        $auth = AuthMiddleware::require();
        AuthMiddleware::requireTransferPermission($auth);
        $student = Tenant::student($this->db, $auth, $studentId);

        $b = $this->body();
        Validator::make($b)
            ->required('toBranchId')->int('toBranchId', 1)
            ->int('disciplineId')
            ->check();

        $toBranch = Tenant::branch($this->db, $auth, (int)$b['toBranchId']);
        if ((int)$toBranch['id'] === (int)$student['branch_id'] && !isset($b['disciplineId'])) {
            Response::error('Student is already in that branch.', 422);
        }

        $fields  = ['branch_id = ?'];
        $params  = [$toBranch['id']];
        if (isset($b['disciplineId'])) { $fields[] = 'discipline_id = ?'; $params[] = $b['disciplineId']; } // "change batch"
        $params[] = $studentId;

        $this->db->prepare("UPDATE students SET " . implode(', ', $fields) . " WHERE id = ?")
            ->execute($params);

        $this->db->prepare("
            INSERT INTO student_branch_transfers (student_id, from_branch_id, to_branch_id, transferred_by, notes)
            VALUES (?,?,?,?,?)")
            ->execute([$studentId, $student['branch_id'], $toBranch['id'], $auth['uid'], $b['notes'] ?? null]);

        Audit::log($this->db, $auth, 'student.transfer', 'student', (string)$studentId, [
            'fromBranchId' => $student['branch_id'], 'toBranchId' => $toBranch['id'],
        ]);

        Response::ok(Tenant::student($this->db, $auth, $studentId));
    }

    // GET /students/:id/transfers — transfer history for a student.
    public function transferHistory(int $studentId): never {
        $auth = AuthMiddleware::require();
        Tenant::student($this->db, $auth, $studentId);
        $stmt = $this->db->prepare("
            SELECT t.*, fb.name AS from_branch_name, tb.name AS to_branch_name
            FROM student_branch_transfers t
            LEFT JOIN branches fb ON fb.id = t.from_branch_id
            JOIN branches tb ON tb.id = t.to_branch_id
            WHERE t.student_id = ? ORDER BY t.transferred_at DESC");
        $stmt->execute([$studentId]);
        Response::ok($stmt->fetchAll());
    }

    // GET /branches/:id/students — full roster view. Any of admin/head
    // coach/staff/coach can call this for their own branch; a plain coach
    // may also call it for another branch, but read-only (this endpoint
    // itself never writes, so no extra check is needed beyond auth+role).
    public function students(int $branchId): never {
        $auth = AuthMiddleware::require();
        AuthMiddleware::requireRole($auth, 'admin', 'coach', 'staff');
        Tenant::branch($this->db, $auth, $branchId);
        $stmt = $this->db->prepare("
            SELECT s.*, b.name AS belt_name, b.color_hex, d.name AS discipline_name
            FROM students s
            LEFT JOIN belts b       ON b.id = s.current_belt_id
            LEFT JOIN disciplines d ON d.id = s.discipline_id
            WHERE s.branch_id = ? AND s.is_active = 1
            ORDER BY s.first_name");
        $stmt->execute([$branchId]);
        Response::ok($stmt->fetchAll());
    }

    // GET /branches/:id/coaches — coach directory for a branch. Open to
    // every authenticated role, including parents viewing another branch's
    // coaches (per spec). Deliberately limited fields -- no email/phone --
    // since this is the cross-branch-visible view, not the internal
    // /users listing.
    public function coaches(int $branchId): never {
        $auth = AuthMiddleware::require();
        Tenant::branch($this->db, $auth, $branchId);
        $stmt = $this->db->prepare("
            SELECT uid, display_name, role, is_head_coach, avatar_url
            FROM users
            WHERE branch_id = ? AND dojo_id = ? AND role = 'coach'
              AND is_active = 1 AND approval_status = 'approved'
            ORDER BY display_name");
        $stmt->execute([$branchId, Tenant::dojoId($auth)]);
        Response::ok($stmt->fetchAll());
    }

    // GET /branches/:id/programs — schedules (+ discipline info) for a
    // branch. Open to every authenticated role, including parents viewing
    // another branch's programs (per spec). Disciplines/belts themselves
    // are dojo-wide curriculum, so only the branch's *schedule* is filtered.
    public function programs(int $branchId): never {
        $auth = AuthMiddleware::require();
        Tenant::branch($this->db, $auth, $branchId);
        $stmt = $this->db->prepare("
            SELECT sc.id, sc.name, sc.day_of_week, sc.start_time, sc.end_time, sc.location,
                   d.id AS discipline_id, d.name AS discipline_name, d.color AS discipline_color
            FROM schedules sc
            LEFT JOIN disciplines d ON d.id = sc.discipline_id
            WHERE sc.branch_id = ? AND sc.is_active = 1
            ORDER BY sc.day_of_week, sc.start_time");
        $stmt->execute([$branchId]);
        Response::ok($stmt->fetchAll());
    }

    private function body(): array {
        return (array)json_decode(file_get_contents('php://input'), true);
    }
}
