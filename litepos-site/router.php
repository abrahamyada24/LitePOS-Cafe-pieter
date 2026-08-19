<?php

declare(strict_types=1);

$path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
$decodedPath = rawurldecode($path);
if (str_contains($decodedPath, '..')
    || preg_match('#^/(?:app|bin|database|storage|tests)(?:/|$)#i', $decodedPath)
    || preg_match('#/(?:\.(?!well-known(?:/|$))|[^/]+\.(?:env|ini|log|sql|sqlite|bak|dist|md)$)#i', $decodedPath)) {
    http_response_code(404);
    echo 'Not Found';
    return true;
}

$file = __DIR__ . $decodedPath;

if ($path !== '/' && is_file($file)) {
    return false;
}

require __DIR__ . '/index.php';
