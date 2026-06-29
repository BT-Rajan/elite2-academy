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
}
