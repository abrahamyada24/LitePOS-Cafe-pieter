<?php

declare(strict_types=1);

namespace LitePOS\Services;

use LitePOS\Core\Crypto;
use LitePOS\Core\Database;
use PDO;
use RuntimeException;

final class LicenseService
{
    /** @param array<string,mixed> $order @return array<string,mixed> */
    public function issueForOrder(array $order, ?PDO $pdo = null): array
    {
        $pdo ??= Database::connection();
        $existing = $pdo->prepare('SELECT * FROM licenses WHERE order_id = ? LIMIT 1');
        $existing->execute([(int) $order['id']]);
        $license = $existing->fetch();
        if (is_array($license)) {
            return $license;
        }

        return $this->insertLicense(
            $pdo,
            (string) $order['store_id'],
            (int) $order['duration_days'],
            (int) $order['max_devices'],
            (int) $order['id'],
            'payment'
        );
    }

    /** @return array<string,mixed> */
    public function issueManual(string $storeId, int $days, int $maxDevices = 1): array
    {
        $storeId = strtoupper(trim($storeId));
        if ($storeId === '' || strlen($storeId) > 64) {
            throw new RuntimeException('ID toko tidak valid.');
        }

        return $this->insertLicense(Database::connection(), $storeId, $days, max(1, min(100, $maxDevices)), null, 'admin');
    }

    /** @return array<string,mixed>|null */
    public function findForPublicOrder(string $publicOrderId): ?array
    {
        $stmt = Database::connection()->prepare(
            'SELECT l.* FROM licenses l
             INNER JOIN license_orders o ON o.id = l.order_id
             WHERE o.public_id = ? LIMIT 1'
        );
        $stmt->execute([$publicOrderId]);
        $license = $stmt->fetch();
        return is_array($license) ? $this->withSecrets($license) : null;
    }

    /** @return array<string,mixed> */
    public function activate(string $key, string $storeId, string $deviceId): array
    {
        $hash = hash('sha256', strtoupper(trim($key)));
        $pdo = Database::connection();
        $pdo->beginTransaction();
        try {
            $stmt = $pdo->prepare('SELECT * FROM licenses WHERE license_key_hash = ? FOR UPDATE');
            $stmt->execute([$hash]);
            $license = $stmt->fetch();
            if (!is_array($license) || !hash_equals((string) $license['store_id'], strtoupper(trim($storeId)))) {
                throw new RuntimeException('Lisensi tidak valid untuk toko ini.');
            }
            if (in_array($license['status'], ['revoked', 'expired'], true)) {
                throw new RuntimeException('Lisensi sudah tidak berlaku.');
            }
            if ($license['status'] === 'issued'
                && !empty($license['activation_expires_at'])
                && new \DateTimeImmutable((string) $license['activation_expires_at']) < new \DateTimeImmutable('now')) {
                throw new RuntimeException('Masa aktivasi lisensi sudah berakhir. Hubungi support.');
            }
            if ($license['status'] === 'active'
                && !empty($license['expires_at'])
                && new \DateTimeImmutable((string) $license['expires_at']) < new \DateTimeImmutable('now')) {
                throw new RuntimeException('Masa aktif lisensi sudah berakhir.');
            }

            $device = $pdo->prepare('SELECT id, revoked_at FROM license_devices WHERE license_id = ? AND device_id = ? LIMIT 1');
            $device->execute([$license['id'], $deviceId]);
            $deviceRow = $device->fetch();
            if (is_array($deviceRow) && $deviceRow['revoked_at'] !== null) {
                throw new RuntimeException('Perangkat ini telah dicabut dari lisensi.');
            }
            $deviceExists = is_array($deviceRow);
            $count = $pdo->prepare('SELECT COUNT(*) FROM license_devices WHERE license_id = ? AND revoked_at IS NULL');
            $count->execute([$license['id']]);
            $activeDevices = (int) $count->fetchColumn();
            if (!$deviceExists && $activeDevices >= (int) $license['max_devices']) {
                throw new RuntimeException('Batas perangkat untuk lisensi ini sudah tercapai.');
            }

            if (!$deviceExists) {
                $insertDevice = $pdo->prepare(
                    'INSERT INTO license_devices (license_id, device_id, first_seen_at, last_seen_at, created_at, updated_at)
                     VALUES (?, ?, NOW(), NOW(), NOW(), NOW())'
                );
                $insertDevice->execute([$license['id'], $deviceId]);
                $activeDevices++;
            } else {
                $touchDevice = $pdo->prepare(
                    'UPDATE license_devices SET last_seen_at = NOW(), updated_at = NOW() WHERE license_id = ? AND device_id = ?'
                );
                $touchDevice->execute([$license['id'], $deviceId]);
            }

            $start = empty($license['starts_at'])
                ? new \DateTimeImmutable('now')
                : new \DateTimeImmutable((string) $license['starts_at']);
            $expires = empty($license['expires_at'])
                ? $start->modify('+' . (int) $license['duration_days'] . ' days')
                : new \DateTimeImmutable((string) $license['expires_at']);
            $update = $pdo->prepare(
                "UPDATE licenses SET status = 'active', redeemed_at = COALESCE(redeemed_at, NOW()),
                 starts_at = COALESCE(starts_at, ?), expires_at = ?, updated_at = NOW() WHERE id = ?"
            );
            $update->execute([$start->format('Y-m-d H:i:s'), $expires->format('Y-m-d H:i:s'), $license['id']]);
            $pdo->commit();

            return [
                'store_id' => $license['store_id'],
                'status' => 'active',
                'expires_at' => $expires->format(DATE_ATOM),
                'max_devices' => (int) $license['max_devices'],
                'active_devices' => $activeDevices,
            ];
        } catch (\Throwable $error) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            throw $error;
        }
    }

    /** @return array<string,mixed> */
    public function withSecrets(array $license): array
    {
        $license['license_key'] = Crypto::decrypt((string) $license['license_key_encrypted']);
        $license['activation_code'] = Crypto::decrypt((string) $license['activation_code_encrypted']);
        return $license;
    }

    /** @return array<string,mixed> */
    private function insertLicense(PDO $pdo, string $storeId, int $days, int $maxDevices, ?int $orderId, string $source): array
    {
        if (!in_array($days, LegacyLicense::SUPPORTED_DAYS, true)) {
            throw new RuntimeException('Durasi belum didukung aplikasi LitePOS saat ini.');
        }

        $key = 'LTP-' . implode('-', str_split(strtoupper(bin2hex(random_bytes(16))), 8));
        $legacyCode = LegacyLicense::generate($storeId, $days);
        $publicId = bin2hex(random_bytes(16));
        $stmt = $pdo->prepare(
            'INSERT INTO licenses
             (public_id, order_id, store_id, license_key_hash, license_key_encrypted, license_last4,
              activation_code_hash, activation_code_encrypted, duration_days, max_devices, status, source,
              activation_expires_at, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, \'issued\', ?, DATE_ADD(NOW(), INTERVAL 7 DAY), NOW(), NOW())'
        );
        $stmt->execute([
            $publicId,
            $orderId,
            $storeId,
            hash('sha256', $key),
            Crypto::encrypt($key),
            substr($key, -4),
            hash('sha256', $legacyCode),
            Crypto::encrypt($legacyCode),
            $days,
            $maxDevices,
            $source,
        ]);

        $find = $pdo->prepare('SELECT * FROM licenses WHERE id = ?');
        $find->execute([(int) $pdo->lastInsertId()]);
        $license = $find->fetch();
        if (!is_array($license)) {
            throw new RuntimeException('Lisensi gagal dibuat.');
        }

        return $this->withSecrets($license);
    }
}
