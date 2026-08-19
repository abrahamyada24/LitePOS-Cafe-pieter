<?php

declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

fwrite(STDOUT, 'Masukkan kata sandi admin (minimal 12 karakter): ');
$password = trim((string) fgets(STDIN));
if (strlen($password) < 12) {
    fwrite(STDERR, 'Kata sandi terlalu pendek.' . PHP_EOL);
    exit(1);
}

echo password_hash($password, PASSWORD_DEFAULT) . PHP_EOL;
