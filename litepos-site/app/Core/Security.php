<?php

declare(strict_types=1);

namespace LitePOS\Core;

final class Security
{
    public static function startSession(): void
    {
        if (PHP_SAPI === 'cli' || session_status() === PHP_SESSION_ACTIVE || headers_sent()) {
            return;
        }

        $secure = self::isHttps();
        session_name((string) env('SESSION_NAME', 'litepos_secure_session'));
        session_set_cookie_params([
            'lifetime' => 0,
            'path' => '/',
            'domain' => '',
            'secure' => $secure,
            'httponly' => true,
            'samesite' => 'Lax',
        ]);
        ini_set('session.use_strict_mode', '1');
        ini_set('session.use_only_cookies', '1');
        ini_set('session.cookie_httponly', '1');
        ini_set('session.cookie_samesite', 'Lax');
        session_start();
    }

    public static function sendHeaders(): void
    {
        if (headers_sent()) {
            return;
        }

        header_remove('X-Powered-By');
        header('X-Content-Type-Options: nosniff');
        header('X-Frame-Options: DENY');
        header('Referrer-Policy: strict-origin-when-cross-origin');
        header('Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(self "https://app.midtrans.com" "https://app.sandbox.midtrans.com")');
        header("Content-Security-Policy: default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; img-src 'self' data: https://*.midtrans.com; style-src 'self' 'unsafe-inline'; script-src 'self' https://app.midtrans.com https://app.sandbox.midtrans.com; connect-src 'self' https://*.midtrans.com; frame-src https://*.midtrans.com");

        if (self::isHttps()) {
            header('Strict-Transport-Security: max-age=31536000; includeSubDomains');
        }
    }

    public static function csrfToken(): string
    {
        if (empty($_SESSION['_csrf']) || !is_string($_SESSION['_csrf'])) {
            $_SESSION['_csrf'] = bin2hex(random_bytes(32));
        }

        return $_SESSION['_csrf'];
    }

    public static function validateCsrf(?string $token): bool
    {
        $stored = $_SESSION['_csrf'] ?? '';
        return is_string($stored) && is_string($token) && $stored !== '' && hash_equals($stored, $token);
    }

    public static function requireCsrf(): void
    {
        $token = $_POST['_csrf'] ?? ($_SERVER['HTTP_X_CSRF_TOKEN'] ?? null);
        if (!self::validateCsrf(is_string($token) ? $token : null)) {
            http_response_code(419);
            exit('Sesi formulir tidak valid. Muat ulang halaman lalu coba kembali.');
        }
    }

    /** @param array<string,mixed> $payload */
    public static function json(array $payload, int $status = 200): never
    {
        http_response_code($status);
        header('Content-Type: application/json; charset=utf-8');
        header('Cache-Control: no-store, private');
        echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
        exit;
    }

    public static function redirect(string $path, int $status = 303): never
    {
        header('Location: ' . url($path), true, $status);
        exit;
    }

    public static function clientIp(): string
    {
        $remote = (string) ($_SERVER['REMOTE_ADDR'] ?? 'unknown');
        if ((bool) env('TRUST_CLOUDFLARE', false)) {
            $cfIp = (string) ($_SERVER['HTTP_CF_CONNECTING_IP'] ?? '');
            if (filter_var($cfIp, FILTER_VALIDATE_IP)) {
                return $cfIp;
            }
        }

        return filter_var($remote, FILTER_VALIDATE_IP) ? $remote : 'unknown';
    }

    public static function isHttps(): bool
    {
        if (!empty($_SERVER['HTTPS']) && strtolower((string) $_SERVER['HTTPS']) !== 'off') {
            return true;
        }

        return (bool) env('TRUST_CLOUDFLARE', false)
            && strtolower((string) ($_SERVER['HTTP_CF_VISITOR'] ?? '')) === '{"scheme":"https"}';
    }

    public static function sanitizeStoreId(string $value): string
    {
        return strtoupper(trim((string) preg_replace('/[^A-Za-z0-9_-]/', '', $value)));
    }
}
