<?php
declare(strict_types=1);

require_once __DIR__ . '/../core/Database.php';
require_once __DIR__ . '/../core/Response.php';
require_once __DIR__ . '/../middleware/Auth.php';
require_once __DIR__ . '/../core/Validator.php';

/**
 * ProfileController — self-service profile management, available to every
 * authenticated role (admin, coach, parent, staff). A user can only ever
 * read/modify their own row here; dojoId and role are intentionally
 * read-only from this controller (role/dojo changes are an admin action
 * elsewhere, not a self-service one).
 */
class ProfileController {
    private PDO $db;
    private const MAX_PHOTO_BYTES = 3 * 1024 * 1024; // 3MB
    private const ALLOWED_MIME = [
        'image/jpeg' => 'jpg',
        'image/png'  => 'png',
        'image/webp' => 'webp',
    ];

    public function __construct() { $this->db = Database::get(); }

    // GET /profile
    public function get(): never {
        $auth = AuthMiddleware::require();
        $row  = $this->row($auth['uid']);
        Response::ok($this->present($row));
    }

    // PUT /profile
    public function update(): never {
        $auth = AuthMiddleware::require();
        $b    = $this->body();
        Validator::make($b)
            ->required('firstName')->string('firstName', 1, 60)
            ->required('lastName')->string('lastName', 1, 60)
            ->required('email')->email('email')
            ->string('phone', 0, 30)
            ->string('salutation', 0, 10)
            ->check();

        $salutation = trim($b['salutation'] ?? '');
        $firstName  = trim($b['firstName']  ?? '');
        $lastName   = trim($b['lastName']   ?? '');
        $phone      = trim($b['phone']      ?? '');
        $email      = trim($b['email']      ?? '');

        // Email must stay unique across the platform (excluding this user).
        $dupe = $this->db->prepare("SELECT id FROM users WHERE email = ? AND uid != ?");
        $dupe->execute([$email, $auth['uid']]);
        if ($dupe->fetch()) Response::error('That email is already in use.', 409);

        $displayName = trim($firstName . ' ' . $lastName);

        $this->db->prepare("
            UPDATE users
            SET salutation = ?, first_name = ?, last_name = ?, display_name = ?, phone = ?, email = ?
            WHERE uid = ?
        ")->execute([$salutation ?: null, $firstName, $lastName, $displayName, $phone ?: null, $email, $auth['uid']]);

        Response::ok($this->present($this->row($auth['uid'])));
    }

    // POST /profile/photo  (multipart/form-data, field name: photo)
    public function uploadPhoto(): never {
        $auth = AuthMiddleware::require();

        if (empty($_FILES['photo']) || $_FILES['photo']['error'] !== UPLOAD_ERR_OK)
            Response::error('No photo uploaded, or the upload failed.');

        $file = $_FILES['photo'];
        if ($file['size'] > self::MAX_PHOTO_BYTES)
            Response::error('Photo must be 3MB or smaller.');

        $finfo = finfo_open(FILEINFO_MIME_TYPE);
        $mime  = finfo_file($finfo, $file['tmp_name']);
        finfo_close($finfo);

        if (!isset(self::ALLOWED_MIME[$mime]))
            Response::error('Photo must be a JPG, PNG, or WEBP image.');

        // finfo checks magic bytes, but a crafted file can still pass that
        // check while not being a structurally valid image (e.g. a polyglot
        // with embedded PHP/HTML). getimagesize() actually parses the image
        // header and fails on anything that isn't real image data.
        $info = @getimagesize($file['tmp_name']);
        if ($info === false)
            Response::error('That file is not a valid image.');

        // Re-encode through GD rather than saving the uploaded bytes
        // verbatim. This produces a clean image with no embedded metadata,
        // comments, or trailing payload the original file might carry,
        // regardless of what passed the MIME/header checks above.
        $image = match ($mime) {
            'image/jpeg' => @imagecreatefromjpeg($file['tmp_name']),
            'image/png'  => @imagecreatefrompng($file['tmp_name']),
            'image/webp' => @imagecreatefromwebp($file['tmp_name']),
            default      => false,
        };
        if (!$image) Response::error('That file could not be processed as an image.');

        $dir = __DIR__ . '/../uploads/avatars';
        if (!is_dir($dir)) mkdir($dir, 0755, true);

        // Remove any previous photo for this user before saving the new one.
        $this->deleteExistingPhotoFile($auth['uid']);

        $filename = $auth['uid'] . '_' . bin2hex(random_bytes(6)) . '.' . self::ALLOWED_MIME[$mime];
        $dest     = $dir . '/' . $filename;

        $saved = match ($mime) {
            'image/jpeg' => imagejpeg($image, $dest, 88),
            'image/png'  => imagepng($image, $dest, 6),
            'image/webp' => imagewebp($image, $dest, 88),
            default      => false,
        };
        imagedestroy($image);
        if (!$saved) Response::error('Could not save the uploaded photo.', 500);

        $url = $this->publicBaseUrl() . '/uploads/avatars/' . $filename;
        $this->db->prepare("UPDATE users SET avatar_url = ? WHERE uid = ?")->execute([$url, $auth['uid']]);

        Response::ok(['avatarUrl' => $url]);
    }

    // DELETE /profile/photo
    public function deletePhoto(): never {
        $auth = AuthMiddleware::require();
        $this->deleteExistingPhotoFile($auth['uid']);
        $this->db->prepare("UPDATE users SET avatar_url = NULL WHERE uid = ?")->execute([$auth['uid']]);
        Response::ok(['avatarUrl' => null]);
    }

    // POST /profile/password
    public function changePassword(): never {
        $auth = AuthMiddleware::require();
        $b    = $this->body();

        $current = trim($b['currentPassword'] ?? '');
        $next    = trim($b['newPassword']     ?? '');

        if (!$current || !$next) Response::error('Current and new password are required.');

        $pattern = '/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/';
        if (!preg_match($pattern, $next)) {
            Response::error('New password must be at least 8 characters and include an uppercase letter, a lowercase letter, a number, and a special character.');
        }

        $stmt = $this->db->prepare("SELECT password FROM users WHERE uid = ?");
        $stmt->execute([$auth['uid']]);
        $row = $stmt->fetch();
        if (!$row || !password_verify($current, $row['password']))
            Response::error('Current password is incorrect.', 401);

        if (password_verify($next, $row['password']))
            Response::error('New password must be different from your current password.');

        $hash = password_hash($next, PASSWORD_BCRYPT, ['cost' => 12]);
        $this->db->prepare("UPDATE users SET password = ?, token_version = token_version + 1 WHERE uid = ?")
            ->execute([$hash, $auth['uid']]);

        Response::ok(['message' => 'Password updated.']);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────
    private function row(string $uid): array {
        $stmt = $this->db->prepare("SELECT * FROM users WHERE uid = ?");
        $stmt->execute([$uid]);
        $row = $stmt->fetch();
        if (!$row) Response::notFound('User not found.');
        return $row;
    }

    private function present(array $row): array {
        return [
            'uid'         => $row['uid'],
            'email'       => $row['email'],
            'displayName' => $row['display_name'],
            'salutation'  => $row['salutation'] ?? null,
            'firstName'   => $row['first_name'] ?? null,
            'lastName'    => $row['last_name']  ?? null,
            'phone'       => $row['phone']      ?? null,
            'role'        => $row['role'],
            'dojoId'      => $row['dojo_id'],
            'avatarUrl'   => $row['avatar_url'] ?? null,
            'createdAt'   => $row['created_at'],
        ];
    }

    private function deleteExistingPhotoFile(string $uid): void {
        $stmt = $this->db->prepare("SELECT avatar_url FROM users WHERE uid = ?");
        $stmt->execute([$uid]);
        $url = $stmt->fetchColumn();
        if (!$url) return;
        $filename = basename(parse_url($url, PHP_URL_PATH) ?? '');
        $path = __DIR__ . '/../uploads/avatars/' . $filename;
        if ($filename && is_file($path)) @unlink($path);
    }

    /** Base public URL for this API install, e.g. http://localhost/dojo-api */
    private function publicBaseUrl(): string {
        $scheme = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
        $dir    = str_replace('\\', '/', dirname(dirname($_SERVER['SCRIPT_NAME'] ?? '')));
        $dir    = rtrim($dir, '/');
        return $scheme . '://' . ($_SERVER['HTTP_HOST'] ?? 'localhost') . $dir;
    }

    private function body(): array {
        return (array)json_decode(file_get_contents('php://input'), true);
    }
}
