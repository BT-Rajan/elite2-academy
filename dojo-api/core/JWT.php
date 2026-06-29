<?php
declare(strict_types=1);

class JWT {
    private static function b64(string $data): string {
        return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
    }
    private static function unb64(string $data): string {
        return base64_decode(strtr($data, '-_', '+/'));
    }

    public static function encode(array $payload, string $secret, int $expiry = 3600): string {
        $payload['iat'] = time();
        $payload['exp'] = time() + $expiry;
        $header  = self::b64(json_encode(['alg'=>'HS256','typ'=>'JWT']));
        $body    = self::b64(json_encode($payload));
        $sig     = self::b64(hash_hmac('sha256', "$header.$body", $secret, true));
        return "$header.$body.$sig";
    }

    public static function decode(string $token, string $secret): ?array {
        $parts = explode('.', $token);
        if (count($parts) !== 3) return null;
        [$header, $body, $sig] = $parts;
        $expected = self::b64(hash_hmac('sha256', "$header.$body", $secret, true));
        if (!hash_equals($expected, $sig)) return null;
        $payload = json_decode(self::unb64($body), true);
        if (!$payload || $payload['exp'] < time()) return null;
        return $payload;
    }

    public static function fromRequest(): ?array {
        $header = $_SERVER['HTTP_AUTHORIZATION']
               ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION']
               ?? '';
        if (!preg_match('/^Bearer\s+(.+)$/i', $header, $m)) return null;
        $cfg = require __DIR__ . '/../config.php';
        return self::decode($m[1], $cfg['jwt_secret']);
    }
}
