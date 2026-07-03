<?php
declare(strict_types=1);

require_once __DIR__ . '/../core/JWT.php';
require_once __DIR__ . '/../core/Response.php';
require_once __DIR__ . '/../core/ErrorMessages.php';
require_once __DIR__ . '/../core/Database.php';

class AuthMiddleware {

    /**
     * Decodes and validates the token's signature/expiry/version only.
     * Does NOT enforce approval status — use this for the handful of
     * endpoints a pending user must still be able to call (/auth/me,
     * /auth/logout) so they can see their own pending state.
     */
    public static function authenticate(): array {
        $payload = JWT::fromRequest();
        if (!$payload) Response::unauthorized(ErrorMessages::get('auth.token_required'));

        // JWT revocation: every issued token embeds the tokenVersion that was
        // current at issuance. Logging out, changing password, or an admin
        // force-revoking access bumps users.token_version, which instantly
        // invalidates every token issued before that point -- no separate
        // session/blacklist store needed.
        $stmt = Database::get()->prepare("SELECT token_version, approval_status, is_active FROM users WHERE uid = ?");
        $stmt->execute([$payload['uid'] ?? '']);
        $row = $stmt->fetch();

        if (!$row || !$row['is_active'] || (int)$row['token_version'] !== (int)($payload['tokenVersion'] ?? -1)) {
            Response::unauthorized(ErrorMessages::get('auth.invalid_token'));
        }

        $payload['approvalStatus'] = $row['approval_status'];
        return $payload;
    }

    /**
     * Full guard for normal protected endpoints: valid, non-revoked token
     * AND an approved account.
     */
    public static function require(): array {
        $payload = self::authenticate();

        if ($payload['approvalStatus'] === 'rejected') {
            Response::forbidden(ErrorMessages::get('auth.rejected'));
        }
        if ($payload['approvalStatus'] !== 'approved') {
            Response::forbidden(ErrorMessages::get('auth.pending_approval'));
        }
        return $payload;
    }

    public static function requireRole(array $payload, string ...$roles): void {
        if (!in_array($payload['role'] ?? '', $roles, true)) {
            Response::forbidden();
        }
    }

    // Head-coach-only actions (e.g. overruling another coach's evaluation
    // or promotion decision, or approving a new admin signup). Admins are
    // always allowed too, since they have full operational authority.
    public static function requireHeadCoach(array $payload): void {
        $isAdmin     = ($payload['role'] ?? '') === 'admin';
        $isHeadCoach = ($payload['role'] ?? '') === 'coach' && !empty($payload['isHeadCoach']);
        if (!$isAdmin && !$isHeadCoach) {
            Response::forbidden('Only a Head Coach or Admin can do that.');
        }
    }
}
