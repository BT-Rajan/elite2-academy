<?php
declare(strict_types=1);

require_once __DIR__ . '/ChannelProviderInterface.php';
require_once __DIR__ . '/../Mailer.php';

/**
 * SmtpEmailProvider — the default email driver. Wraps the existing
 * Mailer::send() (PHP native mail()), which is why email works out of the
 * box with no extra config, unlike WhatsApp/SMS which need real credentials
 * before they can leave "log" mode.
 */
class SmtpEmailProvider implements ChannelProviderInterface {
    public function send(string $to, string $subject, string $body, array $config): array {
        try {
            $ok = Mailer::send($to, $subject, $body);
            return $ok
                ? ['success' => true, 'providerMessageId' => null, 'error' => null]
                : ['success' => false, 'providerMessageId' => null, 'error' => 'mail() returned false — check the server\'s mail configuration.'];
        } catch (\Throwable $e) {
            return ['success' => false, 'providerMessageId' => null, 'error' => $e->getMessage()];
        }
    }
}
