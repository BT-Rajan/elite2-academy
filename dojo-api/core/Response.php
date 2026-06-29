<?php
declare(strict_types=1);

class Response {
    public static function json(mixed $data, int $status = 200): never {
        http_response_code($status);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode($data, JSON_UNESCAPED_UNICODE);
        exit;
    }
    public static function ok(mixed $data = null): never {
        self::json(['data' => $data]);
    }
    public static function created(mixed $data = null): never {
        self::json(['data' => $data], 201);
    }
    public static function error(string $msg, int $status = 400): never {
        self::json(['error' => true, 'message' => $msg], $status);
    }
    public static function unauthorized(string $msg = 'Unauthorized'): never {
        self::error($msg, 401);
    }
    public static function forbidden(string $msg = 'Forbidden'): never {
        self::error($msg, 403);
    }
    public static function notFound(string $msg = 'Not found'): never {
        self::error($msg, 404);
    }
}
