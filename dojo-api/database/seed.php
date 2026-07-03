<?php
/**
 * Seeds a full test dataset for Elita Academy so every screen in the app
 * has real data to exercise: every role, both a multi-track discipline
 * (curriculum roadmap, evaluations, overrules, promotion-ready students)
 * and a plain single-track discipline, attendance history, session notes,
 * messaging, loyalty, and notifications.
 *
 * Safe to re-run — skips straight to printing the login list if the test
 * coach account already exists.
 *
 * Run: php database/seed.php
 */
require_once __DIR__ . '/../core/Database.php';
require_once __DIR__ . '/seed_curriculum_elita.php';

$db     = Database::get();
$dojoId = 'dojo-001';

function uid(): string { return bin2hex(random_bytes(18)); }
function hash_pw(string $pw): string { return password_hash($pw, PASSWORD_BCRYPT, ['cost' => 12]); }
function daysAgo(int $n): string { return date('Y-m-d H:i:s', strtotime("-$n days")); }
function dateAgo(int $n): string { return date('Y-m-d', strtotime("-$n days")); }

function printLogins(): void {
    echo "Logins (all passwords shown):\n";
    echo "  Admin        admin@yourdojo.com     / admin123\n";
    echo "  Head Coach   headcoach@elita.test   / coach123   (Master Rina Chen — can overrule evaluations & promotions)\n";
    echo "  Coach        coach@elita.test       / coach123   (Coach Diego Alvarez)\n";
    echo "  Staff        staff@elita.test       / staff123   (Dana Reyes)\n";
    echo "  Parent       parent1@elita.test     / parent123  (Maria Lopez — Liam & Sofia Lopez)\n";
    echo "  Parent       parent2@elita.test     / parent123  (James Carter — Ethan & Grace Carter)\n";
    echo "  Parent       parent3@elita.test     / parent123  (Aisha Khan — Noah Khan)\n\n";
    echo "Try:\n";
    echo "  - Ethan Carter (Blue belt): all promotion requirements met — log in as either coach and Promote him.\n";
    echo "  - Liam Lopez (Yellow belt): Self-Defense evaluation failed — not ready yet, good 'in progress' case.\n";
    echo "  - Noah Khan (Purple belt): a failed Grappling evaluation was overruled by the Head Coach — check his\n";
    echo "    evaluation history for the audit trail.\n";
    echo "  - Grace Carter is on the plain 'Traditional Karate' discipline (no curriculum roadmap) to test that path too.\n";
}

$existing = $db->prepare("SELECT id FROM users WHERE email = ?");
$existing->execute(['headcoach@elita.test']);
if ($existing->fetch()) {
    echo "Test data already seeded for dojo '$dojoId'.\n";
    printLogins();
    exit;
}

$db->prepare("INSERT IGNORE INTO dojos (id, name, email, phone, timezone) VALUES (?,?,?,?,?)")
   ->execute([$dojoId, 'Elita Academy', 'info@elita.test', '+1 555-0100', 'America/New_York']);

// ── Users ────────────────────────────────────────────────────────────────────
function createUser(PDO $db, string $dojoId, string $email, string $pw, string $displayName,
                     string $firstName, string $lastName, string $role, bool $isHeadCoach = false): string {
    $u = uid();
    $db->prepare("
        INSERT INTO users (uid, email, password, display_name, first_name, last_name, role, is_head_coach, dojo_id, approval_status, approved_at)
        VALUES (?,?,?,?,?,?,?,?,?,'approved',NOW())")
        ->execute([$u, $email, hash_pw($pw), $displayName, $firstName, $lastName, $role, (int)$isHeadCoach, $dojoId]);
    return $u;
}

$adminExists = $db->prepare("SELECT uid FROM users WHERE email = ?");
$adminExists->execute(['admin@yourdojo.com']);
$adminRow = $adminExists->fetch();
$adminUid = $adminRow ? $adminRow['uid'] : createUser($db, $dojoId, 'admin@yourdojo.com', 'admin123', 'Admin User', 'Admin', 'User', 'admin');

$headCoachUid = createUser($db, $dojoId, 'headcoach@elita.test', 'coach123', 'Master Rina Chen', 'Rina', 'Chen', 'coach', true);
$coachUid     = createUser($db, $dojoId, 'coach@elita.test',     'coach123', 'Coach Diego Alvarez', 'Diego', 'Alvarez', 'coach');
$staffUid     = createUser($db, $dojoId, 'staff@elita.test',     'staff123', 'Dana Reyes', 'Dana', 'Reyes', 'staff');

$parent1Uid = createUser($db, $dojoId, 'parent1@elita.test', 'parent123', 'Maria Lopez',  'Maria', 'Lopez',  'parent');
$parent2Uid = createUser($db, $dojoId, 'parent2@elita.test', 'parent123', 'James Carter', 'James', 'Carter', 'parent');
$parent3Uid = createUser($db, $dojoId, 'parent3@elita.test', 'parent123', 'Aisha Khan',   'Aisha', 'Khan',   'parent');

// ── Curriculum: multi-track Elita program + a plain single-track discipline ──
$elita   = seedElitaCurriculum($db, $dojoId);
$beltIds = $elita['beltIds']; // e.g. White, Yellow, Purple, Blue, Green, Brown, Brown/Black, Black

$db->prepare("INSERT INTO disciplines (dojo_id, name, description, color) VALUES (?,?,?,?)")
   ->execute([$dojoId, 'Traditional Karate', 'Classic single-track belt progression.', '#6366f1']);
$karateDiscId = (int)$db->lastInsertId();

$karateBelts = [['White', '#ffffff', 1], ['Yellow', '#fbbf24', 2], ['Green', '#22c55e', 3], ['Brown', '#92400e', 4], ['Black', '#111111', 5]];
$insKarateBelt = $db->prepare("INSERT INTO belts (discipline_id, name, color_hex, sort_order, min_classes, min_score) VALUES (?,?,?,?,?,?)");
$karateBeltIds = [];
foreach ($karateBelts as $i => [$name, $color, $order]) {
    $insKarateBelt->execute([$karateDiscId, $name, $color, $order, 20, 6]);
    $karateBeltIds[$name] = (int)$db->lastInsertId();
}

// ── Students ─────────────────────────────────────────────────────────────────
function createStudent(PDO $db, string $dojoId, string $parentUid, string $first, string $last,
                        string $dob, string $gender, int $disciplineId, int $beltId,
                        int $bjjStripes, int $seminarPoints, int $enrolledDaysAgo): int {
    $db->prepare("
        INSERT INTO students (dojo_id, parent_uid, first_name, last_name, dob, gender,
                               discipline_id, current_belt_id, bjj_stripes, seminar_points, enrolled_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?)")
        ->execute([$dojoId, $parentUid, $first, $last, $dob, $gender,
                   $disciplineId, $beltId, $bjjStripes, $seminarPoints, daysAgo($enrolledDaysAgo)]);
    return (int)$db->lastInsertId();
}

// Liam — mid-progress: has stripes but hasn't hit seminar points or passed
// every track yet. Good case for "not ready, keep working."
$liamId = createStudent($db, $dojoId, $parent1Uid, 'Liam', 'Lopez', '2015-03-14', 'M',
    $elita['disciplineId'], $beltIds['Yellow'], 1, 2, 240);

// Sofia — brand new white belt, nothing recorded yet. Empty-state case.
$sofiaId = createStudent($db, $dojoId, $parent1Uid, 'Sofia', 'Lopez', '2017-08-02', 'F',
    $elita['disciplineId'], $beltIds['White'], 0, 0, 20);

// Ethan — fully meets every requirement for his belt. "Ready to promote" case.
$ethanId = createStudent($db, $dojoId, $parent2Uid, 'Ethan', 'Carter', '2013-11-09', 'M',
    $elita['disciplineId'], $beltIds['Blue'], 0, 4, 420);

// Grace — plain single-track Karate discipline, no curriculum tracks.
$graceId = createStudent($db, $dojoId, $parent2Uid, 'Grace', 'Carter', '2016-01-22', 'F',
    $karateDiscId, $karateBeltIds['Green'], 0, 0, 300);

// Noah — meets requirements only because a Head Coach overrule flipped a
// failed Grappling evaluation to a pass. Overrule-audit-trail case.
$noahId = createStudent($db, $dojoId, $parent3Uid, 'Noah', 'Khan', '2014-06-30', 'M',
    $elita['disciplineId'], $beltIds['Purple'], 2, 4, 360);

// ── Belt history (progression up to each student's current belt) ────────────
function addBeltHistory(PDO $db, int $studentId, int $beltId, string $beltName, string $awardedBy, int $daysAgo, ?string $notes = null): void {
    $db->prepare("INSERT INTO belt_history (student_id, belt_id, belt_name, awarded_by, notes, awarded_at) VALUES (?,?,?,?,?,?)")
        ->execute([$studentId, $beltId, $beltName, $awardedBy, $notes, daysAgo($daysAgo)]);
}
addBeltHistory($db, $liamId,  $beltIds['White'],  'White',  'Master Rina Chen', 240, 'Welcome to Elita Academy!');
addBeltHistory($db, $liamId,  $beltIds['Yellow'], 'Yellow', 'Master Rina Chen', 120, 'Solid fundamentals, ready for stripe work.');

addBeltHistory($db, $sofiaId, $beltIds['White'],  'White',  'Coach Diego Alvarez', 20, 'Welcome to Elita Academy!');

addBeltHistory($db, $ethanId, $beltIds['White'],  'White',  'Master Rina Chen', 420, 'Welcome to Elita Academy!');
addBeltHistory($db, $ethanId, $beltIds['Yellow'], 'Yellow', 'Master Rina Chen', 340, null);
addBeltHistory($db, $ethanId, $beltIds['Purple'], 'Purple', 'Master Rina Chen', 240, 'First full sparring session — great composure.');
addBeltHistory($db, $ethanId, $beltIds['Blue'],   'Blue',   'Master Rina Chen', 100, 'Excellent guard retention.');

addBeltHistory($db, $graceId, $karateBeltIds['White'],  'White',  'Coach Diego Alvarez', 300, null);
addBeltHistory($db, $graceId, $karateBeltIds['Yellow'], 'Yellow', 'Coach Diego Alvarez', 220, null);
addBeltHistory($db, $graceId, $karateBeltIds['Green'],  'Green',  'Coach Diego Alvarez', 120, 'Great kata performance.');

addBeltHistory($db, $noahId,  $beltIds['White'],  'White',  'Master Rina Chen', 360, 'Welcome to Elita Academy!');
addBeltHistory($db, $noahId,  $beltIds['Yellow'], 'Yellow', 'Master Rina Chen', 260, null);
addBeltHistory($db, $noahId,  $beltIds['Purple'], 'Purple', 'Master Rina Chen', 150, 'Two stripes earned on White BJJ — promoted.');

// ── Curriculum evaluations (incl. one Head Coach overrule) ──────────────────
function addEvaluation(PDO $db, int $studentId, int $beltId, string $track, string $result,
                        string $notes, string $coachUid, string $coachName, int $daysAgo): int {
    $db->prepare("
        INSERT INTO student_evaluations (student_id, belt_id, track, result, notes, coach_uid, coach_name, evaluated_at)
        VALUES (?,?,?,?,?,?,?,?)")
        ->execute([$studentId, $beltId, $track, $result, $notes, $coachUid, $coachName, daysAgo($daysAgo)]);
    return (int)$db->lastInsertId();
}
function overruleEvaluation(PDO $db, int $evalId, string $result, string $notes, string $headCoachUid, string $headCoachName, int $daysAgo): void {
    $db->prepare("
        UPDATE student_evaluations
        SET overruled_by=?, overruled_by_name=?, overrule_result=?, overrule_notes=?, overruled_at=?
        WHERE id=?")
        ->execute([$headCoachUid, $headCoachName, $result, $notes, daysAgo($daysAgo), $evalId]);
}

// Liam (Yellow): passes Striking + Grappling, fails Self-Defense — not ready.
addEvaluation($db, $liamId, $beltIds['Yellow'], 'striking',    'pass', 'Combos are crisp, good footwork.',            $coachUid, 'Coach Diego Alvarez', 14);
addEvaluation($db, $liamId, $beltIds['Yellow'], 'grappling',   'pass', 'Solid shrimping and bridge escapes.',         $coachUid, 'Coach Diego Alvarez', 12);
addEvaluation($db, $liamId, $beltIds['Yellow'], 'selfdefense', 'fail', 'Needs more reps on rear-grab escapes.',       $headCoachUid, 'Master Rina Chen', 10);

// Ethan (Blue): passes everything — the "ready to promote" demo case.
addEvaluation($db, $ethanId, $beltIds['Blue'], 'striking',    'pass', 'Fight IQ is excellent under pressure.',        $headCoachUid, 'Master Rina Chen', 20);
addEvaluation($db, $ethanId, $beltIds['Blue'], 'grappling',   'pass', 'Triangle setups are very clean now.',          $headCoachUid, 'Master Rina Chen', 18);
addEvaluation($db, $ethanId, $beltIds['Blue'], 'selfdefense', 'pass', 'Handled multi-attacker drill confidently.',    $coachUid, 'Coach Diego Alvarez', 15);

// Noah (Purple): Grappling initially failed by Coach Alvarez, then overruled
// to a pass by the Head Coach after a re-test — full audit trail preserved.
addEvaluation($db, $noahId, $beltIds['Purple'], 'striking',    'pass', 'Pressure fighting has really matured.',       $headCoachUid, 'Master Rina Chen', 25);
$noahGrapplingEvalId = addEvaluation($db, $noahId, $beltIds['Purple'], 'grappling', 'fail',
    'Leg lock defense needs work — recommend re-test.', $coachUid, 'Coach Diego Alvarez', 22);
overruleEvaluation($db, $noahGrapplingEvalId, 'pass',
    'Re-tested personally after extra 1:1 sessions — defense is solid now. Clearing for promotion.',
    $headCoachUid, 'Master Rina Chen', 5);
addEvaluation($db, $noahId, $beltIds['Purple'], 'selfdefense', 'pass', 'Weapons defense drills were excellent.',      $headCoachUid, 'Master Rina Chen', 8);

// ── Seminar points log (drives students.seminar_points shown above) ─────────
function addSeminarPoints(PDO $db, int $studentId, int $points, string $reason, string $coachUid, string $coachName, int $daysAgo): void {
    $db->prepare("
        INSERT INTO seminar_points_log (student_id, points, reason, awarded_by, awarded_by_name, awarded_at)
        VALUES (?,?,?,?,?,?)")
        ->execute([$studentId, $points, $reason, $coachUid, $coachName, daysAgo($daysAgo)]);
}
addSeminarPoints($db, $liamId,  2, 'Attended Weapons Defense seminar', $headCoachUid, 'Master Rina Chen', 60);
addSeminarPoints($db, $ethanId, 3, 'Attended Multi-Attacker Scenarios seminar', $coachUid, 'Coach Diego Alvarez', 90);
addSeminarPoints($db, $ethanId, 1, 'Kata review workshop', $headCoachUid, 'Master Rina Chen', 40);
addSeminarPoints($db, $noahId,  4, 'Weapons Defense intensive weekend', $headCoachUid, 'Master Rina Chen', 100);

// ── Objectives ────────────────────────────────────────────────────────────────
function addObjective(PDO $db, int $studentId, string $description, string $setBy, bool $complete, ?int $completedDaysAgo = null): void {
    $db->prepare("INSERT INTO student_objectives (student_id, description, set_by, is_complete, completed_at) VALUES (?,?,?,?,?)")
        ->execute([$studentId, $description, $setBy, (int)$complete, $complete ? daysAgo($completedDaysAgo ?? 5) : null]);
}
addObjective($db, $liamId,  'Improve rear-grab escape technique', $headCoachUid, false);
addObjective($db, $liamId,  'Attend 3 more classes before next evaluation', $coachUid, true, 3);
addObjective($db, $ethanId, 'Mentor a White belt during drills', $headCoachUid, true, 10);
addObjective($db, $noahId,  'Keep drilling leg lock defense weekly', $headCoachUid, false);
addObjective($db, $graceId, 'Prepare Green belt kata for testing', $coachUid, false);

// ── Schedules ─────────────────────────────────────────────────────────────────
$db->prepare("INSERT INTO schedules (dojo_id, discipline_id, coach_uid, name, day_of_week, start_time, end_time, location) VALUES (?,?,?,?,?,?,?,?)")
   ->execute([$dojoId, $elita['disciplineId'], $headCoachUid, 'Elita Fundamentals', 1, '17:00', '18:00', 'Main Mat']);
$db->prepare("INSERT INTO schedules (dojo_id, discipline_id, coach_uid, name, day_of_week, start_time, end_time, location) VALUES (?,?,?,?,?,?,?,?)")
   ->execute([$dojoId, $elita['disciplineId'], $coachUid, 'Elita Sparring & Grappling', 3, '18:00', '19:15', 'Main Mat']);
$db->prepare("INSERT INTO schedules (dojo_id, discipline_id, coach_uid, name, day_of_week, start_time, end_time, location) VALUES (?,?,?,?,?,?,?,?)")
   ->execute([$dojoId, $karateDiscId, $coachUid, 'Traditional Karate', 5, '16:00', '17:00', 'Dojo B']);

// ── Sessions + attendance + coach comments ───────────────────────────────────
$skillKeys = ['technique', 'fitness', 'discipline', 'focus', 'attitude', 'balance', 'reflex', 'speed', 'flexibility'];
function randomSkills(array $keys, int $count): array {
    $picked = (array)array_rand(array_flip($keys), $count);
    $out = [];
    foreach ($picked as $k) { $out[$k] = rand(6, 10); }
    return $out;
}

function createSession(PDO $db, string $dojoId, string $className, string $coachUid, int $daysAgo): int {
    $db->prepare("INSERT INTO sessions (dojo_id, class_name, coach_uid, date, start_time, end_time, location, is_closed) VALUES (?,?,?,?,?,?,?,1)")
        ->execute([$dojoId, $className, $coachUid, dateAgo($daysAgo), '17:00', '18:00', 'Main Mat']);
    return (int)$db->lastInsertId();
}
function markAttendance(PDO $db, int $sessionId, int $studentId, string $status, string $markedBy): void {
    $db->prepare("INSERT INTO attendance (session_id, student_id, status, marked_by) VALUES (?,?,?,?)")
        ->execute([$sessionId, $studentId, $status, $markedBy]);
}
function addSessionComment(PDO $db, ?int $sessionId, int $studentId, string $coachUid, string $coachName, string $comment, array $skills, int $daysAgo): void {
    $db->prepare("INSERT INTO session_comments (session_id, student_id, coach_uid, coach_name, comment, skills, created_at) VALUES (?,?,?,?,?,?,?)")
        ->execute([$sessionId, $studentId, $coachUid, $coachName, $comment, json_encode($skills), daysAgo($daysAgo)]);
}

$elitaStudents = [$liamId, $sofiaId, $ethanId, $noahId];
$sessionOffsets = [21, 17, 14, 10, 7, 3]; // last ~3 weeks, twice a week
$statuses = ['present', 'present', 'present', 'late', 'excused', 'absent'];

foreach ($sessionOffsets as $i => $offset) {
    $coach = $i % 2 === 0 ? $headCoachUid : $coachUid;
    $sessionId = createSession($db, $dojoId, $i % 2 === 0 ? 'Elita Fundamentals' : 'Elita Sparring & Grappling', $coach, $offset);
    foreach ($elitaStudents as $j => $sid) {
        $status = $statuses[($i + $j) % count($statuses)];
        markAttendance($db, $sessionId, $sid, $status, $coach);
    }
    // One coach note per session, rotating which student gets it.
    $noteStudent = $elitaStudents[$i % count($elitaStudents)];
    addSessionComment($db, $sessionId, $noteStudent, $coach,
        $coach === $headCoachUid ? 'Master Rina Chen' : 'Coach Diego Alvarez',
        'Good energy in class today — keep up the consistent training.',
        randomSkills($skillKeys, 4), $offset);
}

$karateSessionId = createSession($db, $dojoId, 'Traditional Karate', $coachUid, 5);
markAttendance($db, $karateSessionId, $graceId, 'present', $coachUid);
addSessionComment($db, $karateSessionId, $graceId, $coachUid, 'Coach Diego Alvarez',
    'Kata form is really coming together ahead of testing.', randomSkills($skillKeys, 3), 5);

// ── Loyalty ───────────────────────────────────────────────────────────────────
function seedLoyalty(PDO $db, string $parentUid, string $dojoId, int $lifetimePoints, int $currentPoints): void {
    $tier = $lifetimePoints >= 3000 ? 'platinum' : ($lifetimePoints >= 1500 ? 'gold' : ($lifetimePoints >= 500 ? 'silver' : 'bronze'));
    $db->prepare("INSERT INTO loyalty_accounts (parent_uid, dojo_id, points, lifetime_points, tier) VALUES (?,?,?,?,?)")
        ->execute([$parentUid, $dojoId, $currentPoints, $lifetimePoints, $tier]);
    $accountId = (int)$db->lastInsertId();
    $db->prepare("INSERT INTO loyalty_transactions (account_id, amount, reason, note, created_at) VALUES (?,?,?,?,?)")
        ->execute([$accountId, $lifetimePoints, 'attendance', 'Attendance points accrued this term', daysAgo(30)]);
    if ($currentPoints < $lifetimePoints) {
        $db->prepare("INSERT INTO loyalty_transactions (account_id, amount, reason, note, created_at) VALUES (?,?,?,?,?)")
            ->execute([$accountId, -($lifetimePoints - $currentPoints), 'redemption', 'Redeemed a reward', daysAgo(10)]);
    }
}
seedLoyalty($db, $parent1Uid, $dojoId, 620, 420);
seedLoyalty($db, $parent2Uid, $dojoId, 1800, 1800);
seedLoyalty($db, $parent3Uid, $dojoId, 260, 260);

$db->prepare("INSERT INTO loyalty_rewards (dojo_id, name, description, points_cost, type, discount_pct, is_active) VALUES (?,?,?,?,?,?,1)")
   ->execute([$dojoId, '10% Off Next Term', 'Ten percent off your next term of tuition.', 200, 'discount', 10]);
$db->prepare("INSERT INTO loyalty_rewards (dojo_id, name, description, points_cost, type, discount_pct, is_active) VALUES (?,?,?,?,?,?,1)")
   ->execute([$dojoId, 'Free Class Pass', 'One free drop-in class for a friend.', 150, 'free_class', null]);
$db->prepare("INSERT INTO loyalty_rewards (dojo_id, name, description, points_cost, type, discount_pct, is_active) VALUES (?,?,?,?,?,?,1)")
   ->execute([$dojoId, 'Elita Academy T-Shirt', 'Official dojo merchandise.', 300, 'merchandise', null]);

// ── Messaging ─────────────────────────────────────────────────────────────────
function createThread(PDO $db, string $dojoId, int $studentId, string $parentUid, string $coachUid): int {
    $db->prepare("INSERT INTO threads (dojo_id, student_id, parent_uid, coach_uid) VALUES (?,?,?,?)")
        ->execute([$dojoId, $studentId, $parentUid, $coachUid]);
    return (int)$db->lastInsertId();
}
function sendMessage(PDO $db, int $threadId, string $fromUid, string $fromName, string $fromRole, string $body, int $daysAgo): void {
    $db->prepare("INSERT INTO messages (thread_id, from_uid, from_name, from_role, body, sent_at) VALUES (?,?,?,?,?,?)")
        ->execute([$threadId, $fromUid, $fromName, $fromRole, $body, daysAgo($daysAgo)]);
    $db->prepare("UPDATE threads SET last_message=?, last_at=? WHERE id=?")
        ->execute([substr($body, 0, 200), daysAgo($daysAgo), $threadId]);
}

$thread1 = createThread($db, $dojoId, $liamId, $parent1Uid, $headCoachUid);
sendMessage($db, $thread1, $parent1Uid, 'Maria Lopez', 'parent', 'Hi Master Chen, how did Liam do in his Self-Defense evaluation?', 9);
sendMessage($db, $thread1, $headCoachUid, 'Master Rina Chen', 'coach', "He's close! Just needs more reps on rear-grab escapes — nothing to worry about.", 8);
$db->prepare("UPDATE threads SET unread_parent = 1 WHERE id = ?")->execute([$thread1]);

$thread2 = createThread($db, $dojoId, $noahId, $parent3Uid, $coachUid);
sendMessage($db, $thread2, $coachUid, 'Coach Diego Alvarez', 'coach', 'Noah is doing extra 1:1 sessions this week on his grappling defense before re-test.', 22);
sendMessage($db, $thread2, $parent3Uid, 'Aisha Khan', 'parent', 'Thank you for the update, really appreciate the extra attention!', 21);

// ── Notifications ─────────────────────────────────────────────────────────────
function addNotification(PDO $db, string $uid, string $type, string $title, string $body, bool $isRead, int $daysAgo): void {
    $db->prepare("INSERT INTO notifications (uid, type, title, body, is_read, created_at) VALUES (?,?,?,?,?,?)")
        ->execute([$uid, $type, $title, $body, (int)$isRead, daysAgo($daysAgo)]);
}
addNotification($db, $parent1Uid, 'message',    'New note from Coach Diego Alvarez', 'Good energy in class today.', false, 3);
addNotification($db, $parent1Uid, 'attendance', 'Liam attended class', 'Marked present at Elita Fundamentals.', true, 3);
addNotification($db, $parent2Uid, 'belt',       '🥋 Ethan is close to promotion!', 'All requirements are on track — check his Roadmap tab.', false, 5);
addNotification($db, $parent2Uid, 'loyalty',    'Loyalty points added', "James, you've earned 10 loyalty points.", true, 7);
addNotification($db, $parent3Uid, 'system',     'Evaluation update for Noah', 'Noah needs more work on their grappling evaluation.', true, 22);
addNotification($db, $parent3Uid, 'system',     'Evaluation overruled', 'A Head Coach reviewed and updated one of Noah\'s evaluations.', false, 5);

echo "Seeded full test dataset for dojo '$dojoId'.\n\n";
printLogins();
