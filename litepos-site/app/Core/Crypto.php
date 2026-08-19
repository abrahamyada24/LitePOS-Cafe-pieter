<?php

declare(strict_types=1);

namespace LitePOS\Core;

use RuntimeException;

final class Crypto
{
    public static function encrypt(string $plainText): string
    {
        $key = self::key();
        $iv = random_bytes(12);
        $tag = '';
        $cipher = openssl_encrypt($plainText, 'aes-256-gcm', $key, OPENSSL_RAW_DATA, $iv, $tag, '', 16);
        if ($cipher === false) {
            throw new RuntimeException('Gagal mengenkripsi lisensi.');
        }

        return base64_encode($iv . $tag . $cipher);
    }

    public static function decrypt(string $payload): string
    {
        $decoded = base64_decode($payload, true);
        if ($decoded === false || strlen($decoded) < 29) {
            throw new RuntimeException('Data lisensi terenkripsi tidak valid.');
        }

        $iv = substr($decoded, 0, 12);
        $tag = substr($decoded, 12, 16);
        $cipher = substr($decoded, 28);
        $plain = openssl_decrypt($cipher, 'aes-256-gcm', self::key(), OPENSSL_RAW_DATA, $iv, $tag);
        if ($plain === false) {
            throw new RuntimeException('Gagal membuka data lisensi.');
        }

        return $plain;
    }

    private static function key(): string
    {
        $configured = (string) env('APP_KEY', '');
        if (str_starts_with($configured, 'base64:')) {
            $configured = substr($configured, 7);
            $decoded = base64_decode($configured, true);
            if ($decoded !== false && strlen($decoded) === 32) {
                return $decoded;
            }
        }

        if ((string) env('APP_ENV', 'production') !== 'production') {
            return hash('sha256', $configured ?: 'litepos-local-only-key', true);
        }

        throw new RuntimeException('APP_KEY belum dikonfigurasi dengan benar.');
    }
}
