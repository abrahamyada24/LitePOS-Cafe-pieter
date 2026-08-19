<?php

declare(strict_types=1);

namespace LitePOS\Services;

use LitePOS\Core\Logger;
use RuntimeException;

final class MidtransService
{
    private string $serverKey;
    private bool $production;

    public function __construct()
    {
        $this->serverKey = trim((string) env('MIDTRANS_SERVER_KEY', ''));
        $this->production = (bool) env('MIDTRANS_IS_PRODUCTION', false);
        if ($this->serverKey === '' || str_contains($this->serverKey, 'CHANGE_ME')) {
            throw new RuntimeException('Midtrans belum dikonfigurasi.');
        }
    }

    /** @param array<string,mixed> $order @return array{token:string,redirect_url:string} */
    public function createSnapTransaction(array $order): array
    {
        $payload = [
            'transaction_details' => [
                'order_id' => $order['order_id'],
                'gross_amount' => (int) $order['amount'],
            ],
            'item_details' => [[
                'id' => $order['plan_slug'],
                'price' => (int) $order['amount'],
                'quantity' => 1,
                'name' => substr('Lisensi LitePOS ' . $order['plan_name'], 0, 50),
            ]],
            'customer_details' => [
                'first_name' => $order['customer_name'],
                'email' => $order['customer_email'],
                'phone' => $order['customer_phone'],
            ],
            'callbacks' => [
                'finish' => url('/payment/' . $order['public_id']),
            ],
            'expiry' => [
                'unit' => 'hours',
                'duration' => 24,
            ],
        ];

        $url = ($this->production ? 'https://app.midtrans.com' : 'https://app.sandbox.midtrans.com')
            . '/snap/v1/transactions';
        $response = $this->request('POST', $url, $payload);

        if (empty($response['token']) || empty($response['redirect_url'])) {
            throw new RuntimeException('Midtrans tidak mengembalikan token pembayaran.');
        }

        return [
            'token' => (string) $response['token'],
            'redirect_url' => (string) $response['redirect_url'],
        ];
    }

    /** @return array<string,mixed> */
    public function verifyNotification(array $notification): array
    {
        foreach (['order_id', 'status_code', 'gross_amount', 'signature_key'] as $field) {
            if (!isset($notification[$field]) || !is_string($notification[$field])) {
                throw new RuntimeException('Payload notifikasi Midtrans tidak lengkap.');
            }
        }

        $expected = hash('sha512',
            $notification['order_id']
            . $notification['status_code']
            . $notification['gross_amount']
            . $this->serverKey
        );
        if (!hash_equals($expected, $notification['signature_key'])) {
            throw new RuntimeException('Signature notifikasi Midtrans tidak valid.');
        }

        $status = $this->getStatus($notification['order_id']);
        if (!hash_equals((string) ($status['order_id'] ?? ''), $notification['order_id'])) {
            throw new RuntimeException('Order ID hasil verifikasi Midtrans tidak cocok.');
        }

        return $status;
    }

    /** @return array<string,mixed> */
    public function getStatus(string $orderId): array
    {
        if (!preg_match('/^[A-Za-z0-9._~-]{1,50}$/', $orderId)) {
            throw new RuntimeException('Order ID tidak valid.');
        }

        $host = $this->production ? 'https://api.midtrans.com' : 'https://api.sandbox.midtrans.com';
        return $this->request('GET', $host . '/v2/' . rawurlencode($orderId) . '/status', null, 8);
    }

    public function snapScriptUrl(): string
    {
        return ($this->production ? 'https://app.midtrans.com' : 'https://app.sandbox.midtrans.com') . '/snap/snap.js';
    }

    /** @param array<string,mixed>|null $payload @return array<string,mixed> */
    private function request(string $method, string $url, ?array $payload = null, int $timeout = 20): array
    {
        $handle = curl_init($url);
        if ($handle === false) {
            throw new RuntimeException('Tidak dapat membuka koneksi ke Midtrans.');
        }

        $headers = [
            'Accept: application/json',
            'Content-Type: application/json',
            'Authorization: Basic ' . base64_encode($this->serverKey . ':'),
        ];
        $options = [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_CUSTOMREQUEST => $method,
            CURLOPT_HTTPHEADER => $headers,
            CURLOPT_CONNECTTIMEOUT => min(5, $timeout),
            CURLOPT_TIMEOUT => $timeout,
            CURLOPT_SSL_VERIFYPEER => true,
            CURLOPT_SSL_VERIFYHOST => 2,
        ];
        if ($payload !== null) {
            $options[CURLOPT_POSTFIELDS] = json_encode($payload, JSON_THROW_ON_ERROR);
        }
        curl_setopt_array($handle, $options);

        $raw = curl_exec($handle);
        $statusCode = (int) curl_getinfo($handle, CURLINFO_HTTP_CODE);
        $curlError = curl_error($handle);
        curl_close($handle);

        if ($raw === false || $curlError !== '') {
            throw new RuntimeException('Koneksi ke Midtrans gagal.');
        }

        $decoded = json_decode($raw, true);
        if (!is_array($decoded)) {
            throw new RuntimeException('Respons Midtrans tidak valid.');
        }
        if ($statusCode < 200 || $statusCode >= 300) {
            Logger::error('Midtrans API rejected request', [
                'http_status' => $statusCode,
                'status_code' => $decoded['status_code'] ?? null,
                'status_message' => $decoded['status_message'] ?? null,
            ]);
            throw new RuntimeException('Midtrans menolak permintaan pembayaran. Periksa konfigurasi merchant.');
        }

        return $decoded;
    }
}
