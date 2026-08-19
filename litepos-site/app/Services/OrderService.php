<?php

declare(strict_types=1);

namespace LitePOS\Services;

use LitePOS\Core\Database;
use LitePOS\Core\Security;
use RuntimeException;

final class OrderService
{
    /** @param array<string,string> $input @return array<string,mixed> */
    public function create(array $input): array
    {
        $plan = (new PlanService())->find(trim($input['plan'] ?? ''));
        if ($plan === null) {
            throw new RuntimeException('Paket tidak tersedia.');
        }

        $storeId = Security::sanitizeStoreId($input['store_id'] ?? '');
        $name = trim($input['customer_name'] ?? '');
        $email = strtolower(trim($input['customer_email'] ?? ''));
        $phone = preg_replace('/[^0-9+]/', '', $input['customer_phone'] ?? '') ?: '';
        if (strlen($storeId) < 3 || strlen($storeId) > 64) {
            throw new RuntimeException('ID toko harus 3–64 karakter.');
        }
        if (strlen($name) < 2 || strlen($name) > 100) {
            throw new RuntimeException('Nama pemesan tidak valid.');
        }
        if (!filter_var($email, FILTER_VALIDATE_EMAIL) || strlen($email) > 150) {
            throw new RuntimeException('Alamat email tidak valid.');
        }
        if (strlen($phone) < 9 || strlen($phone) > 20) {
            throw new RuntimeException('Nomor WhatsApp tidak valid.');
        }

        $publicId = bin2hex(random_bytes(16));
        $orderId = 'LTP-' . date('Ymd') . '-' . strtoupper(bin2hex(random_bytes(6)));
        $amount = (int) $plan['price'];
        $pdo = Database::connection();
        $insert = $pdo->prepare(
            'INSERT INTO license_orders
             (public_id, order_id, plan_id, plan_slug, plan_name, duration_days, max_devices, store_id,
              customer_name, customer_email, customer_phone, amount, status, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, \'pending\', NOW(), NOW())'
        );
        $insert->execute([
            $publicId,
            $orderId,
            $plan['id'],
            $plan['slug'],
            $plan['name'],
            $plan['duration_days'],
            $plan['max_devices'],
            $storeId,
            $name,
            $email,
            $phone,
            $amount,
        ]);

        $order = $this->findByPublicId($publicId);
        if ($order === null) {
            throw new RuntimeException('Pesanan gagal disimpan.');
        }

        try {
            $snap = (new MidtransService())->createSnapTransaction($order);
            $update = $pdo->prepare('UPDATE license_orders SET snap_token = ?, redirect_url = ?, updated_at = NOW() WHERE id = ?');
            $update->execute([$snap['token'], $snap['redirect_url'], $order['id']]);
            $order['snap_token'] = $snap['token'];
            $order['redirect_url'] = $snap['redirect_url'];
            return $order;
        } catch (\Throwable $error) {
            $update = $pdo->prepare("UPDATE license_orders SET status = 'failed', updated_at = NOW() WHERE id = ?");
            $update->execute([$order['id']]);
            throw $error;
        }
    }

    /** @return array<string,mixed>|null */
    public function findByPublicId(string $publicId): ?array
    {
        $stmt = Database::connection()->prepare('SELECT * FROM license_orders WHERE public_id = ? LIMIT 1');
        $stmt->execute([$publicId]);
        $order = $stmt->fetch();
        return is_array($order) ? $order : null;
    }
}
