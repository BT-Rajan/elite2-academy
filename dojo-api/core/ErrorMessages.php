<?php
declare(strict_types=1);

require_once __DIR__ . '/Env.php';

/**
 * All user-facing error copy lives here, backed by .env (ERR_* keys) with
 * built-in fallbacks. Controllers/middleware should call ErrorMessages::get()
 * instead of hardcoding strings, so wording can be changed via .env without
 * touching code, and so we have one place that's guaranteed never to leak
 * internals (stack traces, SQL, file paths) to the client.
 */
class ErrorMessages {
    private static array $defaults = [
        'auth.invalid_credentials' => 'Invalid email or password.',
        'auth.token_required'      => 'Please sign in to continue.',
        'auth.pending_approval'    => "Your account is pending approval. You'll get access once an administrator approves it.",
        'auth.rejected'            => 'Your account request was not approved. Contact your dojo administrator.',
        'auth.forbidden'           => "You don't have permission to do that.",
        'auth.rate_limited'        => 'Too many sign-in attempts. Please try again in a few minutes.',
        'auth.invalid_token'       => 'Your session is no longer valid. Please sign in again.',
        'server.generic'          => 'Something went wrong on our end. Please try again.',
        'server.database'        => "We couldn't complete that request right now. Please try again shortly.",
        'validation.generic'     => 'Please check your input and try again.',
    ];

    public static function get(string $key): string {
        $envKey = 'ERR_' . strtoupper(str_replace('.', '_', $key));
        $fromEnv = Env::get($envKey);
        return $fromEnv ?? (self::$defaults[$key] ?? 'An unexpected error occurred.');
    }

    /**
     * Logs the real error server-side (never sent to the client) and
     * returns the safe, well-formed message the client should see.
     */
    public static function logAndGet(string $key, \Throwable $e): string {
        error_log('[' . $key . '] ' . $e->getMessage() . ' in ' . $e->getFile() . ':' . $e->getLine());
        return self::get($key);
    }
}
