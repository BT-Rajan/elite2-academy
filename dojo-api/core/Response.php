<?php
declare(strict_types=1);

require_once __DIR__ . '/ErrorMessages.php';

class Response {
    public static function json(mixed $data, int $status = 200): never {
        http_response_code($status);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode($data, JSON_UNESCAPED_UNICODE);
        exit;
    }
    public static function ok(mixed $data = null): never {
        self::json(['data' => self::camelize($data)]);
    }
    public static function created(mixed $data = null): never {
        self::json(['data' => self::camelize($data)], 201);
    }
    public static function error(string $msg, int $status = 400): never {
        self::json(['error' => true, 'message' => $msg], $status);
    }
    public static function unauthorized(?string $msg = null): never {
        self::error($msg ?? ErrorMessages::get('auth.token_required'), 401);
    }
    public static function forbidden(?string $msg = null): never {
        self::error($msg ?? ErrorMessages::get('auth.forbidden'), 403);
    }
    public static function notFound(string $msg = 'Not found'): never {
        self::error($msg, 404);
    }
    public static function tooManyRequests(?string $msg = null): never {
        self::error($msg ?? ErrorMessages::get('auth.rate_limited'), 429);
    }

    /**
     * Recursively converts snake_case array keys to camelCase.
     * Applied to every response so MySQL columns (dojo_id) become
     * the camelCase fields the Angular models expect (dojoId).
     * Leaves the original 'id' key untouched, and skips numeric/list arrays.
     */
    private static function camelize(mixed $data): mixed {
        if (!is_array($data)) return $data;

        // List of rows (numeric keys) — recurse into each row
        if (array_is_list($data)) {
            return array_map([self::class, 'camelize'], $data);
        }

        $out = [];
        foreach ($data as $key => $value) {
            $camelKey = is_string($key)
                ? preg_replace_callback('/_([a-z])/', fn($m) => strtoupper($m[1]), $key)
                : $key;
            $out[$camelKey] = is_array($value) ? self::camelize($value) : $value;
        }
        return $out;
    }
}
