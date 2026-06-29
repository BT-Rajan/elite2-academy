<?php
declare(strict_types=1);

class Mailer {
    public static function send(string $to, string $subject, string $htmlBody): bool {
        $cfg     = require __DIR__ . '/../config.php';
        $from    = $cfg['mail_from']    ?? 'noreply@yourdojo.com';
        $name    = $cfg['mail_from_name'] ?? 'Dojo Platform';
        $headers = implode("\r\n", [
            "MIME-Version: 1.0",
            "Content-Type: text/html; charset=UTF-8",
            "From: $name <$from>",
            "Reply-To: $from",
            "X-Mailer: DojoMailer/1.0",
        ]);
        return mail($to, $subject, $htmlBody, $headers);
    }

    public static function passwordReset(string $to, string $token, string $baseUrl): bool {
        $link = "$baseUrl/auth/reset-password?token=$token";
        $body = "
        <div style='font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px'>
          <h2 style='color:#6366f1'>🥋 Dojo Platform</h2>
          <p>You requested a password reset. Click the link below to set a new password:</p>
          <p style='margin:24px 0'>
            <a href='$link' style='background:#6366f1;color:#fff;padding:12px 24px;
               border-radius:8px;text-decoration:none;font-weight:600'>
              Reset Password
            </a>
          </p>
          <p style='color:#888;font-size:13px'>
            This link expires in 1 hour. If you didn't request this, ignore this email.
          </p>
        </div>";
        return self::send($to, 'Reset your Dojo Platform password', $body);
    }

    public static function notification(string $to, string $title, string $body): bool {
        $html = "
        <div style='font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px'>
          <h2 style='color:#6366f1'>🥋 $title</h2>
          <p>$body</p>
          <p style='color:#888;font-size:12px;margin-top:24px'>
            Dojo Platform — You're receiving this because notifications are enabled.
          </p>
        </div>";
        return self::send($to, $title, $html);
    }
}
