<?php

declare(strict_types=1);

use LitePOS\Controllers\AdminController;
use LitePOS\Controllers\CheckoutController;
use LitePOS\Controllers\HomeController;
use LitePOS\Controllers\LicenseController;
use LitePOS\Controllers\WebhookController;
use LitePOS\Core\Security;

require __DIR__ . '/app/bootstrap.php';

$method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
$path = rawurldecode(parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/');
$path = rtrim($path, '/') ?: '/';

if (strlen($path) > 180 || str_contains($path, "\0")) {
    http_response_code(400);
    exit('Bad Request');
}

try {
    if ($method === 'GET' && $path === '/') {
        (new HomeController())->index();
    } elseif ($method === 'GET' && $path === '/checkout') {
        (new CheckoutController())->show();
    } elseif ($method === 'POST' && $path === '/checkout') {
        (new CheckoutController())->create();
    } elseif ($method === 'GET' && preg_match('#^/payment/([a-f0-9]{32})$#', $path, $matches)) {
        (new CheckoutController())->payment($matches[1]);
    } elseif ($method === 'GET' && preg_match('#^/api/orders/([a-f0-9]{32})$#', $path, $matches)) {
        (new CheckoutController())->status($matches[1]);
    } elseif ($method === 'POST' && $path === '/webhooks/midtrans') {
        (new WebhookController())->handle();
    } elseif ($method === 'POST' && $path === '/api/licenses/activate') {
        (new LicenseController())->activate();
    } elseif ($method === 'GET' && $path === '/admin/login') {
        (new AdminController())->loginForm();
    } elseif ($method === 'POST' && $path === '/admin/login') {
        (new AdminController())->login();
    } elseif ($method === 'POST' && $path === '/admin/logout') {
        (new AdminController())->logout();
    } elseif ($method === 'GET' && $path === '/admin') {
        (new AdminController())->dashboard();
    } elseif ($method === 'POST' && $path === '/admin/licenses/create') {
        (new AdminController())->createLicense();
    } elseif ($method === 'GET' && $path === '/health') {
        Security::json(['status' => 'ok']);
    } else {
        http_response_code(404);
        \LitePOS\Core\View::render('errors/404', ['title' => 'Halaman tidak ditemukan']);
    }
} catch (Throwable $error) {
    \LitePOS\Core\Logger::error('Unhandled request error', [
        'type' => get_class($error),
        'message' => $error->getMessage(),
        'path' => $path,
    ]);

    if (env('APP_DEBUG', false)) {
        throw $error;
    }

    http_response_code(500);
    \LitePOS\Core\View::render('errors/500', ['title' => 'Terjadi kendala']);
}
