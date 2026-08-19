<?php

declare(strict_types=1);

namespace LitePOS\Controllers;

use LitePOS\Core\RateLimiter;
use LitePOS\Core\Security;
use LitePOS\Core\View;
use LitePOS\Services\LicenseService;
use LitePOS\Services\OrderService;
use LitePOS\Services\PlanService;
use RuntimeException;

final class CheckoutController
{
    public function show(): void
    {
        $selected = trim((string) ($_GET['plan'] ?? 'online'));
        View::render('checkout', [
            'title' => 'Pilih Lisensi LitePOS',
            'plans' => (new PlanService())->active(),
            'selectedPlan' => $selected,
            'error' => $_SESSION['checkout_error'] ?? null,
            'old' => $_SESSION['checkout_old'] ?? [],
        ]);
        unset($_SESSION['checkout_error'], $_SESSION['checkout_old']);
    }

    public function create(): void
    {
        Security::requireCsrf();
        if (!RateLimiter::hit('checkout', 5, 300)) {
            http_response_code(429);
            View::render('errors/429', ['title' => 'Terlalu banyak percobaan']);
            return;
        }

        $fields = ['plan', 'store_id', 'customer_name', 'customer_email', 'customer_phone'];
        $input = [];
        foreach ($fields as $field) {
            $value = $_POST[$field] ?? '';
            $input[$field] = is_string($value) ? trim($value) : '';
        }

        try {
            $order = (new OrderService())->create($input);
            Security::redirect('/payment/' . $order['public_id']);
        } catch (RuntimeException $error) {
            $_SESSION['checkout_error'] = $error->getMessage();
            $_SESSION['checkout_old'] = $input;
            Security::redirect('/checkout?plan=' . rawurlencode($input['plan'] ?: 'online'));
        }
    }

    public function payment(string $publicId): void
    {
        header('Cache-Control: no-store, private');
        $order = (new OrderService())->findByPublicId($publicId);
        if ($order === null) {
            http_response_code(404);
            View::render('errors/404', ['title' => 'Pesanan tidak ditemukan']);
            return;
        }

        $license = $order['status'] === 'paid'
            ? (new LicenseService())->findForPublicOrder($publicId)
            : null;
        $production = (bool) env('MIDTRANS_IS_PRODUCTION', false);

        View::render('payment', [
            'title' => 'Pembayaran Lisensi LitePOS',
            'order' => $order,
            'license' => $license,
            'snapScriptUrl' => ($production ? 'https://app.midtrans.com' : 'https://app.sandbox.midtrans.com') . '/snap/snap.js',
            'midtransClientKey' => (string) env('MIDTRANS_CLIENT_KEY', ''),
            'scripts' => ['/assets/js/payment.js'],
        ]);
    }

    public function status(string $publicId): void
    {
        if (!RateLimiter::hit('order-status', 120, 300)) {
            Security::json(['message' => 'Terlalu banyak permintaan.'], 429);
        }

        $order = (new OrderService())->findByPublicId($publicId);
        if ($order === null) {
            Security::json(['message' => 'Pesanan tidak ditemukan.'], 404);
        }

        $payload = [
            'order_id' => $order['order_id'],
            'status' => $order['status'],
            'paid_at' => $order['paid_at'],
        ];
        if ($order['status'] === 'paid') {
            $license = (new LicenseService())->findForPublicOrder($publicId);
            if ($license !== null) {
                $payload['license'] = [
                    'activation_code' => $license['activation_code'],
                    'license_key' => $license['license_key'],
                    'store_id' => $license['store_id'],
                    'duration_days' => (int) $license['duration_days'],
                    'activation_expires_at' => $license['activation_expires_at'],
                ];
            }
        }

        Security::json($payload);
    }
}
