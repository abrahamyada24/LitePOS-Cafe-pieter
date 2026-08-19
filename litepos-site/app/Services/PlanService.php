<?php

declare(strict_types=1);

namespace LitePOS\Services;

use LitePOS\Core\Database;
use LitePOS\Core\Logger;
use Throwable;

final class PlanService
{
    /** @return list<array<string,mixed>> */
    public function active(): array
    {
        try {
            $stmt = Database::connection()->query(
                'SELECT id, slug, name, description, duration_days, price, max_devices, badge
                 FROM license_plans WHERE is_active = 1 ORDER BY sort_order, id'
            );
            $plans = $stmt->fetchAll();
            return $plans ?: $this->fallback();
        } catch (Throwable $error) {
            Logger::error('Plans database unavailable', ['message' => $error->getMessage()]);
            return $this->fallback();
        }
    }

    /** @return array<string,mixed>|null */
    public function find(string $slug): ?array
    {
        $stmt = Database::connection()->prepare(
            'SELECT id, slug, name, description, duration_days, price, max_devices, badge
             FROM license_plans WHERE slug = ? AND is_active = 1 LIMIT 1'
        );
        $stmt->execute([$slug]);
        $plan = $stmt->fetch();
        return is_array($plan) ? $plan : null;
    }

    /** @return list<array<string,mixed>> */
    private function fallback(): array
    {
        return [
            [
                'id' => 0,
                'slug' => 'offline',
                'name' => 'Offline',
                'description' => 'Kasir lengkap untuk satu perangkat dan data tersimpan lokal.',
                'duration_days' => 30,
                'price' => 25000,
                'max_devices' => 1,
                'badge' => null,
            ],
            [
                'id' => 0,
                'slug' => 'online',
                'name' => 'Online',
                'description' => 'Cloud real-time untuk banyak perangkat dan integrasi bisnis online.',
                'duration_days' => 30,
                'price' => 150000,
                'max_devices' => 10,
                'badge' => 'Rekomendasi',
            ],
        ];
    }
}
