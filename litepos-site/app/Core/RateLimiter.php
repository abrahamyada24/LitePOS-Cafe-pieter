<?php

declare(strict_types=1);

namespace LitePOS\Core;

use PDOException;

final class RateLimiter
{
    public static function hit(string $action, int $limit, int $seconds): bool
    {
        $key = hash('sha256', $action . '|' . Security::clientIp());
        $now = time();
        $window = $now - ($now % $seconds);

        try {
            $pdo = Database::connection();
            $stmt = $pdo->prepare(
                'INSERT INTO rate_limits (`key`, window_start, hits, expires_at)
                 VALUES (?, FROM_UNIXTIME(?), 1, FROM_UNIXTIME(?))
                 ON DUPLICATE KEY UPDATE
                    hits = IF(window_start = VALUES(window_start), hits + 1, 1),
                    window_start = VALUES(window_start),
                    expires_at = VALUES(expires_at)'
            );
            $stmt->execute([$key, $window, $window + $seconds + 60]);

            $check = $pdo->prepare('SELECT hits FROM rate_limits WHERE `key` = ? AND window_start = FROM_UNIXTIME(?)');
            $check->execute([$key, $window]);
            $hits = (int) $check->fetchColumn();

            if (random_int(1, 100) === 1) {
                $pdo->exec('DELETE FROM rate_limits WHERE expires_at < NOW()');
            }

            return $hits <= $limit;
        } catch (PDOException $error) {
            Logger::error('Rate limiter unavailable', ['action' => $action, 'message' => $error->getMessage()]);
            return false;
        }
    }
}
