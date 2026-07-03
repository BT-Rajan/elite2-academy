<?php
declare(strict_types=1);

require_once __DIR__ . '/../core/JWT.php';
require_once __DIR__ . '/../core/Response.php';

class AuthMiddleware {
    public static function require(): array {
        $payload = JWT::fromRequest();
        if (!$payload) Response::unauthorized('Valid token required.');
        return $payload;
    }

    public static function requireRole(array $payload, string ...$roles): void {
        if (!in_array($payload['role'] ?? '', $roles, true)) {
            Response::forbidden("Role required: " . implode(' or ', $roles));
        }
    }

    // Head-coach-only actions (e.g. overruling another coach's evaluation
    // or promotion decision). Admins are always allowed too, since they
    // have full operational authority over the dojo.
    public static function requireHeadCoach(array $payload): void {
        $isAdmin     = ($payload['role'] ?? '') === 'admin';
        $isHeadCoach = ($payload['role'] ?? '') === 'coach' && !empty($payload['isHeadCoach']);
        if (!$isAdmin && !$isHeadCoach) {
            Response::forbidden('Only a Head Coach or Admin can overrule an evaluation.');
        }
    }
}
