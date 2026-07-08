<?php
declare(strict_types=1);

/**
 * SmtpClient — sends mail over real SMTP with no external dependency
 * (there's no Composer/PHPMailer in this project). Supports implicit TLS
 * (port 465) and STARTTLS (port 587), plus AUTH LOGIN. This is what
 * Mailer::send() uses when SMTP_HOST is configured in .env; it falls back
 * to PHP's bare mail() otherwise, which is what this whole class exists to
 * replace -- mail() has no way to authenticate with a real mail provider
 * and silently fails (or never arrives) on most modern hosting.
 */
class SmtpClient {
    private $socket;
    private array $log = [];

    public function __construct(
        private readonly string $host,
        private readonly int $port,
        private readonly string $username,
        private readonly string $password,
        private readonly bool $useTls = true,   // implicit TLS, e.g. port 465
        private readonly bool $useStartTls = false, // STARTTLS, e.g. port 587
        private readonly int $timeout = 10,
    ) {}

    /** @throws RuntimeException with a human-readable reason on any failure */
    public function send(string $from, string $fromName, string $to, string $subject, string $htmlBody): void {
        $this->connect();
        try {
            $this->expect(220, 'connect');
            $this->command("EHLO " . ($_SERVER['SERVER_NAME'] ?? 'localhost'), 250, 'EHLO');

            if ($this->useStartTls) {
                $this->command('STARTTLS', 220, 'STARTTLS');
                if (!stream_socket_enable_crypto($this->socket, true, STREAM_CRYPTO_METHOD_TLS_CLIENT)) {
                    throw new RuntimeException('STARTTLS negotiation failed.');
                }
                // RFC 3207: EHLO must be re-sent after STARTTLS.
                $this->command("EHLO " . ($_SERVER['SERVER_NAME'] ?? 'localhost'), 250, 'EHLO (post-TLS)');
            }

            if ($this->username !== '') {
                $this->command('AUTH LOGIN', 334, 'AUTH LOGIN');
                $this->command(base64_encode($this->username), 334, 'AUTH username');
                $this->command(base64_encode($this->password), 235, 'AUTH password');
            }

            $this->command("MAIL FROM:<$from>", 250, 'MAIL FROM');
            $this->command("RCPT TO:<$to>", [250, 251], 'RCPT TO');
            $this->command('DATA', 354, 'DATA');

            $headers = implode("\r\n", [
                "From: $fromName <$from>",
                "To: <$to>",
                "Subject: $subject",
                "MIME-Version: 1.0",
                "Content-Type: text/html; charset=UTF-8",
                "Date: " . date('r'),
            ]);
            // Per RFC 5321: lines consisting solely of "." must be dot-stuffed.
            $body = preg_replace('/^\./m', '..', $htmlBody);
            $this->rawWrite("$headers\r\n\r\n$body\r\n.\r\n");
            $this->expect(250, 'DATA terminator');

            $this->command('QUIT', 221, 'QUIT');
        } finally {
            $this->disconnect();
        }
    }

    private function connect(): void {
        $prefix = $this->useTls ? 'ssl://' : '';
        $this->socket = @stream_socket_client(
            "{$prefix}{$this->host}:{$this->port}", $errno, $errstr, $this->timeout
        );
        if (!$this->socket) {
            throw new RuntimeException("Could not connect to SMTP server {$this->host}:{$this->port} ($errstr)");
        }
        stream_set_timeout($this->socket, $this->timeout);
    }

    private function disconnect(): void {
        if (is_resource($this->socket)) fclose($this->socket);
    }

    private function rawWrite(string $data): void {
        fwrite($this->socket, $data);
    }

    private function readLine(): string {
        $line = fgets($this->socket, 515);
        if ($line === false) throw new RuntimeException('SMTP connection closed unexpectedly.');
        $this->log[] = $line;
        return $line;
    }

    /** Reads until a non-continuation ("250 " not "250-") line and returns its code. */
    private function readResponse(): int {
        do {
            $line = $this->readLine();
        } while (isset($line[3]) && $line[3] === '-');
        return (int)substr($line, 0, 3);
    }

    private function expect(int|array $expected, string $step): void {
        $code = $this->readResponse();
        $expected = is_array($expected) ? $expected : [$expected];
        if (!in_array($code, $expected, true)) {
            throw new RuntimeException("SMTP error during $step: got $code, expected " . implode('/', $expected) . '. Last response: ' . trim(end($this->log)));
        }
    }

    private function command(string $cmd, int|array $expectedCode, string $step): void {
        $this->rawWrite("$cmd\r\n");
        $this->expect($expectedCode, $step);
    }
}
