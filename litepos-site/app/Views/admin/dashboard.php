<div class="admin-shell">
    <aside class="admin-sidebar">
        <a class="brand admin-brand" href="<?= e(url('/admin')) ?>"><img src="<?= e(url('/assets/images/logo.png')) ?>" alt="LitePOS" width="150" height="50"></a>
        <nav><a class="active" href="<?= e(url('/admin')) ?>">Dashboard lisensi</a><a href="<?= e(url('/')) ?>" target="_blank" rel="noopener">Lihat website ↗</a></nav>
        <form method="post" action="<?= e(url('/admin/logout')) ?>"><input type="hidden" name="_csrf" value="<?= e(\LitePOS\Core\Security::csrfToken()) ?>"><button type="submit">Keluar</button></form>
    </aside>
    <div class="admin-main">
        <header class="admin-top"><div><span>LitePOS License Center</span><h1>Dashboard</h1></div><span class="admin-secure">● Sesi aman</span></header>
        <?php if (!empty($error)): ?><div class="alert alert-error" role="alert"><?= e($error) ?></div><?php endif; ?>
        <div class="admin-stats">
            <article><span>Omzet terverifikasi</span><strong><?= e(rupiah($counts['revenue'])) ?></strong></article>
            <article><span>Pesanan lunas</span><strong><?= e($counts['paid']) ?></strong></article>
            <article><span>Menunggu bayar</span><strong><?= e($counts['pending']) ?></strong></article>
            <article><span>Total lisensi</span><strong><?= e($counts['licenses']) ?></strong></article>
        </div>

        <section class="admin-panel generator-panel">
            <div class="panel-heading"><div><h2>Generator lisensi manual</h2><p>Pengganti file generator lama. Hanya durasi yang didukung aplikasi dapat dipilih.</p></div></div>
            <?php if (!empty($generated)): ?>
                <div class="generated-box">
                    <div><span>ID Toko / durasi</span><strong><?= e($generated['store_id']) ?> · <?= e($generated['duration_days']) ?> hari</strong></div>
                    <div><span>Kode aktivasi</span><div class="token-row"><code id="admin-activation-code"><?= e($generated['activation_code']) ?></code><button class="copy-button" type="button" data-copy-target="admin-activation-code">Salin</button></div></div>
                    <details><summary>Tampilkan kunci lisensi API</summary><div class="token-row token-row-long"><code id="admin-license-key"><?= e($generated['license_key']) ?></code><button class="copy-button" type="button" data-copy-target="admin-license-key">Salin</button></div></details>
                    <small>Simpan sekarang. Nilai penuh tidak ditampilkan lagi setelah halaman dimuat ulang.</small>
                </div>
            <?php endif; ?>
            <form class="generator-form" method="post" action="<?= e(url('/admin/licenses/create')) ?>">
                <input type="hidden" name="_csrf" value="<?= e(\LitePOS\Core\Security::csrfToken()) ?>">
                <label class="field"><span>ID Toko</span><input name="store_id" placeholder="TK-1A2B3C" maxlength="64" pattern="[A-Za-z0-9_-]{3,64}" required></label>
                <label class="field"><span>Durasi</span><select name="duration_days" required><?php foreach ($supportedDays as $days): ?><option value="<?= e($days) ?>"><?= e($days) ?> hari</option><?php endforeach; ?></select></label>
                <label class="field"><span>Maks. perangkat</span><input type="number" name="max_devices" value="1" min="1" max="100" required></label>
                <button class="button button-accent" type="submit">Buat lisensi</button>
            </form>
        </section>

        <section class="admin-panel">
            <div class="panel-heading"><h2>Pesanan terbaru</h2><span>30 terakhir</span></div>
            <div class="table-wrap"><table><thead><tr><th>Pesanan</th><th>Paket</th><th>ID Toko</th><th>Pemesan</th><th>Nominal</th><th>Status</th><th>Waktu</th></tr></thead><tbody>
            <?php if (!$orders): ?><tr><td colspan="7" class="empty-cell">Belum ada pesanan.</td></tr><?php endif; ?>
            <?php foreach ($orders as $order): ?><tr><td><code><?= e($order['order_id']) ?></code></td><td><?= e($order['plan_name']) ?></td><td><?= e($order['store_id']) ?></td><td><?= e($order['customer_name']) ?><small><?= e($order['customer_email']) ?></small></td><td><?= e(rupiah($order['amount'])) ?></td><td><span class="table-status status-text-<?= e($order['status']) ?>"><?= e($order['status']) ?></span></td><td><?= e($order['created_at']) ?></td></tr><?php endforeach; ?>
            </tbody></table></div>
        </section>

        <section class="admin-panel">
            <div class="panel-heading"><h2>Lisensi terbaru</h2><span>Token penuh disembunyikan</span></div>
            <div class="table-wrap"><table><thead><tr><th>Lisensi</th><th>ID Toko</th><th>Durasi</th><th>Perangkat</th><th>Status</th><th>Sumber</th><th>Dibuat</th></tr></thead><tbody>
            <?php if (!$licenses): ?><tr><td colspan="7" class="empty-cell">Belum ada lisensi.</td></tr><?php endif; ?>
            <?php foreach ($licenses as $license): ?><tr><td><code>••••<?= e($license['license_last4']) ?></code></td><td><?= e($license['store_id']) ?></td><td><?= e($license['duration_days']) ?> hari</td><td><?= e($license['max_devices']) ?></td><td><span class="table-status status-text-<?= e($license['status']) ?>"><?= e($license['status']) ?></span></td><td><?= e($license['source']) ?></td><td><?= e($license['created_at']) ?></td></tr><?php endforeach; ?>
            </tbody></table></div>
        </section>
    </div>
</div>
