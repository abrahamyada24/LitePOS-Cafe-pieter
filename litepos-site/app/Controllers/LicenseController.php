<?php

declare(strict_types=1);

namespace LitePOS\Controllers;

use LitePOS\Core\RateLimiter;
use LitePOS\Core\Security;
use LitePOS\Services\LicenseService;
use RuntimeException;

final class LicenseController
{
    public function activate(): void
    {
        if (!RateLimiter::hit('license-activate', 10, 300)) {
            Security::json(['message' => 'Terlalu banyak percobaan aktivasi.'], 429);
        }
        if ((int) ($_SERVER['CONTENT_LENGTH'] ?? 0) > 16384) {
            Security::json(['message' => 'Payload terlalu besar.'], 413);
        }

        $input = json_decode((string) file_get_contents('php://input'), true);
        if (!is_array($input)) {
            Security::json(['message' => 'JSON tidak valid.'], 400);
        }

        $key = is_string($input['license_key'] ?? null) ? $input['license_key'] : '';
        $storeId = Security::sanitizeStoreId(is_string($input['store_id'] ?? null) ? $input['store_id'] : '');
        $deviceId = is_string($input['device_id'] ?? null) ? trim($input['device_id']) : '';
        if ($key === '' || $storeId === '' || strlen($deviceId) < 8 || strlen($deviceId) > 128) {
            Security::json(['message' => 'Data aktivasi tidak lengkap.'], 422);
        }

        try {
            $license = (new LicenseService())->activate($key, $storeId, $deviceId);
            Security::json(['status' => 'success', 'license' => $license]);
        } catch (RuntimeException $error) {
            Security::json(['status' => 'error', 'message' => $error->getMessage()], 422);
        }
    }
}
