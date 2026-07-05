<?php
declare(strict_types=1);

/**
 * ChannelProviderInterface — every way of actually dispatching a message
 * (log/mock, SMTP email, Twilio SMS, WhatsApp Cloud API, ...) implements
 * this one method. CommunicationController and campaign sending never touch
 * a concrete provider directly — always through ProviderFactory — so
 * switching a dojo's SMS provider from 'log' to 'twilio' later is a config
 * change, not a code change.
 */
interface ChannelProviderInterface {
    /**
     * @param string $to      Phone number (E.164 preferred) or email address.
     * @param string $subject Email subject; ignored by SMS/WhatsApp providers.
     * @param string $body    Fully-rendered message body.
     * @param array  $config  Provider-specific credentials/settings from
     *                        communication_provider_configs.config.
     * @return array{success: bool, providerMessageId: ?string, error: ?string}
     */
    public function send(string $to, string $subject, string $body, array $config): array;
}
