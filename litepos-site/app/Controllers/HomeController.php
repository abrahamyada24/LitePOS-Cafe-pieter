<?php

declare(strict_types=1);

namespace LitePOS\Controllers;

use LitePOS\Core\View;
use LitePOS\Services\PlanService;

final class HomeController
{
    public function index(): void
    {
        View::render('home', [
            'title' => 'LitePOS — Aplikasi Kasir Modern untuk UMKM',
            'description' => 'Kelola penjualan, stok, laporan, pelanggan, dan bisnis online dalam satu sistem LitePOS.',
            'plans' => (new PlanService())->active(),
        ]);
    }
}
