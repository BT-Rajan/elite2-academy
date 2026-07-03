<?php
declare(strict_types=1);

require_once __DIR__ . '/../core/Database.php';
require_once __DIR__ . '/../core/Response.php';
require_once __DIR__ . '/../core/Tenant.php';
require_once __DIR__ . '/../middleware/Auth.php';

/**
 * CurriculumController — the belt roadmap for a discipline: each belt plus
 * its Striking / Grappling / Self-Defense syllabus. Readable by any
 * authenticated role in the dojo. Only admins can edit the curriculum
 * content itself.
 */
class CurriculumController {
    private PDO $db;
    public function __construct() { $this->db = Database::get(); }

    // GET /disciplines/:id/roadmap
    public function roadmap(int $discId): never {
        $auth = AuthMiddleware::require();
        Tenant::discipline($this->db, $auth, $discId);

        $belts = $this->db->prepare("SELECT * FROM belts WHERE discipline_id = ? ORDER BY sort_order");
        $belts->execute([$discId]);
        $belts = $belts->fetchAll();
        if (!$belts) Response::ok([]);

        $ids = array_column($belts, 'id');
        $placeholders = implode(',', array_fill(0, count($ids), '?'));
        $syl = $this->db->prepare("
            SELECT * FROM curriculum_syllabus
            WHERE belt_id IN ($placeholders)
            ORDER BY belt_id, track, sort_order");
        $syl->execute($ids);
        $syllabus = $syl->fetchAll();

        $byBelt = [];
        foreach ($syllabus as $s) { $byBelt[$s['belt_id']][] = $s; }
        foreach ($belts as &$belt) { $belt['syllabus'] = $byBelt[$belt['id']] ?? []; }

        Response::ok($belts);
    }

    // GET /belts/:id/syllabus
    public function syllabus(int $beltId): never {
        $auth = AuthMiddleware::require();
        Tenant::belt($this->db, $auth, $beltId);
        $stmt = $this->db->prepare("SELECT * FROM curriculum_syllabus WHERE belt_id = ? ORDER BY track, sort_order");
        $stmt->execute([$beltId]);
        Response::ok($stmt->fetchAll());
    }

    // POST /belts/:id/syllabus
    public function addSyllabus(int $beltId): never {
        $auth = AuthMiddleware::require();
        AuthMiddleware::requireRole($auth, 'admin');
        Tenant::belt($this->db, $auth, $beltId);
        $b = $this->body();
        if (!in_array($b['track'] ?? '', ['striking', 'grappling', 'selfdefense'], true)) {
            Response::error('track must be striking, grappling, or selfdefense.');
        }
        $this->db->prepare("
            INSERT INTO curriculum_syllabus (belt_id, track, title, description, sort_order)
            VALUES (?,?,?,?,?)")
            ->execute([$beltId, $b['track'], $b['title'] ?? '', $b['description'] ?? null, $b['sortOrder'] ?? 1]);
        Response::created(['id' => $this->db->lastInsertId()]);
    }

    // PATCH /syllabus/:id
    public function updateSyllabus(int $id): never {
        $auth = AuthMiddleware::require();
        AuthMiddleware::requireRole($auth, 'admin');
        $stmt = $this->db->prepare("
            SELECT cs.id FROM curriculum_syllabus cs
            JOIN belts b ON b.id = cs.belt_id
            JOIN disciplines d ON d.id = b.discipline_id
            WHERE cs.id = ? AND d.dojo_id = ?");
        $stmt->execute([$id, $auth['dojoId']]);
        if (!$stmt->fetch()) Response::notFound('Syllabus entry not found.');

        $b = $this->body();
        $this->db->prepare("UPDATE curriculum_syllabus SET title=?, description=?, sort_order=? WHERE id=?")
            ->execute([$b['title'] ?? '', $b['description'] ?? null, $b['sortOrder'] ?? 1, $id]);
        Response::ok(['updated' => true]);
    }

    // DELETE /syllabus/:id
    public function deleteSyllabus(int $id): never {
        $auth = AuthMiddleware::require();
        AuthMiddleware::requireRole($auth, 'admin');
        $stmt = $this->db->prepare("
            SELECT cs.id FROM curriculum_syllabus cs
            JOIN belts b ON b.id = cs.belt_id
            JOIN disciplines d ON d.id = b.discipline_id
            WHERE cs.id = ? AND d.dojo_id = ?");
        $stmt->execute([$id, $auth['dojoId']]);
        if (!$stmt->fetch()) Response::notFound('Syllabus entry not found.');

        $this->db->prepare("DELETE FROM curriculum_syllabus WHERE id = ?")->execute([$id]);
        Response::ok(['deleted' => true]);
    }

    private function body(): array {
        return (array)json_decode(file_get_contents('php://input'), true);
    }
}
