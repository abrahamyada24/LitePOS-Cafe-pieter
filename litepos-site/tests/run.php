<?php

declare(strict_types=1);

putenv('APP_ENV=local');
putenv('APP_KEY=base64:' . base64_encode(str_repeat('k', 32)));
putenv('APP_URL=http://127.0.0.1:8097');

require dirname(__DIR__) . '/app/bootstrap.php';

use LitePOS\Core\Crypto;
use LitePOS\Core\Security;
use LitePOS\Services\LegacyLicense;

$tests = [];
$test = static function (string $name, callable $callback) use (&$tests): void {
    try {
        $callback();
        $tests[] = ['name' => $name, 'ok' => true];
    } catch (Throwable $error) {
        $tests[] = ['name' => $name, 'ok' => false, 'message' => $error->getMessage()];
    }
};
$assertSame = static function (mixed $expected, mixed $actual): void {
    if ($expected !== $actual) {
        throw new RuntimeException('Expected ' . var_export($expected, true) . ', got ' . var_export($actual, true));
    }
};

$test('Legacy token kompatibel TK-1A2B3C 30 hari', static function () use ($assertSame): void {
    $assertSame('5561', LegacyLicense::generate('TK-1A2B3C', 30));
});
$test('Legacy token kompatibel ABC123 365 hari', static function () use ($assertSame): void {
    $assertSame('1BA4', LegacyLicense::generate('ABC123', 365));
});
$test('Enkripsi lisensi dapat dibuka kembali', static function () use ($assertSame): void {
    $plain = 'LTP-12345678-ABCDEF12-1234ABCD-5678EF90';
    $encrypted = Crypto::encrypt($plain);
    if ($encrypted === $plain) {
        throw new RuntimeException('Ciphertext sama dengan plaintext.');
    }
    $assertSame($plain, Crypto::decrypt($encrypted));
});
$test('Normalisasi ID toko menolak simbol', static function () use ($assertSame): void {
    $assertSame('TK-ABC_123', Security::sanitizeStoreId(' tk-abc_123!@# '));
});

$failed = 0;
foreach ($tests as $result) {
    echo ($result['ok'] ? '[OK] ' : '[FAIL] ') . $result['name'];
    if (!$result['ok']) {
        $failed++;
        echo ': ' . $result['message'];
    }
    echo PHP_EOL;
}

exit($failed === 0 ? 0 : 1);
