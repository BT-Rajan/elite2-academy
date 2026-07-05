<?php
declare(strict_types=1);

require_once __DIR__ . '/ChannelProviderInterface.php';
require_once __DIR__ . '/../Logger.php';

/**
 * LogChannelProvider — the safe-by-default driver for WhatsApp and SMS
 * (and a fallback for anything unrecognized). It never makes an outbound
 * call anywhere; it just records what *would* have been sent to the app
 * log and reports success, so the rest of the Communication Layer
 * (templates, sends, campaigns, OTP, history) is fully usable and testable
 * before any real WhatsApp/SMS credentials exist. Swap a channel to a real
 * provider any time via PATCH /communication/providers/:channel.
 */
class LogChannelProvider implements ChannelProviderInterface {
    public function send(string $to, string $subject, string $body, array $config): array {
        Logger::info('comms.mock_send', [
            'to' => $to, 'subject' => $subject, 'bodyPreview' => substr($body, 0, 200),
        ]);
        return ['success' => true, 'providerMessageId' => 'log-' . uniqid('', true), 'error' => null];
    }
}
