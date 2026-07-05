<?php
declare(strict_types=1);

require_once __DIR__ . '/LogChannelProvider.php';
require_once __DIR__ . '/SmtpEmailProvider.php';
require_once __DIR__ . '/TwilioSmsProvider.php';
require_once __DIR__ . '/WhatsAppCloudProvider.php';

/**
 * ProviderFactory — looks up which driver a dojo has configured for a given
 * channel (communication_provider_configs) and instantiates it. Missing
 * config row = safe default (log for whatsapp/sms, smtp for email) rather
 * than an error, so a brand-new dojo can use every event type immediately
 * without an admin having to configure anything first.
 */
class ProviderFactory {
    private const DRIVERS = [
        'log'            => LogChannelProvider::class,
        'smtp'           => SmtpEmailProvider::class,
        'twilio'         => TwilioSmsProvider::class,
        'whatsapp_cloud' => WhatsAppCloudProvider::class,
    ];

    private const CHANNEL_DEFAULTS = [
        'whatsapp' => 'log',
        'sms'      => 'log',
        'email'    => 'smtp',
    ];

    /** @return array{provider: string, config: array, driver: ChannelProviderInterface} */
    public static function resolve(PDO $db, string $dojoId, string $channel): array {
        $stmt = $db->prepare("SELECT provider, config FROM communication_provider_configs WHERE dojo_id = ? AND channel = ? AND is_active = 1");
        $stmt->execute([$dojoId, $channel]);
        $row = $stmt->fetch();

        $provider = $row['provider'] ?? (self::CHANNEL_DEFAULTS[$channel] ?? 'log');
        $config   = $row && $row['config'] ? (json_decode($row['config'], true) ?? []) : [];

        $class = self::DRIVERS[$provider] ?? LogChannelProvider::class;
        return ['provider' => $provider, 'config' => $config, 'driver' => new $class()];
    }

    public static function availableProviders(string $channel): array {
        return match ($channel) {
            'whatsapp' => ['log', 'whatsapp_cloud'],
            'sms'      => ['log', 'twilio'],
            'email'    => ['log', 'smtp'],
            default    => ['log'],
        };
    }

    // Config keys that must never round-trip back to the client in plaintext.
    public const SECRET_KEYS = ['authToken', 'accessToken', 'apiKey', 'apiSecret', 'password'];

    public static function maskConfig(array $config): array {
        foreach (self::SECRET_KEYS as $key) {
            if (isset($config[$key]) && $config[$key] !== '') $config[$key] = '••••••••';
        }
        return $config;
    }
}
