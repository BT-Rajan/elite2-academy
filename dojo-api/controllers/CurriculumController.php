<?php
declare(strict_types=1);

require_once __DIR__ . '/../core/Database.php';
require_once __DIR__ . '/../core/Response.php';
require_once __DIR__ . '/../middleware/Auth.php';

/**
 * CurriculumController — the belt roadmap for a discipline: each belt plus
 * its Striking / Grappling / Self-Defense syllabus. Readable by any
 * authenticated role (admin, coach, parent) so students/parents can see the
 * roadmap and their current position. Only admins can edit the curriculum
 * content itself (belt requirements + syllabus text) — separate from the
 * evaluation/promotion workflow, which is coach/head-coach territory.
 */
class CurriculumController {
    private PDO $db;
    public function __construct() { $this->db = Database::get(); }

    // GET /disciplines/:id/roadmap — full roadmap: belts in order, each with
    // its striking/grappling/selfdefense syllabus entries attached.
    public function roadmap(int $discId): never {
        AuthMiddleware::require();

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
        AuthMiddleware::require();
        $stmt = $this->db->prepare("SELECT * FROM curriculum_syllabus WHERE belt_id = ? ORDER BY track, sort_order");
        $stmt->execute([$beltId]);
        Response::ok($stmt->fetchAll());
    }

    // POST /belts/:id/syllabus — admin adds/edits syllabus content
    public function addSyllabus(int $beltId): never {
        $auth = AuthMiddleware::require();
        AuthMiddleware::requireRole($auth, 'admin');
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
        $b = $this->body();
        $this->db->prepare("UPDATE curriculum_syllabus SET title=?, description=?, sort_order=? WHERE id=?")
            ->execute([$b['title'] ?? '', $b['description'] ?? null, $b['sortOrder'] ?? 1, $id]);
        Response::ok(['updated' => true]);
    }

    // DELETE /syllabus/:id
    public function deleteSyllabus(int $id): never {
        $auth = AuthMiddleware::require();
        AuthMiddleware::requireRole($auth, 'admin');
        $this->db->prepare("DELETE FROM curriculum_syllabus WHERE id = ?")->execute([$id]);
        Response::ok(['deleted' => true]);
    }

    private function body(): array {
        return (array)json_decode(file_get_contents('php://input'), true);
    }
}
