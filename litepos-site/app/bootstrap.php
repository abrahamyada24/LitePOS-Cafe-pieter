<?php

declare(strict_types=1);

use LitePOS\Core\Env;
use LitePOS\Core\Logger;
use LitePOS\Core\Security;

define('BASE_PATH', dirname(__DIR__));

spl_autoload_register(static function (string $class): void {
    $prefix = 'LitePOS\\';
    if (!str_starts_with($class, $prefix)) {
        return;
    }

    $relative = substr($class, strlen($prefix));
    $file = BASE_PATH . '/app/' . str_replace('\\', '/', $relative) . '.php';
    if (is_file($file)) {
        require $file;
    }
});

Env::load(BASE_PATH . '/.env');

if (!function_exists('env')) {
    /** @return mixed */
    function env(string $key, mixed $default = null): mixed
    {
        return Env::get($key, $default);
    }
}

date_default_timezone_set((string) Env::get('APP_TIMEZONE', 'Asia/Jakarta'));
ini_set('display_errors', Env::get('APP_DEBUG', false) ? '1' : '0');
ini_set('log_errors', '1');
ini_set('expose_php', '0');

set_exception_handler(static function (Throwable $error): void {
    Logger::error('Uncaught exception', [
        'type' => get_class($error),
        'message' => $error->getMessage(),
        'file' => $error->getFile(),
        'line' => $error->getLine(),
    ]);

    if (env('APP_DEBUG', false)) {
        http_response_code(500);
        echo '<pre>' . htmlspecialchars((string) $error, ENT_QUOTES, 'UTF-8') . '</pre>';
        return;
    }

    http_response_code(500);
    echo 'Terjadi kendala. Silakan coba kembali.';
});

Security::startSession();
Security::sendHeaders();

if (!function_exists('e')) {
    function e(mixed $value): string
    {
        return htmlspecialchars((string) $value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    }
}

if (!function_exists('rupiah')) {
    function rupiah(int|float|string $amount): string
    {
        return 'Rp ' . number_format((float) $amount, 0, ',', '.');
    }
}

if (!function_exists('url')) {
    function url(string $path = ''): string
    {
        $base = rtrim((string) env('APP_URL', ''), '/');
        if ($base === '') {
            $https = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off');
            $scheme = $https ? 'https' : 'http';
            $host = preg_replace('/[^A-Za-z0-9.\-:\[\]]/', '', (string) ($_SERVER['HTTP_HOST'] ?? 'localhost'));
            $base = $scheme . '://' . ($host ?: 'localhost');
        }

        return $base . '/' . ltrim($path, '/');
    }
}
