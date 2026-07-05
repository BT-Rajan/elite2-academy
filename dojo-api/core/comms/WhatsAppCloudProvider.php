<?php
declare(strict_types=1);

require_once __DIR__ . '/ChannelProviderInterface.php';
require_once __DIR__ . '/../Logger.php';

/**
 * WhatsAppCloudProvider — real Meta WhatsApp Cloud API (Graph API)
 * integration, ready to use once configured via
 * PATCH /communication/providers/whatsapp {"provider":"whatsapp_cloud","config":{...}}.
 *
 * Expected config keys:
 *   phoneNumberId - the WhatsApp Business phone number ID (from Meta)
 *   accessToken   - a permanent (System User) access token
 *   apiVersion    - optional, defaults to "v19.0"
 *
 * Sends a plain text message (messaging_product=whatsapp). Meta requires
 * the recipient to have messaged the business within the last 24h *or* the
 * message to use a pre-approved template -- if this dojo needs template
 * messages for cold outreach, the template `name`/`language` would go in
 * $config and this call swapped for the `template` message type; plain
 * text covers the reply-window case this app's events mostly are
 * (attendance/evaluation/promotion notices to an already-engaged parent).
 *
 * NOTE: like Twilio above, this sandbox can't reach graph.facebook.com to
 * live-test this, but the request shape matches Meta's documented Cloud
 * API exactly. Fails closed with a clear error if config is incomplete.
 */
class WhatsAppCloudProvider implements ChannelProviderInterface {
    public function send(string $to, string $subject, string $body, array $config): array {
        $phoneNumberId = $config['phoneNumberId'] ?? null;
        $accessToken   = $config['accessToken']   ?? null;
        $apiVersion    = $config['apiVersion']     ?? 'v19.0';
        if (!$phoneNumberId || !$accessToken) {
            return ['success' => false, 'providerMessageId' => null,
                     'error' => 'WhatsApp Cloud API is selected but phoneNumberId/accessToken are not fully configured.'];
        }

        $url = "https://graph.facebook.com/{$apiVersion}/{$phoneNumberId}/messages";
        $payload = json_encode([
            'messaging_product' => 'whatsapp',
            'to'                => preg_replace('/[^0-9+]/', '', $to),
            'type'              => 'text',
            'text'              => ['body' => $body],
        ]);

        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST           => true,
            CURLOPT_HTTPHEADER     => ["Authorization: Bearer {$accessToken}", 'Content-Type: application/json'],
            CURLOPT_POSTFIELDS     => $payload,
            CURLOPT_TIMEOUT        => 15,
        ]);
        $raw     = curl_exec($ch);
        $errno   = curl_errno($ch);
        $curlErr = curl_error($ch);
        $status  = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($errno) {
            Logger::error('comms.whatsapp_transport_error', ['error' => $curlErr]);
            return ['success' => false, 'providerMessageId' => null, 'error' => "Network error contacting WhatsApp Cloud API: {$curlErr}"];
        }

        $data = json_decode((string)$raw, true) ?? [];
        if ($status >= 200 && $status < 300) {
            $msgId = $data['messages'][0]['id'] ?? null;
            return ['success' => true, 'providerMessageId' => $msgId, 'error' => null];
        }
        $err = $data['error']['message'] ?? "WhatsApp Cloud API returned HTTP {$status}";
        Logger::error('comms.whatsapp_api_error', ['status' => $status, 'body' => $data]);
        return ['success' => false, 'providerMessageId' => null, 'error' => $err];
    }
}
