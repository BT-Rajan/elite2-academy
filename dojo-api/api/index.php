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

require_once __DIR__ . '/../core/Response.php';
require_once __DIR__ . '/../core/Router.php';
require_once __DIR__ . '/../core/Logger.php';
require_once __DIR__ . '/../core/ApiRateLimiter.php';
require_once __DIR__ . '/../core/Database.php';
require_once __DIR__ . '/../middleware/Auth.php';

$requestStart = microtime(true);

// ── Fatal-error safety net ──────────────────────────────────────────────────
//    Guarantees the client always gets valid JSON (with CORS headers already
//    sent above) instead of a blank page / half-sent response on any
//    uncaught fatal error, parse error, or missing extension. Also the one
//    place every request's outcome gets logged (see logRequest() below).
register_shutdown_function(function () use ($requestStart) {
    $err = error_get_last();
    if ($err && in_array($err['type'], [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR], true)) {
        if (!headers_sent()) {
            http_response_code(500);
            header('Content-Type: application/json; charset=utf-8');
        }
        echo json_encode(['error' => true, 'message' => 'Server error: ' . $err['message']]);
        Logger::error('fatal', ['error' => $err['message'], 'file' => $err['file'], 'line' => $err['line']]);
    }
    logRequest($requestStart);
});

function logRequest(float $start): void {
    Logger::info('request', [
        'method'   => $_SERVER['REQUEST_METHOD'] ?? '',
        'uri'      => $_SERVER['REQUEST_URI'] ?? '',
        'status'   => http_response_code(),
        'ms'       => (int)round((microtime(true) - $start) * 1000),
        'uid'      => AuthMiddleware::$lastUid,
        'ip'       => ApiRateLimiter::clientIdentifier(),
    ]);
}

// ── Route path ───────────────────────────────────────────────────────────────
$method = $_SERVER['REQUEST_METHOD'];
$uri    = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
// Strip whatever base path this script actually lives under (e.g. "/dojo-api/api"
// if copied to htdocs/dojo-api, or "/elite2-academy/dojo-api/api" if the whole
// repo was copied to htdocs/elite2-academy) — works no matter where it's deployed.
$scriptDir = str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME']));
if ($scriptDir !== '/' && str_starts_with($uri, $scriptDir)) {
    $uri = substr($uri, strlen($scriptDir));
}
$uri = rtrim($uri, '/') ?: '/';

try {
    // ── General rate limit ───────────────────────────────────────────────────
    //    Coarse flood guard on top of the login-specific limiter in
    //    AuthController. Keyed by IP since auth hasn't run yet at this point.
    //    Fails open: a DB hiccup here must never take the whole API down.
    try {
        ApiRateLimiter::check(Database::get(), 'ip:' . ApiRateLimiter::clientIdentifier());
    } catch (PDOException $e) {
        Logger::warning('rate limiter unavailable', ['error' => $e->getMessage()]);
    }

    require_once __DIR__.'/../controllers/AuthController.php';
    require_once __DIR__.'/../controllers/ProfileController.php';
    require_once __DIR__.'/../controllers/StudentController.php';
    require_once __DIR__.'/../controllers/CurriculumController.php';
    require_once __DIR__.'/../controllers/EvaluationController.php';
    require_once __DIR__.'/../controllers/AttendanceController.php';
    require_once __DIR__.'/../controllers/GenericController.php';
    require_once __DIR__.'/../controllers/BranchController.php';

    $router = new Router();

    // Auth
    $router->post('/auth/register',        fn() => (new AuthController)->register());
    $router->post('/auth/login',           fn() => (new AuthController)->login());
    $router->post('/auth/logout',          fn() => (new AuthController)->logout());
    $router->post('/auth/forgot-password', fn() => (new AuthController)->forgotPassword());
    $router->post('/auth/reset-password',  fn() => (new AuthController)->resetPassword());
    $router->get('/auth/me',               fn() => (new AuthController)->me());

    // Profile (self-service, all roles)
    $router->get('/profile',          fn() => (new ProfileController)->get());
    $router->put('/profile',          fn() => (new ProfileController)->update());
    $router->post('/profile/photo',   fn() => (new ProfileController)->uploadPhoto());
    $router->delete('/profile/photo', fn() => (new ProfileController)->deletePhoto());
    $router->post('/profile/password', fn() => (new ProfileController)->changePassword());

    // Students
    $router->get('/students',    fn() => (new StudentController)->list());
    $router->post('/students',   fn() => (new StudentController)->create());
    $router->get('/students/{id}',    fn($id) => (new StudentController)->get((int)$id));
    $router->patch('/students/{id}',  fn($id) => (new StudentController)->update((int)$id));
    $router->get('/students/{id}/belt-history',  fn($id) => (new StudentController)->beltHistory((int)$id));
    $router->post('/students/{id}/belt-history', fn($id) => (new StudentController)->awardBelt((int)$id));
    $router->get('/students/{id}/objectives',  fn($id) => (new StudentController)->objectives((int)$id));
    $router->post('/students/{id}/objectives', fn($id) => (new StudentController)->addObjective((int)$id));
    $router->get('/students/{id}/comments',  fn($id) => (new StudentController)->comments((int)$id));
    $router->post('/students/{id}/comments', fn($id) => (new StudentController)->addComment((int)$id));
    $router->patch('/students/{id}/objectives/{objId}', fn($id, $objId) => (new StudentController)->updateObjective((int)$id, (int)$objId));
    $router->post('/students/{id}/transfer',  fn($id) => (new BranchController)->transferStudent((int)$id));
    $router->get('/students/{id}/transfers',  fn($id) => (new BranchController)->transferHistory((int)$id));

    // ── Branches ──────────────────────────────────────────────────────────────
    $router->get('/branches',             fn() => (new BranchController)->list());
    $router->post('/branches',            fn() => (new BranchController)->create());
    $router->get('/branches/{id}',        fn($id) => (new BranchController)->get((int)$id));
    $router->patch('/branches/{id}',      fn($id) => (new BranchController)->update((int)$id));
    $router->delete('/branches/{id}',     fn($id) => (new BranchController)->deactivate((int)$id));
    $router->get('/branches/{id}/students', fn($id) => (new BranchController)->students((int)$id));
    $router->get('/branches/{id}/coaches',  fn($id) => (new BranchController)->coaches((int)$id));
    $router->get('/branches/{id}/programs', fn($id) => (new BranchController)->programs((int)$id));
    $router->patch('/users/{uid}/branch', fn($uid) => (new BranchController)->assignUserBranch($uid));

    // Curriculum roadmap
    $router->get('/disciplines/{id}/roadmap', fn($id) => (new CurriculumController)->roadmap((int)$id));
    $router->get('/belts/{id}/syllabus',      fn($id) => (new CurriculumController)->syllabus((int)$id));
    $router->post('/belts/{id}/syllabus',     fn($id) => (new CurriculumController)->addSyllabus((int)$id));
    $router->patch('/syllabus/{id}',          fn($id) => (new CurriculumController)->updateSyllabus((int)$id));
    $router->delete('/syllabus/{id}',         fn($id) => (new CurriculumController)->deleteSyllabus((int)$id));

    // Evaluations, promotion, seminar points, BJJ stripes
    $router->get('/students/{id}/evaluations',  fn($id) => (new EvaluationController)->list((int)$id));
    $router->post('/students/{id}/evaluations', fn($id) => (new EvaluationController)->create((int)$id));
    $router->patch('/evaluations/{id}/overrule',        fn($id) => (new EvaluationController)->overrule((int)$id));
    $router->get('/students/{id}/promotion-readiness',  fn($id) => (new EvaluationController)->readiness((int)$id));
    $router->post('/students/{id}/promote',             fn($id) => (new EvaluationController)->promote((int)$id));
    $router->get('/students/{id}/seminar-points',       fn($id) => (new EvaluationController)->seminarPointsLog((int)$id));
    $router->post('/students/{id}/seminar-points',      fn($id) => (new EvaluationController)->awardSeminarPoints((int)$id));
    $router->post('/students/{id}/bjj-stripe',          fn($id) => (new EvaluationController)->awardStripe((int)$id));

    // Sessions & attendance
    $router->get('/sessions',   fn() => (new AttendanceController)->listSessions());
    $router->post('/sessions',  fn() => (new AttendanceController)->createSession());
    $router->get('/sessions/{id}',   fn($id) => (new AttendanceController)->getSession((int)$id));
    $router->patch('/sessions/{id}', fn($id) => (new AttendanceController)->updateSession((int)$id));
    $router->get('/sessions/{id}/comments',  fn($id) => (new AttendanceController)->listComments((int)$id));
    $router->post('/sessions/{id}/comments', fn($id) => (new AttendanceController)->addComment((int)$id));
    $router->get('/attendance',       fn() => (new AttendanceController)->listAttendance());
    $router->post('/attendance',      fn() => (new AttendanceController)->markAttendance());
    $router->post('/attendance/bulk', fn() => (new AttendanceController)->bulkMark());

    // Disciplines + belts
    $router->get('/disciplines',   fn() => (new GenericController)->listDisciplines());
    $router->post('/disciplines',  fn() => (new GenericController)->createDiscipline());
    $router->patch('/disciplines/{id}', fn($id) => (new GenericController)->updateDiscipline((int)$id));
    $router->get('/disciplines/{id}/belts',  fn($id) => (new GenericController)->listBelts((int)$id));
    $router->post('/disciplines/{id}/belts', fn($id) => (new GenericController)->createBelt((int)$id));
    $router->patch('/disciplines/{discId}/belts/{beltId}', fn($discId, $beltId) => (new GenericController)->updateBelt((int)$discId, (int)$beltId));

    // Schedules
    $router->get('/schedules',  fn() => (new GenericController)->listSchedules());
    $router->post('/schedules', fn() => (new GenericController)->createSchedule());
    $router->patch('/schedules/{id}', fn($id) => (new GenericController)->updateSchedule((int)$id));

    // Threads + messages
    $router->get('/threads',  fn() => (new GenericController)->listThreads());
    $router->post('/threads', fn() => (new GenericController)->createThread());
    $router->get('/threads/{id}/messages',  fn($id) => (new GenericController)->listMessages((int)$id));
    $router->post('/threads/{id}/messages', fn($id) => (new GenericController)->sendMessage((int)$id));
    $router->patch('/threads/{id}/read',    fn($id) => (new GenericController)->markThreadRead((int)$id));

    // Loyalty
    $router->get('/loyalty/{uid}',              fn($uid) => (new GenericController)->getLoyalty($uid));
    $router->post('/loyalty/{uid}/award',       fn($uid) => (new GenericController)->awardLoyalty($uid));
    $router->get('/loyalty/{uid}/transactions', fn($uid) => (new GenericController)->listTransactions($uid));
    $router->post('/loyalty/{uid}/redeem',      fn($uid) => (new GenericController)->redeemReward($uid));
    $router->get('/loyalty-rewards',   fn() => (new GenericController)->listRewards());
    $router->post('/loyalty-rewards',  fn() => (new GenericController)->createReward());
    $router->patch('/loyalty-rewards/{id}', fn($id) => (new GenericController)->updateReward((int)$id));

    // Notifications
    $router->get('/notifications',               fn() => (new GenericController)->listNotifications());
    $router->post('/notifications/mark-all-read', fn() => (new GenericController)->markAllNotificationsRead());
    $router->patch('/notifications/{id}', fn($id) => (new GenericController)->updateNotification((int)$id));

    // Users + account approvals
    $router->get('/users',         fn() => (new GenericController)->listUsers());
    $router->get('/users/pending', fn() => (new GenericController)->listPendingUsers());
    $router->patch('/users/{uid}/head-coach', fn($uid) => (new GenericController)->setHeadCoach($uid));
    $router->patch('/users/{uid}/approve',    fn($uid) => (new GenericController)->approveUser($uid));
    $router->patch('/users/{uid}/reject',     fn($uid) => (new GenericController)->rejectUser($uid));

    // Dojos
    $router->get('/dojos/{dojoId}', fn($dojoId) => (new GenericController)->getDojo($dojoId));
    $router->put('/dojos/{dojoId}', fn($dojoId) => (new GenericController)->updateDojo($dojoId));
    $router->patch('/dojos/{dojoId}/settings', fn($dojoId) => (new GenericController)->updateDojoSettings($dojoId));

    // Health check
    $router->get('/health', fn() => Response::ok(['status' => 'ok', 'time' => date('c')]));

    $router->dispatch($method, $uri);

} catch (PDOException $e) {
    require_once __DIR__ . '/../core/ErrorMessages.php';
    Response::json(['error' => true, 'message' => ErrorMessages::logAndGet('server.database', $e)], 500);
} catch (Throwable $e) {
    require_once __DIR__ . '/../core/ErrorMessages.php';
    Response::json(['error' => true, 'message' => ErrorMessages::logAndGet('server.generic', $e)], 500);
}
