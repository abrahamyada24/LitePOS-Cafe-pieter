<?php

declare(strict_types=1);

namespace LitePOS\Controllers;

use LitePOS\Core\Database;
use LitePOS\Core\Logger;
use LitePOS\Core\Security;
use LitePOS\Services\LicenseService;
use LitePOS\Services\MidtransService;
use RuntimeException;

final class WebhookController
{
    public function handle(): void
    {
        $length = (int) ($_SERVER['CONTENT_LENGTH'] ?? 0);
        if ($length > 65536) {
            Security::json(['message' => 'Payload terlalu besar.'], 413);
        }

        $raw = file_get_contents('php://input', false, null, 0, 65537);
        $notification = json_decode((string) $raw, true);
        if (!is_array($notification)) {
            Security::json(['message' => 'JSON tidak valid.'], 400);
        }

        try {
            $verified = (new MidtransService())->verifyNotification($notification);
            $this->process($verified);
            Security::json(['status' => 'ok']);
        } catch (RuntimeException $error) {
            Logger::error('Midtrans webhook rejected', [
                'message' => $error->getMessage(),
                'order_id' => $notification['order_id'] ?? null,
            ]);
            Security::json(['message' => 'Notifikasi ditolak.'], 400);
        }
    }

    /** @param array<string,mixed> $status */
    private function process(array $status): void
    {
        $orderId = (string) ($status['order_id'] ?? '');
        $pdo = Database::connection();
        $pdo->beginTransaction();
        try {
            $stmt = $pdo->prepare('SELECT * FROM license_orders WHERE order_id = ? FOR UPDATE');
            $stmt->execute([$orderId]);
            $order = $stmt->fetch();
            if (!is_array($order)) {
                throw new RuntimeException('Pesanan tidak dikenal.');
            }

            $grossAmount = (float) ($status['gross_amount'] ?? -1);
            if (abs($grossAmount - (float) $order['amount']) > 0.001) {
                throw new RuntimeException('Nominal pembayaran tidak cocok.');
            }

            $eventKey = hash('sha256', implode('|', [
                $orderId,
                (string) ($status['transaction_id'] ?? ''),
                (string) ($status['transaction_status'] ?? ''),
                (string) ($status['fraud_status'] ?? ''),
                (string) ($status['status_code'] ?? ''),
            ]));
            $event = $pdo->prepare(
                'INSERT IGNORE INTO webhook_events (provider, event_key, order_id, payload_json, processed_at, created_at)
                 VALUES (\'midtrans\', ?, ?, ?, NOW(), NOW())'
            );
            $event->execute([
                $eventKey,
                $orderId,
                json_encode([
                    'transaction_id' => $status['transaction_id'] ?? null,
                    'transaction_status' => $status['transaction_status'] ?? null,
                    'fraud_status' => $status['fraud_status'] ?? null,
                    'payment_type' => $status['payment_type'] ?? null,
                    'gross_amount' => $status['gross_amount'] ?? null,
                ], JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR),
            ]);

            $mapped = $this->mapStatus($status);
            if ($order['status'] === 'paid' && !in_array($mapped, ['paid', 'refunded'], true)) {
                $mapped = 'paid';
            }
            $paidAt = $mapped === 'paid' ? ($order['paid_at'] ?: date('Y-m-d H:i:s')) : $order['paid_at'];
            $update = $pdo->prepare(
                'UPDATE license_orders SET status = ?, midtrans_transaction_id = ?, payment_type = ?,
                 midtrans_status = ?, paid_at = ?, updated_at = NOW() WHERE id = ?'
            );
            $update->execute([
                $mapped,
                $status['transaction_id'] ?? null,
                $status['payment_type'] ?? null,
                $status['transaction_status'] ?? null,
                $paidAt,
                $order['id'],
            ]);

            if ($mapped === 'paid') {
                (new LicenseService())->issueForOrder($order, $pdo);
            } elseif ($mapped === 'refunded') {
                $revoke = $pdo->prepare("UPDATE licenses SET status = 'revoked', updated_at = NOW() WHERE order_id = ?");
                $revoke->execute([$order['id']]);
            }

            $pdo->commit();
        } catch (\Throwable $error) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            throw $error;
        }
    }

    /** @param array<string,mixed> $status */
    private function mapStatus(array $status): string
    {
        $transaction = strtolower((string) ($status['transaction_status'] ?? ''));
        $fraud = strtolower((string) ($status['fraud_status'] ?? 'accept'));
        if ($transaction === 'settlement' || ($transaction === 'capture' && $fraud === 'accept')) {
            return 'paid';
        }
        if (in_array($transaction, ['pending', 'authorize'], true) || ($transaction === 'capture' && $fraud === 'challenge')) {
            return 'pending';
        }
        if ($transaction === 'expire') {
            return 'expired';
        }
        if (in_array($transaction, ['cancel', 'deny'], true)) {
            return 'cancelled';
        }
        if (in_array($transaction, ['refund', 'chargeback'], true)) {
            return 'refunded';
        }

        return 'failed';
    }
}
