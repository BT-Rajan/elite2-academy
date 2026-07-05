<?php
declare(strict_types=1);

/**
 * TemplateRenderer — replaces {{placeholder}} tokens in a template's subject
 * and body with values from a data array. Unknown placeholders are left
 * as-is (rather than silently becoming blank) so a typo'd token is obvious
 * in a preview instead of just vanishing.
 */
class TemplateRenderer {
    public static function render(string $text, array $data): string {
        return preg_replace_callback('/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/', function ($m) use ($data) {
            return array_key_exists($m[1], $data) ? (string)$data[$m[1]] : $m[0];
        }, $text);
    }

    // Every {{token}} referenced in a piece of text, deduped, in first-seen
    // order -- used to populate `variables` on template save if the caller
    // didn't supply an explicit list.
    public static function extractPlaceholders(string $text): array {
        preg_match_all('/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/', $text, $m);
        return array_values(array_unique($m[1]));
    }
}
