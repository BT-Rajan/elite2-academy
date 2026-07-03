<?php
declare(strict_types=1);

// ── CORS — must be the very first thing that runs, before anything that ────
//    could fatal (wrong PHP version, missing extension, bad include, etc).
//    Origin is checked against ALLOWED_ORIGINS in .env rather than using a
//    wildcard, which was previously allowing any site to call this API.
$cfg    = require __DIR__ . '/../config.php';
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if (in_array($origin, $cfg['allowed_origins'], true)) {
    header("Access-Control-Allow-Origin: $origin");
    header('Vary: Origin');
}
header('Access-Control-Allow-Methods: GET,POST,PUT,PATCH,DELETE,OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }

// ── PHP version guard ───────────────────────────────────────────────────────
//    Response.php uses `never` return types and array_is_list(), both of
//    which require PHP 8.1+. On older PHP these cause a fatal compile error
//    that (depending on server config) can produce an empty/broken response
//    with no CORS headers reaching the browser — surfacing as "HTTP 0".
if (PHP_VERSION_ID < 80100) {
    http_response_code(500);
    echo json_encode([
        'error'   => true,
        'message' => 'Server requires PHP 8.1 or higher. Running ' . PHP_VERSION . '. '
                   . 'Update XAMPP\'s PHP version or switch php.exe in your PATH.',
    ]);
    exit;
}

// ── Fatal-error safety net ──────────────────────────────────────────────────
//    Guarantees the client always gets valid JSON (with CORS headers already
//    sent above) instead of a blank page / half-sent response on any
//    uncaught fatal error, parse error, or missing extension.
register_shutdown_function(function () {
    $err = error_get_last();
    if ($err && in_array($err['type'], [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR], true)) {
        if (!headers_sent()) {
            http_response_code(500);
            header('Content-Type: application/json; charset=utf-8');
        }
        echo json_encode([
            'error'   => true,
            'message' => 'Server error: ' . $err['message'],
        ]);
    }
});

require_once __DIR__ . '/../core/Response.php';

// ── Route table ────────────────────────────────────────────────────────────────
$method = $_SERVER['REQUEST_METHOD'];
$uri    = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
// Strip whatever base path this script actually lives under (e.g. "/dojo-api/api"
// if copied to htdocs/dojo-api, or "/elite2-academy/dojo-api/api" if the whole
// repo was copied to htdocs/elite2-academy) — works no matter where it's deployed.
$scriptDir = str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME']));
if ($scriptDir !== '/' && str_starts_with($uri, $scriptDir)) {
    $uri = substr($uri, strlen($scriptDir));
}
$uri    = rtrim($uri, '/') ?: '/';

try {
    // ── Auth ──────────────────────────────────────────────────────────────────
    if ($uri === '/auth/register'       && $method === 'POST') { require_once __DIR__.'/../controllers/AuthController.php'; (new AuthController)->register(); }
    if ($uri === '/auth/login'          && $method === 'POST') { require_once __DIR__.'/../controllers/AuthController.php'; (new AuthController)->login(); }
    if ($uri === '/auth/logout'         && $method === 'POST') { require_once __DIR__.'/../controllers/AuthController.php'; (new AuthController)->logout(); }
    if ($uri === '/auth/forgot-password'&& $method === 'POST') { require_once __DIR__.'/../controllers/AuthController.php'; (new AuthController)->forgotPassword(); }
    if ($uri === '/auth/reset-password' && $method === 'POST') { require_once __DIR__.'/../controllers/AuthController.php'; (new AuthController)->resetPassword(); }
    if ($uri === '/auth/me'             && $method === 'GET')  { require_once __DIR__.'/../controllers/AuthController.php'; (new AuthController)->me(); }

    // ── Profile (self-service, all roles) ────────────────────────────────────
    require_once __DIR__.'/../controllers/ProfileController.php';
    if ($uri === '/profile'             && $method === 'GET')  { (new ProfileController)->get(); }
    if ($uri === '/profile'             && $method === 'PUT')  { (new ProfileController)->update(); }
    if ($uri === '/profile/photo'       && $method === 'POST') { (new ProfileController)->uploadPhoto(); }
    if ($uri === '/profile/photo'       && $method === 'DELETE') { (new ProfileController)->deletePhoto(); }
    if ($uri === '/profile/password'    && $method === 'POST') { (new ProfileController)->changePassword(); }

    // ── Students ──────────────────────────────────────────────────────────────
    require_once __DIR__.'/../controllers/StudentController.php';
    if ($uri === '/students'            && $method === 'GET')    { (new StudentController)->list(); }
    if ($uri === '/students'            && $method === 'POST')   { (new StudentController)->create(); }
    if (preg_match('#^/students/(\d+)$#', $uri, $m)) {
        $id = (int)$m[1];
        if ($method === 'GET')   { (new StudentController)->get($id); }
        if ($method === 'PATCH') { (new StudentController)->update($id); }
    }
    if (preg_match('#^/students/(\d+)/belt-history$#', $uri, $m)) {
        $id = (int)$m[1];
        if ($method === 'GET')  { (new StudentController)->beltHistory($id); }
        if ($method === 'POST') { (new StudentController)->awardBelt($id); }
    }
    if (preg_match('#^/students/(\d+)/objectives$#', $uri, $m)) {
        $id = (int)$m[1];
        if ($method === 'GET')  { (new StudentController)->objectives($id); }
        if ($method === 'POST') { (new StudentController)->addObjective($id); }
    }
    if (preg_match('#^/students/(\d+)/comments$#', $uri, $m)) {
        $id = (int)$m[1];
        if ($method === 'GET')  { (new StudentController)->comments($id); }
        if ($method === 'POST') { (new StudentController)->addComment($id); }
    }
    if (preg_match('#^/students/(\d+)/objectives/(\d+)$#', $uri, $m)) {
        if ($method === 'PATCH') { (new StudentController)->updateObjective((int)$m[1], (int)$m[2]); }
    }

    // ── Curriculum Roadmap ────────────────────────────────────────────────────
    require_once __DIR__.'/../controllers/CurriculumController.php';
    $cc = new CurriculumController;
    if (preg_match('#^/disciplines/(\d+)/roadmap$#', $uri, $m) && $method === 'GET') { $cc->roadmap((int)$m[1]); }
    if (preg_match('#^/belts/(\d+)/syllabus$#', $uri, $m)) {
        $id = (int)$m[1];
        if ($method === 'GET')  { $cc->syllabus($id); }
        if ($method === 'POST') { $cc->addSyllabus($id); }
    }
    if (preg_match('#^/syllabus/(\d+)$#', $uri, $m)) {
        $id = (int)$m[1];
        if ($method === 'PATCH')  { $cc->updateSyllabus($id); }
        if ($method === 'DELETE') { $cc->deleteSyllabus($id); }
    }

    // ── Evaluations, Promotion, Seminar Points, BJJ Stripes ─────────────────────
    require_once __DIR__.'/../controllers/EvaluationController.php';
    $ec = new EvaluationController;
    if (preg_match('#^/students/(\d+)/evaluations$#', $uri, $m)) {
        $id = (int)$m[1];
        if ($method === 'GET')  { $ec->list($id); }
        if ($method === 'POST') { $ec->create($id); }
    }
    if (preg_match('#^/evaluations/(\d+)/overrule$#', $uri, $m) && $method === 'PATCH') { $ec->overrule((int)$m[1]); }
    if (preg_match('#^/students/(\d+)/promotion-readiness$#', $uri, $m) && $method === 'GET') { $ec->readiness((int)$m[1]); }
    if (preg_match('#^/students/(\d+)/promote$#', $uri, $m) && $method === 'POST') { $ec->promote((int)$m[1]); }
    if (preg_match('#^/students/(\d+)/seminar-points$#', $uri, $m)) {
        $id = (int)$m[1];
        if ($method === 'GET')  { $ec->seminarPointsLog($id); }
        if ($method === 'POST') { $ec->awardSeminarPoints($id); }
    }
    if (preg_match('#^/students/(\d+)/bjj-stripe$#', $uri, $m) && $method === 'POST') { $ec->awardStripe((int)$m[1]); }

    // ── Sessions & Attendance ─────────────────────────────────────────────────
    require_once __DIR__.'/../controllers/AttendanceController.php';
    if ($uri === '/sessions'            && $method === 'GET')    { (new AttendanceController)->listSessions(); }
    if ($uri === '/sessions'            && $method === 'POST')   { (new AttendanceController)->createSession(); }
    if (preg_match('#^/sessions/(\d+)$#', $uri, $m)) {
        $id = (int)$m[1];
        if ($method === 'GET')   { (new AttendanceController)->getSession($id); }
        if ($method === 'PATCH') { (new AttendanceController)->updateSession($id); }
    }
    if (preg_match('#^/sessions/(\d+)/comments$#', $uri, $m)) {
        $id = (int)$m[1];
        if ($method === 'GET')  { (new AttendanceController)->listComments($id); }
        if ($method === 'POST') { (new AttendanceController)->addComment($id); }
    }
    if ($uri === '/attendance'          && $method === 'GET')    { (new AttendanceController)->listAttendance(); }
    if ($uri === '/attendance'          && $method === 'POST')   { (new AttendanceController)->markAttendance(); }
    if ($uri === '/attendance/bulk'     && $method === 'POST')   { (new AttendanceController)->bulkMark(); }

    // ── Generic routes ────────────────────────────────────────────────────────
    require_once __DIR__.'/../controllers/GenericController.php';
    $gc = new GenericController;

    // Disciplines + Belts
    if ($uri === '/disciplines'         && $method === 'GET')    { $gc->listDisciplines(); }
    if ($uri === '/disciplines'         && $method === 'POST')   { $gc->createDiscipline(); }
    if (preg_match('#^/disciplines/(\d+)$#', $uri, $m)) {
        if ($method === 'PATCH') { $gc->updateDiscipline((int)$m[1]); }
    }
    if (preg_match('#^/disciplines/(\d+)/belts$#', $uri, $m)) {
        $id = (int)$m[1];
        if ($method === 'GET')  { $gc->listBelts($id); }
        if ($method === 'POST') { $gc->createBelt($id); }
    }
    if (preg_match('#^/disciplines/(\d+)/belts/(\d+)$#', $uri, $m)) {
        if ($method === 'PATCH') { $gc->updateBelt((int)$m[1], (int)$m[2]); }
    }

    // Schedules
    if ($uri === '/schedules'           && $method === 'GET')    { $gc->listSchedules(); }
    if ($uri === '/schedules'           && $method === 'POST')   { $gc->createSchedule(); }
    if (preg_match('#^/schedules/(\d+)$#', $uri, $m)) {
        if ($method === 'PATCH') { $gc->updateSchedule((int)$m[1]); }
    }

    // Threads + Messages
    if ($uri === '/threads'             && $method === 'GET')    { $gc->listThreads(); }
    if ($uri === '/threads'             && $method === 'POST')   { $gc->createThread(); }
    if (preg_match('#^/threads/(\d+)/messages$#', $uri, $m)) {
        $id = (int)$m[1];
        if ($method === 'GET')  { $gc->listMessages($id); }
        if ($method === 'POST') { $gc->sendMessage($id); }
    }
    if (preg_match('#^/threads/(\d+)/read$#', $uri, $m)) {
        if ($method === 'PATCH') { $gc->markThreadRead((int)$m[1]); }
    }

    // Loyalty
    if (preg_match('#^/loyalty/([^/]+)$#', $uri, $m)) {
        $uid = $m[1];
        if ($method === 'GET') { $gc->getLoyalty($uid); }
    }
    if (preg_match('#^/loyalty/([^/]+)/award$#', $uri, $m)) {
        if ($method === 'POST') { $gc->awardLoyalty($m[1]); }
    }
    if (preg_match('#^/loyalty/([^/]+)/transactions$#', $uri, $m)) {
        if ($method === 'GET') { $gc->listTransactions($m[1]); }
    }
    if (preg_match('#^/loyalty/([^/]+)/redeem$#', $uri, $m)) {
        if ($method === 'POST') { $gc->redeemReward($m[1]); }
    }
    if ($uri === '/loyalty-rewards'     && $method === 'GET')    { $gc->listRewards(); }
    if ($uri === '/loyalty-rewards'     && $method === 'POST')   { $gc->createReward(); }
    if (preg_match('#^/loyalty-rewards/(\d+)$#', $uri, $m)) {
        if ($method === 'PATCH') { $gc->updateReward((int)$m[1]); }
    }

    // Notifications
    if ($uri === '/notifications'               && $method === 'GET')  { $gc->listNotifications(); }
    if ($uri === '/notifications/mark-all-read' && $method === 'POST') { $gc->markAllNotificationsRead(); }
    if (preg_match('#^/notifications/(\d+)$#', $uri, $m)) {
        if ($method === 'PATCH') { $gc->updateNotification((int)$m[1]); }
    }

    // Users
    if ($uri === '/users'               && $method === 'GET')    { $gc->listUsers(); }
    if ($uri === '/users/pending'       && $method === 'GET')    { $gc->listPendingUsers(); }
    if (preg_match('#^/users/([^/]+)/head-coach$#', $uri, $m) && $method === 'PATCH') { $gc->setHeadCoach($m[1]); }
    if (preg_match('#^/users/([^/]+)/approve$#', $uri, $m) && $method === 'PATCH') { $gc->approveUser($m[1]); }
    if (preg_match('#^/users/([^/]+)/reject$#', $uri, $m) && $method === 'PATCH') { $gc->rejectUser($m[1]); }

    // Dojos
    if (preg_match('#^/dojos/([^/]+)$#', $uri, $m)) {
        $id = $m[1];
        if ($method === 'GET')  { $gc->getDojo($id); }
        if ($method === 'PUT')  { $gc->updateDojo($id); }
    }
    if (preg_match('#^/dojos/([^/]+)/settings$#', $uri, $m)) {
        if ($method === 'PATCH') { $gc->updateDojoSettings($m[1]); }
    }

    // Health check
    if ($uri === '/health' && $method === 'GET') {
        Response::ok(['status' => 'ok', 'time' => date('c')]);
    }

    Response::notFound("Route not found: $method $uri");

} catch (PDOException $e) {
    require_once __DIR__ . '/../core/ErrorMessages.php';
    Response::json(['error' => true, 'message' => ErrorMessages::logAndGet('server.database', $e)], 500);
} catch (Throwable $e) {
    require_once __DIR__ . '/../core/ErrorMessages.php';
    Response::json(['error' => true, 'message' => ErrorMessages::logAndGet('server.generic', $e)], 500);
}
