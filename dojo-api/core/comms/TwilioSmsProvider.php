<?php
declare(strict_types=1);

require_once __DIR__ . '/ChannelProviderInterface.php';
require_once __DIR__ . '/../Logger.php';

/**
 * TwilioSmsProvider — real Twilio REST API integration, ready to use as
 * soon as an admin configures credentials via
 * PATCH /communication/providers/sms {"provider":"twilio","config":{...}}.
 *
 * Expected config keys:
 *   accountSid  - Twilio Account SID
 *   authToken   - Twilio Auth Token
 *   fromNumber  - Twilio phone number in E.164 format (e.g. "+15551234567")
 *
 * NOTE: this sandbox's outbound network allowlist doesn't include
 * api.twilio.com, so this code path can't be live-tested here — but the
 * request shape below matches Twilio's documented Messages resource
 * exactly. If config is incomplete, it fails closed with a clear error
 * rather than silently no-op'ing, so a misconfigured dojo finds out from
 * the send result (and the communication_logs row) instead of a channel
 * that looks like it's working but isn't.
 */
class TwilioSmsProvider implements ChannelProviderInterface {
    public function send(string $to, string $subject, string $body, array $config): array {
        $sid   = $config['accountSid'] ?? null;
        $token = $config['authToken']  ?? null;
        $from  = $config['fromNumber'] ?? null;
        if (!$sid || !$token || !$from) {
            return ['success' => false, 'providerMessageId' => null,
                     'error' => 'Twilio is selected as the SMS provider but accountSid/authToken/fromNumber are not fully configured.'];
        }

        $url = "https://api.twilio.com/2010-04-01/Accounts/{$sid}/Messages.json";
        $ch  = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST           => true,
            CURLOPT_USERPWD        => "{$sid}:{$token}",
            CURLOPT_POSTFIELDS     => http_build_query(['To' => $to, 'From' => $from, 'Body' => $body]),
            CURLOPT_TIMEOUT        => 15,
        ]);
        $raw     = curl_exec($ch);
        $errno   = curl_errno($ch);
        $curlErr = curl_error($ch);
        $status  = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($errno) {
            Logger::error('comms.twilio_transport_error', ['error' => $curlErr]);
            return ['success' => false, 'providerMessageId' => null, 'error' => "Network error contacting Twilio: {$curlErr}"];
        }

        $data = json_decode((string)$raw, true) ?? [];
        if ($status >= 200 && $status < 300) {
            return ['success' => true, 'providerMessageId' => $data['sid'] ?? null, 'error' => null];
        }
        $err = $data['message'] ?? "Twilio returned HTTP {$status}";
        Logger::error('comms.twilio_api_error', ['status' => $status, 'body' => $data]);
        return ['success' => false, 'providerMessageId' => null, 'error' => $err];
    }
}
