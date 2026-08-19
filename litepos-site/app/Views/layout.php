<?php
$pageTitle = isset($title) ? (string) $title : 'LitePOS';
$pageDescription = isset($description) ? (string) $description : 'Aplikasi kasir modern untuk UMKM.';
$isAdmin = str_starts_with(parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/', '/admin');
?>
<!doctype html>
<html lang="id">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="description" content="<?= e($pageDescription) ?>">
    <meta name="theme-color" content="#0757d9">
    <title><?= e($pageTitle) ?></title>
    <link rel="icon" href="<?= e(url('/assets/images/icon.png')) ?>" type="image/png">
    <link rel="stylesheet" href="<?= e(url('/assets/css/site.css')) ?>">
</head>
<body class="<?= $isAdmin ? 'admin-body' : '' ?>">
<?php if (!$isAdmin): ?>
    <header class="site-header">
        <div class="container header-inner">
            <a class="brand" href="<?= e(url('/')) ?>" aria-label="LitePOS beranda">
                <img src="<?= e(url('/assets/images/logo.png')) ?>" alt="LitePOS" width="162" height="54">
            </a>
            <button class="nav-toggle" type="button" aria-controls="main-nav" aria-expanded="false">Menu</button>
            <nav class="main-nav" id="main-nav" aria-label="Navigasi utama">
                <a href="<?= e(url('/#fitur')) ?>">Fitur</a>
                <a href="<?= e(url('/#paket')) ?>">Harga</a>
                <a href="<?= e(url('/#keamanan')) ?>">Keamanan</a>
                <a href="<?= e(url('/#faq')) ?>">FAQ</a>
                <a class="button button-small" href="<?= e(url('/checkout')) ?>">Beli Lisensi</a>
            </nav>
        </div>
    </header>
<?php endif; ?>

<main><?= $content ?></main>

<?php if (!$isAdmin): ?>
    <footer class="site-footer">
        <div class="container footer-grid">
            <div>
                <a class="brand footer-brand" href="<?= e(url('/')) ?>"><img src="<?= e(url('/assets/images/logo.png')) ?>" alt="LitePOS" width="150" height="50"></a>
                <p>Aplikasi kasir modern untuk membantu UMKM bekerja lebih cepat, rapi, dan terukur.</p>
            </div>
            <div>
                <h2>Produk</h2>
                <a href="<?= e(url('/#fitur')) ?>">Fitur</a>
                <a href="<?= e(url('/#paket')) ?>">Paket</a>
                <a href="<?= e(url('/checkout')) ?>">Beli lisensi</a>
            </div>
            <div>
                <h2>Bantuan</h2>
                <a href="mailto:<?= e((string) env('SUPPORT_EMAIL', 'support@example.com')) ?>"><?= e((string) env('SUPPORT_EMAIL', 'support@example.com')) ?></a>
                <a href="https://wa.me/<?= e((string) env('WHATSAPP_NUMBER', '6280000000000')) ?>" rel="noopener noreferrer">WhatsApp support</a>
            </div>
        </div>
        <div class="container footer-bottom">© <?= date('Y') ?> LitePOS. Transaksi pembayaran diproses melalui Midtrans.</div>
    </footer>
<?php endif; ?>

<?php if (isset($snapScriptUrl, $midtransClientKey)): ?>
    <script src="<?= e((string) $snapScriptUrl) ?>" data-client-key="<?= e((string) $midtransClientKey) ?>"></script>
<?php endif; ?>
<script src="<?= e(url('/assets/js/site.js')) ?>" defer></script>
<?php foreach (($scripts ?? []) as $script): ?>
    <script src="<?= e(url((string) $script)) ?>" defer></script>
<?php endforeach; ?>
</body>
</html>
