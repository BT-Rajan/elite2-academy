<?php
declare(strict_types=1);

require_once __DIR__ . '/../core/Database.php';
require_once __DIR__ . '/../core/JWT.php';
require_once __DIR__ . '/../core/Response.php';
require_once __DIR__ . '/../core/Mailer.php';

class AuthController {
    private PDO $db;
    private array $cfg;

    public function __construct() {
        $this->db  = Database::get();
        $this->cfg = require __DIR__ . '/../config.php';
    }

    // POST /auth/register
    public function register(): never {
        $b = $this->body();
        $email       = trim($b['email']       ?? '');
        $password    = trim($b['password']    ?? '');
        $displayName = trim($b['displayName'] ?? '');
        $role        = $b['role']   ?? 'parent';
        $dojoId      = trim($b['dojoId'] ?? '');

        if (!$email || !$password || !$displayName || !$dojoId)
            Response::error('email, password, displayName and dojoId are required.');
        if (!filter_var($email, FILTER_VALIDATE_EMAIL))
            Response::error('Invalid email address.');
        if (strlen($password) < 6)
            Response::error('Password must be at least 6 characters.');
        if (!in_array($role, ['admin','coach','parent','staff'], true))
            Response::error('Invalid role.');

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
            INSERT INTO users (uid, email, password, display_name, first_name, last_name, role, dojo_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ");
        $stmt->execute([$uid, $email, $hash, $displayName, $firstName, $lastName, $role, $dojoId]);

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
        $email    = trim($b['email']    ?? '');
        $password = trim($b['password'] ?? '');

        if (!$email || !$password) Response::error('email and password required.');

        $stmt = $this->db->prepare("SELECT * FROM users WHERE email = ? AND is_active = 1");
        $stmt->execute([$email]);
        $row = $stmt->fetch();

        if (!$row || !password_verify($password, $row['password']))
            Response::error('Invalid email or password.', 401);

        $user = $this->userFromRow($row);
        Response::ok([
            'token' => $this->issueToken($user),
            'user'  => $user,
        ]);
    }

    // POST /auth/logout
    public function logout(): never {
        // JWT is stateless — client drops the token
        Response::ok(['message' => 'Logged out.']);
    }

    // POST /auth/forgot-password
    public function forgotPassword(): never {
        $b     = $this->body();
        $email = trim($b['email'] ?? '');
        if (!$email) Response::error('email required.');

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
        $token    = trim($b['token']    ?? '');
        $password = trim($b['password'] ?? '');

        if (!$token || !$password) Response::error('token and password required.');
        if (strlen($password) < 6)  Response::error('Password must be at least 6 characters.');

        $stmt = $this->db->prepare("
            SELECT email FROM password_resets
            WHERE token = ? AND expires_at > NOW() AND used = 0
        ");
        $stmt->execute([$token]);
        $reset = $stmt->fetch();
        if (!$reset) Response::error('Invalid or expired reset token.', 400);

        $hash = password_hash($password, PASSWORD_BCRYPT, ['cost' => 12]);
        $this->db->prepare("UPDATE users SET password = ? WHERE email = ?")
            ->execute([$hash, $reset['email']]);
        $this->db->prepare("UPDATE password_resets SET used = 1 WHERE token = ?")
            ->execute([$token]);

        Response::ok(['message' => 'Password updated. Please log in.']);
    }

    // GET /auth/me
    public function me(): never {
        $payload = JWT::fromRequest();
        if (!$payload) Response::unauthorized();
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
            'uid'         => $row['uid'],
            'email'       => $row['email'],
            'displayName' => $row['display_name'],
            'salutation'  => $row['salutation']  ?? null,
            'firstName'   => $row['first_name']  ?? null,
            'lastName'    => $row['last_name']   ?? null,
            'phone'       => $row['phone']       ?? null,
            'role'        => $row['role'],
            'dojoId'      => $row['dojo_id'],
            'avatarUrl'   => $row['avatar_url'] ?? null,
            'createdAt'   => $row['created_at'],
        ];
    }

    private function issueToken(array $user): string {
        return JWT::encode([
            'uid'    => $user['uid'],
            'role'   => $user['role'],
            'dojoId' => $user['dojoId'],
        ], $this->cfg['jwt_secret'], $this->cfg['jwt_expiry']);
    }
}
