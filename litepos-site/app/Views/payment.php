<?php
$terminal = in_array($order['status'], ['paid', 'failed', 'expired', 'cancelled', 'refunded'], true);
$isPaid = $order['status'] === 'paid';
$isUnsuccessful = in_array($order['status'], ['failed', 'expired', 'cancelled', 'refunded'], true);
?>
<section class="section payment-section">
    <div class="container narrow">
        <div class="payment-card" id="payment-app"
             data-order-public-id="<?= e($order['public_id']) ?>"
             data-order-status="<?= e($order['status']) ?>"
             data-snap-token="<?= e((string) ($order['snap_token'] ?? '')) ?>"
             data-status-url="<?= e(url('/api/orders/' . $order['public_id'])) ?>">
            <div class="status-icon status-<?= e($order['status']) ?>" id="status-icon"><?= $isPaid ? '✓' : ($isUnsuccessful ? '×' : '…') ?></div>
            <span class="eyebrow">Pesanan <?= e($order['order_id']) ?></span>
            <h1 id="payment-title"><?= $isPaid ? 'Pembayaran berhasil' : ($isUnsuccessful ? 'Pembayaran tidak selesai' : 'Selesaikan pembayaran Anda') ?></h1>
            <p id="payment-message"><?= $isPaid ? 'Lisensi sudah diterbitkan dan siap digunakan.' : ($isUnsuccessful ? 'Transaksi gagal, dibatalkan, dikembalikan, atau kedaluwarsa. Silakan buat pesanan baru.' : 'Pilih metode pembayaran pada jendela Midtrans. Halaman ini akan memperbarui status secara otomatis.') ?></p>

            <div class="order-summary">
                <div><span>Paket</span><strong><?= e($order['plan_name']) ?></strong></div>
                <div><span>ID Toko</span><strong><?= e($order['store_id']) ?></strong></div>
                <div><span>Total</span><strong><?= e(rupiah($order['amount'])) ?></strong></div>
                <div><span>Status</span><strong class="status-label status-text-<?= e($order['status']) ?>" id="status-label"><?= e(strtoupper($order['status'])) ?></strong></div>
            </div>

            <div class="license-result <?= $license ? '' : 'is-hidden' ?>" id="license-result">
                <span>Kode aktivasi aplikasi saat ini</span>
                <div class="token-row"><code id="activation-code"><?= e($license['activation_code'] ?? '') ?></code><button class="copy-button" type="button" data-copy-target="activation-code">Salin</button></div>
                <small>Masukkan kode 4 karakter ini pada layar aktivasi dengan ID Toko yang sama.</small>
                <details>
                    <summary>Kunci lisensi API (untuk versi aplikasi baru)</summary>
                    <div class="token-row token-row-long"><code id="license-key"><?= e($license['license_key'] ?? '') ?></code><button class="copy-button" type="button" data-copy-target="license-key">Salin</button></div>
                </details>
            </div>

            <?php if (!$terminal && !empty($order['snap_token'])): ?>
                <button class="button button-accent button-large button-block" type="button" id="pay-button">Bayar sekarang</button>
            <?php endif; ?>
            <a class="text-link payment-home" href="<?= e(url('/')) ?>">← Kembali ke beranda</a>
        </div>
    </div>
</section>
