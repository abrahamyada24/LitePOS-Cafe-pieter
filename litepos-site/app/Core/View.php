<?php

declare(strict_types=1);

namespace LitePOS\Core;

use RuntimeException;

final class View
{
    /** @param array<string, mixed> $data */
    public static function render(string $template, array $data = [], string $layout = 'layout'): void
    {
        $viewFile = BASE_PATH . '/app/Views/' . $template . '.php';
        $layoutFile = BASE_PATH . '/app/Views/' . $layout . '.php';
        if (!is_file($viewFile) || !is_file($layoutFile)) {
            throw new RuntimeException('Template tidak ditemukan.');
        }

        extract($data, EXTR_SKIP);
        ob_start();
        require $viewFile;
        $content = (string) ob_get_clean();
        require $layoutFile;
    }
}

