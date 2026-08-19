<?php

declare(strict_types=1);

namespace LitePOS\Services;

use InvalidArgumentException;

final class LegacyLicense
{
    /** @var list<int> */
    public const SUPPORTED_DAYS = [14, 30, 60, 90, 180, 360, 365, 720, 1000];

    public static function generate(string $storeId, int $days): string
    {
        $storeId = strtoupper(trim($storeId));
        if ($storeId === '' || !in_array($days, self::SUPPORTED_DAYS, true)) {
            throw new InvalidArgumentException('ID toko atau durasi lisensi tidak didukung aplikasi.');
        }

        $value = $storeId . $days . 'LITE_SECRET_2026';
        $hash = 5381;

        foreach (str_split($value) as $character) {
            $signed = self::toSignedInt32($hash);
            $shifted = self::toSignedInt32($signed << 5);
            $hash = $shifted + $hash + ord($character);
        }

        return str_pad(substr(strtoupper(dechex(abs($hash))), 0, 4), 4, '0', STR_PAD_LEFT);
    }

    private static function toSignedInt32(int $value): int
    {
        $value &= 0xFFFFFFFF;
        return $value >= 0x80000000 ? $value - 0x100000000 : $value;
    }
}
