<?php
declare(strict_types=1);

/**
 * Minimal .env loader. Loads KEY=VALUE pairs from dojo-api/.env into
 * getenv()/$_ENV once per request. Lines starting with # are comments.
 * Values can be wrapped in "..." or '...'; unquoted values are trimmed.
 */
class Env {
    private static bool $loaded = false;

    public static function load(): void {
        if (self::$loaded) return;
        self::$loaded = true;

        $path = __DIR__ . '/../.env';
        if (!is_file($path)) return;

        foreach (file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
            $line = trim($line);
            if ($line === '' || str_starts_with($line, '#')) continue;
            if (!str_contains($line, '=')) continue;

            [$key, $value] = explode('=', $line, 2);
            $key   = trim($key);
            $value = trim($value);

            if (strlen($value) >= 2) {
                $first = $value[0];
                $last  = $value[strlen($value) - 1];
                if (($first === '"' && $last === '"') || ($first === "'" && $last === "'")) {
                    $value = substr($value, 1, -1);
                }
            }

            if (getenv($key) === false) {
                putenv("$key=$value");
                $_ENV[$key] = $value;
            }
        }
    }

    public static function get(string $key, ?string $default = null): ?string {
        self::load();
        $value = getenv($key);
        if ($value === false) $value = $_ENV[$key] ?? null;
        return $value !== null && $value !== '' ? $value : $default;
    }
}
