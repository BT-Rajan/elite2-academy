<?php
declare(strict_types=1);

require_once __DIR__ . '/../core/Database.php';
require_once __DIR__ . '/../core/Response.php';
require_once __DIR__ . '/../core/Tenant.php';
require_once __DIR__ . '/../core/Audit.php';
require_once __DIR__ . '/../core/Validator.php';
require_once __DIR__ . '/../middleware/Auth.php';

/**
 * EvaluationController — coaches evaluate a student's Striking, Grappling,
 * and Self-Defense readiness against the current belt's roadmap
 * requirements. A Head Coach (or Admin) can overrule any single coach's
 * evaluation. Only a coach (or admin, or head coach) may award a promotion,
 * and a promotion that doesn't yet meet all three tracks + seminar points
 * requires a Head Coach / Admin override with a documented reason.
 */
class EvaluationController {
    private PDO $db;
    public function __construct() { $this->db = Database::get(); }

    // GET /students/:id/evaluations — visible to admin/coach/parent (parent
    // sees their own child's evaluation history for transparency).
    public function list(int $studentId): never {
        $auth = AuthMiddleware::require();
        Tenant::student($this->db, $auth, $studentId);
        $stmt = $this->db->prepare("
            SELECT e.*, b.name AS belt_name
            FROM student_evaluations e
            JOIN belts b ON b.id = e.belt_id
            WHERE e.student_id = ?
            ORDER BY e.evaluated_at DESC");
        $stmt->execute([$studentId]);
        Response::ok($stmt->fetchAll());
    }

    // POST /students/:id/evaluations — a coach records a pass/fail for one
    // track against the student's current belt.
    public function create(int $studentId): never {
        $auth = AuthMiddleware::require();
        AuthMiddleware::requireRole($auth, 'admin', 'coach');
        $b = $this->body();
        Validator::make($b)
            ->required('track')->in('track', ['striking', 'grappling', 'selfdefense'])
            ->required('result')->in('result', ['pass', 'fail'])
            ->check();

        $student = Tenant::student($this->db, $auth, $studentId);
        Tenant::assertStudentBranchAccess($auth, $student, write: true);
        if (!$student['current_belt_id']) Response::error('Student has no current belt to evaluate against.', 422);

        $this->db->prepare("
            INSERT INTO student_evaluations (student_id, branch_id, belt_id, track, result, notes, coach_uid, coach_name)
            VALUES (?,?,?,?,?,?,?,?)")
            ->execute([
                $studentId, $student['branch_id'], $student['current_belt_id'], $b['track'], $b['result'],
                $b['notes'] ?? null, $auth['uid'], $b['coachName'] ?? '',
            ]);
        $evalId = $this->db->lastInsertId();

        if ($student['parent_uid']) {
            $verb = $b['result'] === 'pass' ? 'passed' : 'needs more work on';
            $this->notify($student['parent_uid'], 'system',
                "Evaluation update for {$student['first_name']}",
                "{$student['first_name']} {$verb} their {$b['track']} evaluation.");
        }

        Response::created(['id' => $evalId]);
    }

    // PATCH /evaluations/:id/overrule — Head Coach / Admin only. Records
    // who overruled the original coach's call and why, without deleting
    // the original evaluation (full audit trail).
    public function overrule(int $evalId): never {
        $auth = AuthMiddleware::require();
        AuthMiddleware::requireHeadCoach($auth);
        $b = $this->body();

        if (!in_array($b['result'] ?? '', ['pass', 'fail'], true)) {
            Response::error('result must be pass or fail.');
        }
        if (empty(trim($b['notes'] ?? ''))) {
            Response::error('A reason is required when overruling an evaluation.', 422);
        }

        $stmt = $this->db->prepare("
            SELECT e.* FROM student_evaluations e
            JOIN students s ON s.id = e.student_id
            WHERE e.id = ? AND s.dojo_id = ?");
        $stmt->execute([$evalId, Tenant::dojoId($auth)]);
        $eval = $stmt->fetch();
        if (!$eval) Response::notFound('Evaluation not found.');

        $this->db->prepare("
            UPDATE student_evaluations
            SET overruled_by=?, overruled_by_name=?, overrule_result=?, overrule_notes=?, overruled_at=NOW()
            WHERE id=?")
            ->execute([$auth['uid'], $b['overruledByName'] ?? '', $b['result'], trim($b['notes']), $evalId]);
        Audit::log($this->db, $auth, 'evaluation.overrule', 'evaluation', (string)$evalId, [
            'result' => $b['result'], 'notes' => trim($b['notes']),
        ]);

        Response::ok(['updated' => true]);
    }

    // GET /students/:id/promotion-readiness — aggregates the latest
    // evaluation per track (using the overrule result when present) plus
    // BJJ stripe count and seminar points against the current belt's
    // requirements, per the roadmap's promotion rule: "A promotion test
    // must aggregate data from all three [tracks]."
    public function readiness(int $studentId): never {
        $auth = AuthMiddleware::require();
        Response::ok($this->computeReadiness($auth, $studentId));
    }

    // POST /students/:id/promote — advances the student to the next belt
    // in sort order. Requires the coach/admin/head-coach role. If the
    // aggregate requirements aren't yet met, only a Head Coach or Admin may
    // force the promotion, and must provide an override reason — this is
    // the "head coach can overrule" rule applied to the promotion decision
    // itself, not just a single track's evaluation.
    public function promote(int $studentId): never {
        $auth = AuthMiddleware::require();
        AuthMiddleware::requireRole($auth, 'admin', 'coach');
        $b = $this->body();

        $student = Tenant::student($this->db, $auth, $studentId);
        Tenant::assertStudentBranchAccess($auth, $student, write: true);
        if (!$student['current_belt_id']) Response::error('Student has no current belt.', 422);

        $readiness = $this->computeReadiness($auth, $studentId);

        if (!$readiness['isReady']) {
            $isOverride = ($auth['role'] ?? '') === 'admin'
                || (($auth['role'] ?? '') === 'coach' && !empty($auth['isHeadCoach']));
            if (!$isOverride) {
                Response::error(
                    'Student has not met all promotion requirements yet. A Head Coach or Admin can override.',
                    422
                );
            }
            if (empty(trim($b['overrideNotes'] ?? ''))) {
                Response::error('A reason is required to promote a student who has not met all requirements.', 422);
            }
        }

        $next = $this->db->prepare("
            SELECT * FROM belts
            WHERE discipline_id = (SELECT discipline_id FROM belts WHERE id = ?)
              AND sort_order > (SELECT sort_order FROM belts WHERE id = ?)
            ORDER BY sort_order ASC LIMIT 1");
        $next->execute([$student['current_belt_id'], $student['current_belt_id']]);
        $nextBelt = $next->fetch();
        if (!$nextBelt) Response::error('Student is already at the highest belt.', 422);

        $notes = $readiness['isReady']
            ? ($b['notes'] ?? null)
            : trim('Promoted by override. ' . ($b['overrideNotes'] ?? ''));

        if (!$readiness['isReady']) {
            Audit::log($this->db, $auth, 'promotion.override', 'student', (string)$studentId, [
                'toBelt' => $nextBelt['name'], 'reason' => $b['overrideNotes'] ?? '',
            ]);
        }

        $this->db->prepare("
            INSERT INTO belt_history (student_id, belt_id, belt_name, awarded_by, notes)
            VALUES (?,?,?,?,?)")
            ->execute([$studentId, $nextBelt['id'], $nextBelt['name'], $b['awardedBy'] ?? '', $notes]);

        // Reset progress toward the new belt's requirements.
        $this->db->prepare("
            UPDATE students SET current_belt_id=?, bjj_stripes=0, seminar_points=0 WHERE id=?")
            ->execute([$nextBelt['id'], $studentId]);

        if ($student['parent_uid']) {
            $this->notify($student['parent_uid'], 'belt',
                "🥋 {$student['first_name']} was promoted!",
                "Congratulations! {$student['first_name']} is now {$nextBelt['name']} belt.");
        }

        Response::created(['beltId' => $nextBelt['id'], 'beltName' => $nextBelt['name']]);
    }

    // POST /students/:id/seminar-points — coach/admin awards Self-Defense &
    // Traditional track seminar points, logged for audit + parent visibility.
    public function awardSeminarPoints(int $studentId): never {
        $auth = AuthMiddleware::require();
        AuthMiddleware::requireRole($auth, 'admin', 'coach');
        $b = $this->body();
        Validator::make($b)->required('points')->int('points')->check();
        $points = (int)($b['points'] ?? 0);
        if ($points === 0) Response::error('points must be a non-zero integer.');
        Tenant::assertStudentBranchAccess($auth, Tenant::student($this->db, $auth, $studentId), write: true);

        $this->db->prepare("
            INSERT INTO seminar_points_log (student_id, points, reason, awarded_by, awarded_by_name)
            VALUES (?,?,?,?,?)")
            ->execute([$studentId, $points, $b['reason'] ?? 'Seminar attendance', $auth['uid'], $b['awardedByName'] ?? '']);

        $this->db->prepare("
            UPDATE students SET seminar_points = GREATEST(0, seminar_points + ?) WHERE id = ?")
            ->execute([$points, $studentId]);

        Response::created(['updated' => true]);
    }

    // GET /students/:id/seminar-points
    public function seminarPointsLog(int $studentId): never {
        $auth = AuthMiddleware::require();
        Tenant::student($this->db, $auth, $studentId);
        $stmt = $this->db->prepare("SELECT * FROM seminar_points_log WHERE student_id = ? ORDER BY awarded_at DESC");
        $stmt->execute([$studentId]);
        Response::ok($stmt->fetchAll());
    }

    // POST /students/:id/bjj-stripe — coach/admin awards a BJJ stripe on the
    // current belt (capped so it can't exceed what the roadmap calls for
    // isn't enforced numerically here since stripe requirements are
    // descriptive text, e.g. "1 × White" — the coach uses judgement, a
    // Head Coach can always overrule via a later evaluation).
    public function awardStripe(int $studentId): never {
        $auth = AuthMiddleware::require();
        AuthMiddleware::requireRole($auth, 'admin', 'coach');
        Tenant::assertStudentBranchAccess($auth, Tenant::student($this->db, $auth, $studentId), write: true);
        $this->db->prepare("UPDATE students SET bjj_stripes = bjj_stripes + 1 WHERE id = ?")
            ->execute([$studentId]);
        Response::ok(['updated' => true]);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────
    private function computeReadiness(array $auth, int $studentId): array {
        $student = Tenant::student($this->db, $auth, $studentId);
        if (!$student['current_belt_id']) {
            return ['isReady' => false, 'tracks' => [], 'seminarPoints' => 0, 'seminarPointsRequired' => 0, 'reason' => 'No current belt.'];
        }

        $belt = $this->db->prepare("SELECT * FROM belts WHERE id = ?");
        $belt->execute([$student['current_belt_id']]);
        $belt = $belt->fetch();

        $tracks = ['striking', 'grappling', 'selfdefense'];
        $result = [];
        $allPass = true;

        foreach ($tracks as $track) {
            $stmt = $this->db->prepare("
                SELECT * FROM student_evaluations
                WHERE student_id = ? AND belt_id = ? AND track = ?
                ORDER BY evaluated_at DESC LIMIT 1");
            $stmt->execute([$studentId, $student['current_belt_id'], $track]);
            $eval = $stmt->fetch();

            $effective = $eval ? ($eval['overrule_result'] ?? $eval['result']) : null;
            if ($effective !== 'pass') $allPass = false;

            $result[$track] = [
                'evaluation' => $eval ?: null,
                'effectiveResult' => $effective,
            ];
        }

        $seminarOk = $student['seminar_points'] >= (int)$belt['seminar_points_required'];
        if (!$seminarOk) $allPass = false;

        $stripesRequired = $this->parseStripeRequirement($belt['bjj_stripe_label']);
        $stripesOk = (int)$student['bjj_stripes'] >= $stripesRequired;
        if (!$stripesOk) $allPass = false;

        return [
            'isReady' => $allPass,
            'tracks' => $result,
            'seminarPoints' => (int)$student['seminar_points'],
            'seminarPointsRequired' => (int)$belt['seminar_points_required'],
            'bjjStripes' => (int)$student['bjj_stripes'],
            'bjjStripesRequired' => $stripesRequired,
            'bjjStripeLabel' => $belt['bjj_stripe_label'],
            'currentBelt' => $belt,
        ];
    }

    // BJJ stripe requirements are stored as a human-readable label per the
    // roadmap doc (e.g. "1 × White", "2 × White", "Belt is marker", "None")
    // rather than a plain number, since the label also carries which BJJ
    // rank the stripe is on. The count needed to promote is the leading
    // number; "None" / "Belt is marker" require zero stripes on this belt.
    private function parseStripeRequirement(?string $label): int {
        if ($label && preg_match('/^(\d+)/', trim($label), $m)) {
            return (int)$m[1];
        }
        return 0;
    }


    private function notify(string $uid, string $type, string $title, string $body): void {
        $this->db->prepare("INSERT INTO notifications (uid, type, title, body) VALUES (?,?,?,?)")
            ->execute([$uid, $type, $title, $body]);
    }

    private function body(): array {
        return (array)json_decode(file_get_contents('php://input'), true);
    }
}
