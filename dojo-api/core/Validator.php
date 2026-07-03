<?php
declare(strict_types=1);

require_once __DIR__ . '/Response.php';

/**
 * Small fluent validator so every controller validates request bodies the
 * same way instead of ad hoc `if (!$x) Response::error(...)` chains with
 * inconsistent rules. Usage:
 *
 *   $b = $this->body();
 *   Validator::make($b)
 *       ->required('email')->email('email')
 *       ->required('password')->string('password', 6, 100)
 *       ->in('role', ['admin','coach','parent','staff'])
 *       ->check();   // aborts the request with a 400 if anything failed
 */
class Validator {
    private array $data;
    private array $errors = [];

    private function __construct(array $data) { $this->data = $data; }
    public static function make(array $data): self { return new self($data); }

    private function label(string $field): string {
        return ucfirst(preg_replace('/([A-Z])/', ' $1', $field));
    }

    private function present(string $field): bool {
        $v = $this->data[$field] ?? null;
        return !($v === null || $v === '' || (is_string($v) && trim($v) === ''));
    }

    public function required(string $field): self {
        if (!$this->present($field)) $this->errors[] = $this->label($field) . ' is required.';
        return $this;
    }

    public function string(string $field, int $min = 0, int $max = 65535): self {
        if (!$this->present($field)) return $this;
        $len = strlen((string)$this->data[$field]);
        if ($len < $min) $this->errors[] = $this->label($field) . " must be at least $min characters.";
        if ($len > $max) $this->errors[] = $this->label($field) . " must be $max characters or fewer.";
        return $this;
    }

    public function email(string $field): self {
        if (!$this->present($field)) return $this;
        if (!filter_var($this->data[$field], FILTER_VALIDATE_EMAIL)) {
            $this->errors[] = $this->label($field) . ' must be a valid email address.';
        }
        return $this;
    }

    public function int(string $field, ?int $min = null, ?int $max = null): self {
        if (!$this->present($field)) return $this;
        $v = $this->data[$field];
        if (!is_numeric($v) || (string)(int)$v !== (string)(int)round((float)$v)) {
            $this->errors[] = $this->label($field) . ' must be a whole number.';
            return $this;
        }
        $v = (int)$v;
        if ($min !== null && $v < $min) $this->errors[] = $this->label($field) . " must be at least $min.";
        if ($max !== null && $v > $max) $this->errors[] = $this->label($field) . " must be at most $max.";
        return $this;
    }

    public function in(string $field, array $allowed): self {
        if (!$this->present($field)) return $this;
        if (!in_array($this->data[$field], $allowed, true)) {
            $this->errors[] = $this->label($field) . ' must be one of: ' . implode(', ', $allowed) . '.';
        }
        return $this;
    }

    public function date(string $field): self {
        if (!$this->present($field)) return $this;
        $v = $this->data[$field];
        $d = DateTime::createFromFormat('Y-m-d', (string)$v);
        if (!$d || $d->format('Y-m-d') !== $v) {
            $this->errors[] = $this->label($field) . ' must be a valid date (YYYY-MM-DD).';
        }
        return $this;
    }

    public function time(string $field): self {
        if (!$this->present($field)) return $this;
        if (!preg_match('/^([01]\d|2[0-3]):[0-5]\d$/', (string)$this->data[$field])) {
            $this->errors[] = $this->label($field) . ' must be a valid time (HH:MM).';
        }
        return $this;
    }

    public function hexColor(string $field): self {
        if (!$this->present($field)) return $this;
        if (!preg_match('/^#[0-9a-fA-F]{3,8}$/', (string)$this->data[$field])) {
            $this->errors[] = $this->label($field) . ' must be a hex color (e.g. #6366f1).';
        }
        return $this;
    }

    public function fails(): bool { return !empty($this->errors); }
    public function errors(): array { return $this->errors; }

    /** Aborts the request with a well-formed 400 if any rule failed. */
    public function check(): void {
        if ($this->errors) Response::error(implode(' ', $this->errors), 422);
    }
}
