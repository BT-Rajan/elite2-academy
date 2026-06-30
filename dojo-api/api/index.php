<?php
declare(strict_types=1);

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET,POST,PUT,PATCH,DELETE,OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }

require_once __DIR__ . '/../core/Response.php';

// ── Route table ────────────────────────────────────────────────────────────────
$method = $_SERVER['REQUEST_METHOD'];
$uri    = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
// Strip /dojo-api/api prefix
$uri    = preg_replace('#^/dojo-api/api#', '', $uri);
$uri    = rtrim($uri, '/') ?: '/';

try {
    // ── Auth ──────────────────────────────────────────────────────────────────
    if ($uri === '/auth/register'       && $method === 'POST') { require_once __DIR__.'/../controllers/AuthController.php'; (new AuthController)->register(); }
    if ($uri === '/auth/login'          && $method === 'POST') { require_once __DIR__.'/../controllers/AuthController.php'; (new AuthController)->login(); }
    if ($uri === '/auth/logout'         && $method === 'POST') { require_once __DIR__.'/../controllers/AuthController.php'; (new AuthController)->logout(); }
    if ($uri === '/auth/forgot-password'&& $method === 'POST') { require_once __DIR__.'/../controllers/AuthController.php'; (new AuthController)->forgotPassword(); }
    if ($uri === '/auth/reset-password' && $method === 'POST') { require_once __DIR__.'/../controllers/AuthController.php'; (new AuthController)->resetPassword(); }
    if ($uri === '/auth/me'             && $method === 'GET')  { require_once __DIR__.'/../controllers/AuthController.php'; (new AuthController)->me(); }

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
    Response::json(['error' => true, 'message' => 'Database error: ' . $e->getMessage()], 500);
} catch (Throwable $e) {
    Response::json(['error' => true, 'message' => $e->getMessage()], 500);
}
