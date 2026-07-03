<?php
/**
 * Seeds the Elita Academy "One Belt, One Stripe, Three Arts" curriculum
 * roadmap: a discipline, its 8 belts (with Kickboxing level + BJJ stripe +
 * seminar point requirements), and the per-track syllabus text for each.
 *
 * Exposes seedElitaCurriculum() so other seed scripts (seed.php) can call
 * it directly and get back the belt IDs it created, e.g. to enroll test
 * students against real belts. Safe to re-run — returns the existing
 * discipline/belts instead of duplicating them.
 *
 * Run standalone: php database/seed_curriculum_elita.php [dojoId]
 */
require_once __DIR__ . '/../core/Database.php';

/**
 * @return array{disciplineId:int, beltIds:array<string,int>} keyed by belt name, in roadmap order
 */
function seedElitaCurriculum(PDO $db, string $dojoId): array {
    $db->prepare("INSERT IGNORE INTO dojos (id, name) VALUES (?, ?)")
       ->execute([$dojoId, 'Elita Academy']);

    $existing = $db->prepare("SELECT id FROM disciplines WHERE dojo_id = ? AND name = ?");
    $existing->execute([$dojoId, 'Elita Integrated Program']);
    $row = $existing->fetch();

    if ($row) {
        $disciplineId = (int)$row['id'];
        $beltRows = $db->prepare("SELECT id, name FROM belts WHERE discipline_id = ? ORDER BY sort_order");
        $beltRows->execute([$disciplineId]);
        $beltIds = [];
        foreach ($beltRows->fetchAll() as $b) { $beltIds[$b['name']] = (int)$b['id']; }
        return ['disciplineId' => $disciplineId, 'beltIds' => $beltIds];
    }

    $db->prepare("INSERT INTO disciplines (dojo_id, name, description, color) VALUES (?,?,?,?)")
       ->execute([
           $dojoId,
           'Elita Integrated Program',
           'Kajukenbo + Kickboxing + BJJ + Self-Defense, unified into one belt-based progression ("One Belt, One Stripe, Three Arts").',
           '#8b1e2c',
       ]);
    $disciplineId = (int)$db->lastInsertId();

    // name, colorHex, kickboxingLevel, bjjStripeLabel, seminarPointsRequired
    $belts = [
        ['White',       '#ffffff', 'Beginner',     'None',            3],
        ['Yellow',      '#f5d90a', 'Beginner',     '1 × White',       3],
        ['Purple',      '#7c3aed', 'Beginner',     '2 × White',       4],
        ['Blue',        '#2563eb', 'Intermediate', 'Belt is marker',  4],
        ['Green',       '#16a34a', 'Intermediate', '1 × Blue',        5],
        ['Brown',       '#92400e', 'Advanced',     '1 × Blue',        5],
        ['Brown/Black', '#44403c', 'Advanced',     '1 × Purple',      6],
        ['Black',       '#111111', 'Expert',       '1 × Purple',      6],
    ];

    $insBelt = $db->prepare("
        INSERT INTO belts (discipline_id, name, color_hex, sort_order, min_classes, min_score,
                            kickboxing_level, bjj_stripe_label, seminar_points_required)
        VALUES (?,?,?,?,?,?,?,?,?)");

    $beltIds = [];
    foreach ($belts as $i => [$name, $color, $kb, $stripe, $pts]) {
        $insBelt->execute([$disciplineId, $name, $color, $i + 1, 0, 0, $kb, $stripe, $pts]);
        $beltIds[$name] = (int)$db->lastInsertId();
    }

    $insSyllabus = $db->prepare("
        INSERT INTO curriculum_syllabus (belt_id, track, title, description, sort_order)
        VALUES (?,?,?,?,?)");

    // Striking (Kickboxing) track
    $striking = [
        'Beginner'     => ['Foundations', 'Basic stance, jabs, crosses, hooks, uppercuts, and simple combos. Full sparring begins at the Purple level.'],
        'Intermediate' => ['Expanding Toolset', 'Open-hand strikes, axe kicks, spinning backfists, and Muay Thai clinch tools.'],
        'Advanced'     => ['Mastery', 'Combination fluency, pressure fighting, fight IQ, and teaching ability.'],
    ];
    // Grappling (BJJ) track — keyed by belt range per the roadmap doc
    $grappling = [
        'White'  => ['White Level', 'Foundations of shrimp, bridge, closed guard, side control, and basic arm locks.'],
        'Blue'   => ['Blue Level', 'Advanced guard work, triangle chokes, leg locks, and defensive transitions.'],
        'Purple' => ['Purple Level', "Mastery of submissions from the back, D'arce chokes, and advanced defensive chaining."],
    ];
    // Self-Defense & Traditional track
    $selfDefense = [
        'Foundations'  => ['Foundations', 'Front grabs, choke defenses, bear hugs, and initial kata (1-3).'],
        'Intermediate' => ['Intermediate', 'Rear grabs, multiple attacker scenarios, pressure points, and katas (4-7).'],
        'Advanced'     => ['Advanced', 'Weapons defense (sticks/knives) and total self-defense mastery.'],
    ];

    $strikingStageByBelt = [
        'White' => 'Beginner', 'Yellow' => 'Beginner', 'Purple' => 'Beginner',
        'Blue' => 'Intermediate', 'Green' => 'Intermediate',
        'Brown' => 'Advanced', 'Brown/Black' => 'Advanced', 'Black' => 'Advanced',
    ];
    $grapplingStageByBelt = [
        'White' => 'White', 'Yellow' => 'White', 'Purple' => 'White',
        'Blue' => 'Blue', 'Green' => 'Blue', 'Brown' => 'Blue',
        'Brown/Black' => 'Purple', 'Black' => 'Purple',
    ];
    $selfDefenseStageByBelt = [
        'White' => 'Foundations', 'Yellow' => 'Foundations', 'Purple' => 'Foundations',
        'Blue' => 'Intermediate', 'Green' => 'Intermediate',
        'Brown' => 'Advanced', 'Brown/Black' => 'Advanced', 'Black' => 'Advanced',
    ];

    foreach ($beltIds as $beltName => $beltId) {
        [$sTitle, $sDesc] = $striking[$strikingStageByBelt[$beltName]];
        $insSyllabus->execute([$beltId, 'striking', $sTitle, $sDesc, 1]);

        [$gTitle, $gDesc] = $grappling[$grapplingStageByBelt[$beltName]];
        $insSyllabus->execute([$beltId, 'grappling', $gTitle, $gDesc, 1]);

        [$dTitle, $dDesc] = $selfDefense[$selfDefenseStageByBelt[$beltName]];
        $insSyllabus->execute([$beltId, 'selfdefense', $dTitle, $dDesc, 1]);
    }

    return ['disciplineId' => $disciplineId, 'beltIds' => $beltIds];
}

// Only run standalone when this file is the entry script (not when
// required by seed.php or anything else).
if (realpath($argv[0] ?? '') === __FILE__) {
    $db     = Database::get();
    $dojoId = $argv[1] ?? 'dojo-001';
    $result = seedElitaCurriculum($db, $dojoId);
    echo "Seeded 'Elita Integrated Program' (discipline #{$result['disciplineId']}) with "
        . count($result['beltIds']) . " belts and syllabus for dojo '$dojoId'.\n";
}
