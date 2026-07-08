<?php
declare(strict_types=1);

require_once __DIR__ . '/SmtpClient.php';

class Mailer {
    public static function send(string $to, string $subject, string $htmlBody): bool {
        $cfg  = require __DIR__ . '/../config.php';
        $from = $cfg['mail_from']      ?? 'noreply@yourdojo.com';
        $name = $cfg['mail_from_name'] ?? 'Dojo Platform';

        // Prefer real SMTP when configured -- mail() has no way to
        // authenticate with a real provider (Gmail, SES, Mailgun, etc.)
        // and on most modern hosting either fails silently or never
        // arrives at all, since there's no local MTA listening.
        if (!empty($cfg['smtp_host'])) {
            try {
                $client = new SmtpClient(
                    host: $cfg['smtp_host'],
                    port: $cfg['smtp_port'],
                    username: $cfg['smtp_user'] ?? '',
                    password: $cfg['smtp_pass'] ?? '',
                    useTls: $cfg['smtp_port'] === 465,
                    useStartTls: $cfg['smtp_port'] === 587,
                );
                $client->send($from, $name, $to, $subject, $htmlBody);
                return true;
            } catch (\Throwable $e) {
                error_log('[Mailer/SMTP] ' . $e->getMessage());
                return false;
            }
        }

        // No SMTP configured -- fall back to mail(), which works out of
        // the box on a properly configured Linux server with a local MTA
        // (e.g. most traditional shared hosting) but not on most cloud
        // VMs/containers with no MTA installed.
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
          <h2 style='color:#6366f1'>Dojo Platform</h2>
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
          <h2 style='color:#6366f1'>$title</h2>
          <p>$body</p>
          <p style='color:#888;font-size:12px;margin-top:24px'>
            Dojo Platform — You're receiving this because notifications are enabled.
          </p>
        </div>";
        return self::send($to, $title, $html);
    }
}
