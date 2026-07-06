<?php
declare(strict_types=1);

require_once __DIR__ . '/../core/Database.php';
require_once __DIR__ . '/../core/JWT.php';
require_once __DIR__ . '/../core/Response.php';
require_once __DIR__ . '/../core/Mailer.php';
require_once __DIR__ . '/../core/ErrorMessages.php';
require_once __DIR__ . '/../core/RateLimiter.php';
require_once __DIR__ . '/../core/Validator.php';
require_once __DIR__ . '/../middleware/Auth.php';

class AuthController {
    private PDO $db;
    private array $cfg;

    public function __construct() {
        $this->db  = Database::get();
        $this->cfg = require __DIR__ . '/../config.php';
    }

    // POST /auth/register
    // New accounts always start life as approval_status='pending' -- role
    // requested is stored, but grants no access until approved. Approval of
    // an 'admin' signup requires a Head Coach or existing Admin (enforced in
    // GenericController::approveUser); any other role can be approved by
    // staff or admin.
    public function register(): never {
        $b = $this->body();
        Validator::make($b)
            ->required('email')->email('email')
            ->required('password')->string('password', 6, 100)
            ->required('displayName')->string('displayName', 1, 100)
            ->required('dojoId')->string('dojoId', 1, 50)
            ->in('role', ['admin', 'coach', 'parent', 'staff'])
            ->int('branchId', 1)
            ->check();

        $email       = trim($b['email']);
        $password    = trim($b['password']);
        $displayName = trim($b['displayName']);
        $role        = $b['role'] ?? 'parent';
        $dojoId      = trim($b['dojoId']);
        // Optional at signup -- e.g. a parent/coach picking their home
        // branch during registration. Left unassigned (NULL) if omitted;
        // an admin/head coach can assign it later via PATCH /users/:uid/branch.
        $branchId    = !empty($b['branchId']) ? (int)$b['branchId'] : null;

        // Check duplicate
        $exists = $this->db->prepare("SELECT id FROM users WHERE email = ?");
        $exists->execute([$email]);
        if ($exists->fetch()) Response::error('Email already registered.', 409);

        $uid  = $this->uuid();
        $hash = password_hash($password, PASSWORD_BCRYPT, ['cost' => 12]);
        $nameParts = preg_split('/\s+/', $displayName, 2);
        $firstName = $nameParts[0] ?? $displayName;
        $lastName  = $nameParts[1] ?? '';

        $stmt = $this->db->prepare("
            INSERT INTO users (uid, email, password, display_name, first_name, last_name, role, dojo_id, branch_id, approval_status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
        ");
        $stmt->execute([$uid, $email, $hash, $displayName, $firstName, $lastName, $role, $dojoId, $branchId]);

        // Auto-create dojo if it doesn't exist yet
        $this->db->prepare("INSERT IGNORE INTO dojos (id, name) VALUES (?, ?)")
            ->execute([$dojoId, 'My Dojo']);

        // Auto-create loyalty account for parents
        if ($role === 'parent') {
            $this->db->prepare("
                INSERT INTO loyalty_accounts (parent_uid, dojo_id) VALUES (?, ?)
            ")->execute([$uid, $dojoId]);
        }

        $user = $this->buildUser($uid);
        Response::created([
            'token' => $this->issueToken($user),
            'user'  => $user,
        ]);
    }

    // POST /auth/login
    public function login(): never {
        $b        = $this->body();
        Validator::make($b)->required('email')->required('password')->check();
        $email    = trim($b['email']);
        $password = trim($b['password']);

        $limiter = new RateLimiter($this->db);
        $lockedForMinutes = $limiter->checkLocked($email);
        if ($lockedForMinutes !== null) Response::tooManyRequests();

        $stmt = $this->db->prepare("SELECT * FROM users WHERE email = ? AND is_active = 1");
        $stmt->execute([$email]);
        $row = $stmt->fetch();

        if (!$row || !password_verify($password, $row['password'])) {
            $limiter->recordFailure($email);
            Response::error(ErrorMessages::get('auth.invalid_credentials'), 401);
        }

        $limiter->recordSuccess($email);

        // These messages exist in ErrorMessages specifically for this check,
        // but login() never used them -- meaning a pending/rejected account
        // could get back a fully valid token (dead everywhere except
        // /auth/me, since every other endpoint's AuthMiddleware::require()
        // already blocks non-approved users, but still a confusing 200
        // instead of a clear rejection).
        if ($row['approval_status'] === 'pending') {
            Response::error(ErrorMessages::get('auth.pending_approval'), 403);
        }
        if ($row['approval_status'] === 'rejected') {
            Response::error(ErrorMessages::get('auth.rejected'), 403);
        }

        $user = $this->userFromRow($row);
        Response::ok([
            'token' => $this->issueToken($user),
            'user'  => $user,
        ]);
    }

    // POST /auth/logout
    // Bumps token_version so the token just used (and any other outstanding
    // token for this user) is immediately rejected by AuthMiddleware, rather
    // than remaining valid until natural expiry.
    public function logout(): never {
        $payload = AuthMiddleware::authenticate();
        $this->db->prepare("UPDATE users SET token_version = token_version + 1 WHERE uid = ?")
            ->execute([$payload['uid']]);
        Response::ok(['message' => 'Logged out.']);
    }

    // POST /auth/forgot-password
    public function forgotPassword(): never {
        $b     = $this->body();
        Validator::make($b)->required('email')->email('email')->check();
        $email = trim($b['email']);

        $stmt = $this->db->prepare("SELECT uid FROM users WHERE email = ?");
        $stmt->execute([$email]);
        $user = $stmt->fetch();

        // Always return ok — don't leak whether email exists
        if ($user) {
            $token = bin2hex(random_bytes(32));
            $this->db->prepare("
                INSERT INTO password_resets (email, token, expires_at)
                VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 1 HOUR))
                ON DUPLICATE KEY UPDATE token = VALUES(token), expires_at = VALUES(expires_at), used = 0
            ")->execute([$email, $token]);

            Mailer::passwordReset($email, $token, $this->cfg['app_url']);
        }

        Response::ok(['message' => 'If that email exists, a reset link was sent.']);
    }

    // POST /auth/reset-password
    public function resetPassword(): never {
        $b        = $this->body();
        Validator::make($b)
            ->required('token')
            ->required('password')->string('password', 6, 100)
            ->check();
        $token    = trim($b['token']);
        $password = trim($b['password']);

        $stmt = $this->db->prepare("
            SELECT email FROM password_resets
            WHERE token = ? AND expires_at > NOW() AND used = 0
        ");
        $stmt->execute([$token]);
        $reset = $stmt->fetch();
        if (!$reset) Response::error('Invalid or expired reset token.', 400);

        $hash = password_hash($password, PASSWORD_BCRYPT, ['cost' => 12]);
        // Bump token_version too -- a password reset should invalidate any
        // tokens issued before it, same as a self-service password change.
        $this->db->prepare("UPDATE users SET password = ?, token_version = token_version + 1 WHERE email = ?")
            ->execute([$hash, $reset['email']]);
        $this->db->prepare("UPDATE password_resets SET used = 1 WHERE token = ?")
            ->execute([$token]);

        Response::ok(['message' => 'Password updated. Please log in.']);
    }

    // GET /auth/me
    // Uses authenticate() (not require()) so a pending/rejected user can
    // still see their own account status instead of being locked out
    // entirely before they even know why.
    public function me(): never {
        $payload = AuthMiddleware::authenticate();
        $user = $this->buildUser($payload['uid']);
        Response::ok($user);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────
    private function body(): array {
        return (array)json_decode(file_get_contents('php://input'), true);
    }

    private function uuid(): string {
        return sprintf('%04x%04x-%04x-%04x-%04x-%04x%04x%04x',
            mt_rand(0,0xffff), mt_rand(0,0xffff), mt_rand(0,0xffff),
            mt_rand(0,0x0fff)|0x4000, mt_rand(0,0x3fff)|0x8000,
            mt_rand(0,0xffff), mt_rand(0,0xffff), mt_rand(0,0xffff));
    }

    private function buildUser(string $uid): array {
        $stmt = $this->db->prepare("SELECT * FROM users WHERE uid = ?");
        $stmt->execute([$uid]);
        $row = $stmt->fetch();
        if (!$row) Response::notFound('User not found.');
        return $this->userFromRow($row);
    }

    private function userFromRow(array $row): array {
        return [
            'uid'             => $row['uid'],
            'email'           => $row['email'],
            'displayName'     => $row['display_name'],
            'salutation'      => $row['salutation']  ?? null,
            'firstName'       => $row['first_name']  ?? null,
            'lastName'        => $row['last_name']   ?? null,
            'phone'           => $row['phone']       ?? null,
            'role'            => $row['role'],
            'isHeadCoach'     => (bool)($row['is_head_coach'] ?? false),
            'dojoId'          => $row['dojo_id'],
            'branchId'        => isset($row['branch_id']) ? (int)$row['branch_id'] : null,
            'avatarUrl'       => $row['avatar_url'] ?? null,
            'createdAt'       => $row['created_at'],
            'approvalStatus'  => $row['approval_status'] ?? 'approved',
            'tokenVersion'    => (int)($row['token_version'] ?? 1),
        ];
    }

    private function issueToken(array $user): string {
        return JWT::encode([
            'uid'            => $user['uid'],
            'role'           => $user['role'],
            'isHeadCoach'    => $user['isHeadCoach'],
            'dojoId'         => $user['dojoId'],
            'branchId'       => $user['branchId'],
            'tokenVersion'   => $user['tokenVersion'],
        ], $this->cfg['jwt_secret'], $this->cfg['jwt_expiry']);
    }
}
