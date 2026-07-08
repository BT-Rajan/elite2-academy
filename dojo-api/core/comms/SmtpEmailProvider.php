<?php
declare(strict_types=1);

require_once __DIR__ . '/ChannelProviderInterface.php';
require_once __DIR__ . '/../Mailer.php';

/**
 * SmtpEmailProvider — the default email driver. Wraps Mailer::send(),
 * which uses real SMTP (see core/SmtpClient.php) when SMTP_HOST is set in
 * .env, falling back to PHP's bare mail() otherwise. Unlike WhatsApp/SMS,
 * this channel has a working fallback with no config at all -- though on
 * most cloud hosting that fallback (mail()) won't actually deliver, so
 * setting SMTP_HOST is still recommended for anything beyond local dev.
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
