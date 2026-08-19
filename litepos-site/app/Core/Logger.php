<?php

declare(strict_types=1);

namespace LitePOS\Core;

final class Logger
{
    /** @param array<string, mixed> $context */
    public static function error(string $message, array $context = []): void
    {
        self::write('ERROR', $message, $context);
    }

    /** @param array<string, mixed> $context */
    public static function info(string $message, array $context = []): void
    {
        self::write('INFO', $message, $context);
    }

    /** @param array<string, mixed> $context */
    private static function write(string $level, string $message, array $context): void
    {
        $directory = BASE_PATH . '/storage/logs';
        if (!is_dir($directory)) {
            @mkdir($directory, 0750, true);
        }

        foreach (['password', 'license_key', 'server_key', 'token', 'snap_token'] as $secret) {
            if (array_key_exists($secret, $context)) {
                $context[$secret] = '[REDACTED]';
            }
        }

        $payload = json_encode($context, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        $line = sprintf("[%s] %s %s %s\n", date('c'), $level, $message, $payload ?: '{}');
        @file_put_contents($directory . '/app.log', $line, FILE_APPEND | LOCK_EX);
    }
}

