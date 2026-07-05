<?php
declare(strict_types=1);

/**
 * CommEventCatalog — the single source of truth for which channels each
 * communication "event" is allowed to go out on. Both the API (validation)
 * and the Angular Communication Center (populating the compose form) read
 * this list, so it only ever needs to change in one place.
 *
 *   admission, attendance, evaluation, promotion, announcement, report
 *                                        -> whatsapp, sms, or email
 *   otp                                  -> sms only
 *   email_campaign, newsletter           -> email only
 *   marketing_promo ("Promotions")       -> email or whatsapp (no SMS)
 *   parent_engagement                    -> in-app chat only -- this is the
 *     existing threads/messages feature, not a new external channel. It's
 *     listed here so it appears consistently in event/template listings,
 *     but CommunicationController::send() rejects it outright and points
 *     callers at POST /threads/:id/messages instead.
 */
class CommEventCatalog {
    public const CHANNELS = [
        'admission'         => ['whatsapp', 'sms', 'email'],
        'attendance'        => ['whatsapp', 'sms', 'email'],
        'evaluation'        => ['whatsapp', 'sms', 'email'],
        'promotion'         => ['whatsapp', 'sms', 'email'],
        'announcement'      => ['whatsapp', 'sms', 'email'],
        'otp'               => ['sms'],
        'email_campaign'    => ['email'],
        'newsletter'        => ['email'],
        'marketing_promo'   => ['email', 'whatsapp'],
        'parent_engagement' => ['chat'],
        'report'            => ['whatsapp', 'sms', 'email'],
    ];

    public const LABELS = [
        'admission'         => 'Admission',
        'attendance'        => 'Attendance',
        'evaluation'        => 'Evaluation',
        'promotion'         => 'Promotion',
        'announcement'      => 'Announcements',
        'otp'               => 'OTP',
        'email_campaign'    => 'Email Campaigns',
        'newsletter'        => 'Newsletters',
        'marketing_promo'   => 'Promotions',
        'parent_engagement' => 'Parent Engagement',
        'report'            => 'Reports',
    ];

    // Events that are single-recipient, triggered-by-a-record sends
    // (Admission/Attendance/Evaluation/Promotion/OTP/Report -- "send this one
    // message about this one student/user") vs. events that are inherently
    // bulk campaigns (Email Campaigns/Newsletters/Promotions -- "send this to
    // an audience"). Announcements can reasonably be either, so it's allowed
    // through both /communication/send (single or explicit recipient list)
    // and left out of the campaign-only type enum.
    public const CAMPAIGN_TYPES = ['email_campaign', 'newsletter', 'marketing_promo'];

    public static function isValidEvent(string $eventType): bool {
        return isset(self::CHANNELS[$eventType]);
    }

    public static function channelsFor(string $eventType): array {
        return self::CHANNELS[$eventType] ?? [];
    }

    public static function isChannelAllowed(string $eventType, string $channel): bool {
        return in_array($channel, self::channelsFor($eventType), true);
    }

    // For the frontend's compose form: [{value, label, channels: [...]}]
    public static function catalog(): array {
        $out = [];
        foreach (self::CHANNELS as $key => $channels) {
            $out[] = ['value' => $key, 'label' => self::LABELS[$key], 'channels' => $channels];
        }
        return $out;
    }
}
