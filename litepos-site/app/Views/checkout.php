<section class="page-hero compact-hero">
    <div class="container narrow">
        <span class="eyebrow">Checkout aman</span>
        <h1>Aktifkan LitePOS untuk toko Anda.</h1>
        <p>Harga dihitung oleh server. Kode aktivasi baru diterbitkan setelah pembayaran terverifikasi.</p>
    </div>
</section>
<section class="section checkout-section">
    <div class="container checkout-grid">
        <form class="form-card" method="post" action="<?= e(url('/checkout')) ?>" novalidate>
            <input type="hidden" name="_csrf" value="<?= e(\LitePOS\Core\Security::csrfToken()) ?>">
            <div class="form-heading"><span>1</span><div><h2>Data lisensi</h2><p>Gunakan ID Toko yang tampil di aplikasi LitePOS.</p></div></div>
            <?php if (!empty($error)): ?><div class="alert alert-error" role="alert"><?= e($error) ?></div><?php endif; ?>
            <fieldset class="plan-options">
                <legend>Pilih paket</legend>
                <?php foreach ($plans as $plan): ?>
                    <?php $checked = (($old['plan'] ?? $selectedPlan) === $plan['slug']); ?>
                    <label class="plan-option">
                        <input type="radio" name="plan" value="<?= e($plan['slug']) ?>" <?= $checked ? 'checked' : '' ?> required>
                        <span><b><?= e($plan['name']) ?></b><small><?= e(rupiah($plan['price'])) ?> / bulan</small></span>
                    </label>
                <?php endforeach; ?>
            </fieldset>
            <label class="field"><span>ID Toko</span><input name="store_id" value="<?= e($old['store_id'] ?? '') ?>" placeholder="Contoh: TK-1A2B3C" maxlength="64" pattern="[A-Za-z0-9_-]{3,64}" autocomplete="off" required><small>Lihat pada layar aktivasi aplikasi. Kode hanya berlaku untuk ID ini.</small></label>
            <div class="two-fields">
                <label class="field"><span>Nama pemesan</span><input name="customer_name" value="<?= e($old['customer_name'] ?? '') ?>" maxlength="100" autocomplete="name" required></label>
                <label class="field"><span>Nomor WhatsApp</span><input name="customer_phone" value="<?= e($old['customer_phone'] ?? '') ?>" maxlength="20" inputmode="tel" autocomplete="tel" placeholder="0812..." required></label>
            </div>
            <label class="field"><span>Email</span><input type="email" name="customer_email" value="<?= e($old['customer_email'] ?? '') ?>" maxlength="150" autocomplete="email" placeholder="nama@email.com" required></label>
            <button class="button button-accent button-block button-large" type="submit">Lanjut ke pembayaran</button>
            <p class="form-note">Dengan melanjutkan, Anda akan diarahkan ke pembayaran Midtrans. Jangan pernah membagikan kode aktivasi kepada orang lain.</p>
        </form>
        <aside class="order-security">
            <h2>Pembayaran terlindungi</h2>
            <ul class="check-list dark-checks">
                <li>Nominal tidak dapat diubah dari browser</li>
                <li>Server key Midtrans tersimpan di server</li>
                <li>Lisensi hanya terbit untuk transaksi valid</li>
                <li>Data sensitif tidak disimpan di localStorage</li>
            </ul>
            <div class="help-box"><strong>Butuh bantuan?</strong><p>Hubungi tim LitePOS melalui WhatsApp sebelum membayar jika ID Toko belum ditemukan.</p><a href="https://wa.me/<?= e((string) env('WHATSAPP_NUMBER', '6280000000000')) ?>" rel="noopener noreferrer">Chat support →</a></div>
        </aside>
    </div>
</section>
