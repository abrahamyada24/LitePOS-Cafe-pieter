<section class="hero">
    <div class="container hero-grid">
        <div class="hero-copy">
            <span class="eyebrow">Kasir modern untuk bisnis yang bertumbuh</span>
            <h1>Kelola toko lebih cepat dalam <span>satu sistem.</span></h1>
            <p>Penjualan, stok barang, laporan, pelanggan, hingga bisnis online—praktis, cepat, dan terintegrasi bersama LitePOS.</p>
            <div class="hero-actions">
                <a class="button button-accent" href="<?= e(url('/checkout?plan=online')) ?>">Mulai dengan LitePOS</a>
                <a class="button button-ghost" href="#paket">Lihat paket</a>
            </div>
            <div class="trust-row" aria-label="Keunggulan LitePOS">
                <span>✓ Uji coba 7 hari</span>
                <span>✓ Dukungan responsif</span>
                <span>✓ Pembayaran aman</span>
            </div>
        </div>
        <div class="hero-visual" aria-label="Tampilan dashboard LitePOS">
            <div class="dashboard-window">
                <div class="window-bar"><i></i><i></i><i></i><b>Dashboard LitePOS</b></div>
                <div class="dashboard-layout">
                    <aside><strong>LP</strong><span></span><span></span><span></span><span></span></aside>
                    <div class="dash-content">
                        <div class="dash-head"><div><small>Ringkasan hari ini</small><strong>Dashboard</strong></div><em>AY</em></div>
                        <div class="stat-grid"><div><small>Penjualan</small><b>Rp 2.450.000</b></div><div><small>Transaksi</small><b>128</b></div><div><small>Produk</small><b>342</b></div></div>
                        <div class="chart-card"><small>Performa penjualan</small><div class="bars"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div></div>
                    </div>
                </div>
            </div>
            <div class="phone-card">
                <span>LitePOS</span>
                <b>Rp 86.000</b>
                <i></i><i></i><i></i>
                <button type="button" tabindex="-1">Bayar</button>
            </div>
        </div>
    </div>
</section>

<section class="section" id="fitur">
    <div class="container">
        <div class="section-heading">
            <span class="eyebrow">Semua yang toko Anda butuhkan</span>
            <h2>Dari transaksi pertama sampai laporan akhir hari.</h2>
            <p>Antarmuka sederhana untuk kasir, data yang berguna untuk pemilik bisnis.</p>
        </div>
        <div class="feature-grid">
            <article class="feature-card"><span class="feature-icon">▣</span><h3>Penjualan cepat</h3><p>Proses transaksi dan pencatatan pembayaran lebih ringkas agar antrean tetap lancar.</p></article>
            <article class="feature-card"><span class="feature-icon">◇</span><h3>Stok barang</h3><p>Pantau pergerakan dan ketersediaan produk agar belanja stok lebih terencana.</p></article>
            <article class="feature-card"><span class="feature-icon">▥</span><h3>Laporan usaha</h3><p>Lihat ringkasan penjualan harian dan performa bisnis tanpa rekap manual.</p></article>
            <article class="feature-card"><span class="feature-icon">◎</span><h3>Data pelanggan</h3><p>Kelola pelanggan dan bangun layanan yang lebih personal untuk pembeli setia.</p></article>
            <article class="feature-card"><span class="feature-icon">↗</span><h3>Multi perangkat</h3><p>Paket online menyatukan data perangkat lewat cloud secara real-time.</p></article>
            <article class="feature-card"><span class="feature-icon">⌁</span><h3>Integrasi online</h3><p>Siap dikembangkan dengan website toko dan payment gateway sesuai kebutuhan.</p></article>
        </div>
    </div>
</section>

<section class="section section-blue" id="keamanan">
    <div class="container safety-grid">
        <div>
            <span class="eyebrow eyebrow-light">Aman dan terpercaya</span>
            <h2>Pembayaran diverifikasi server sebelum lisensi diterbitkan.</h2>
            <p>LitePOS tidak menerbitkan token hanya karena browser mengatakan pembayaran berhasil. Status, nomor pesanan, dan nominal diperiksa kembali ke Midtrans.</p>
            <ul class="check-list">
                <li>Kunci server Midtrans tidak pernah dikirim ke browser</li>
                <li>Notifikasi pembayaran diperiksa signature dan statusnya</li>
                <li>Formulir dilindungi CSRF, rate limit, dan validasi server</li>
                <li>Token lisensi disimpan terenkripsi di database</li>
            </ul>
        </div>
        <div class="security-card">
            <div class="shield">✓</div>
            <strong>Lisensi terbit otomatis</strong>
            <p>Bayar melalui halaman Midtrans. Setelah pembayaran tervalidasi, kode aktivasi tampil di halaman pesanan.</p>
            <div class="flow-mini"><span>Pesanan</span><i>→</i><span>Midtrans</span><i>→</i><span>Token</span></div>
        </div>
    </div>
</section>

<section class="section pricing-section" id="paket">
    <div class="container">
        <div class="section-heading">
            <span class="eyebrow">Harga sederhana</span>
            <h2>Pilih paket sesuai cara bisnis Anda bekerja.</h2>
        </div>
        <div class="pricing-grid">
            <?php foreach ($plans as $plan): ?>
                <?php $online = $plan['slug'] === 'online'; ?>
                <article class="price-card <?= $online ? 'price-featured' : '' ?>">
                    <?php if (!empty($plan['badge'])): ?><span class="price-badge"><?= e($plan['badge']) ?></span><?php endif; ?>
                    <div class="plan-icon"><?= $online ? '☁' : '◉' ?></div>
                    <h3><?= e($plan['name']) ?></h3>
                    <p><?= e($plan['description']) ?></p>
                    <div class="price"><small>Rp</small><strong><?= e(number_format((float) $plan['price'], 0, ',', '.')) ?></strong><span>/bulan<?= $online ? '' : '/device' ?></span></div>
                    <ul>
                        <?php if ($online): ?>
                            <li>Digunakan di banyak perangkat</li><li>Data cloud aman dan real-time</li><li>Semua fitur kasir lengkap</li><li>Integrasi website toko online</li><li>Integrasi payment gateway</li><li>Support prioritas</li>
                        <?php else: ?>
                            <li>Digunakan pada 1 perangkat</li><li>Data tersimpan di perangkat</li><li>Semua fitur kasir lengkap</li><li>Laporan penjualan harian</li><li>Support dan update berkala</li>
                        <?php endif; ?>
                    </ul>
                    <a class="button <?= $online ? 'button-accent' : 'button-outline' ?> button-block" href="<?= e(url('/checkout?plan=' . $plan['slug'])) ?>">Pilih <?= e($plan['name']) ?></a>
                </article>
            <?php endforeach; ?>
        </div>
    </div>
</section>

<section class="section brochure-section">
    <div class="container brochure-grid">
        <div>
            <span class="eyebrow">Kenali LitePOS</span>
            <h2>Satu aplikasi untuk operasional toko yang lebih rapi.</h2>
            <p>Mulai dari mode offline per perangkat atau naik ke mode online saat tim dan cabang Anda berkembang.</p>
            <a class="text-link" href="<?= e(url('/assets/images/brosur-litepos.png')) ?>" target="_blank" rel="noopener">Buka brosur lengkap →</a>
        </div>
        <a class="brochure-preview" href="<?= e(url('/assets/images/brosur-litepos.png')) ?>" target="_blank" rel="noopener">
            <img src="<?= e(url('/assets/images/brosur-litepos.png')) ?>" alt="Brosur paket dan fitur LitePOS" loading="lazy">
        </a>
    </div>
</section>

<section class="section faq-section" id="faq">
    <div class="container faq-grid">
        <div><span class="eyebrow">Pertanyaan umum</span><h2>Sebelum mulai memakai LitePOS.</h2></div>
        <div class="faq-list">
            <details><summary>Bagaimana lisensi dikirim setelah pembayaran?</summary><p>Halaman pesanan akan memantau status. Kode aktivasi muncul setelah server menerima dan memverifikasi pembayaran dari Midtrans.</p></details>
            <details><summary>Di mana saya menemukan ID Toko?</summary><p>ID Toko tampil pada layar aktivasi aplikasi LitePOS. Masukkan sama persis agar kode dapat digunakan.</p></details>
            <details><summary>Apakah bisa membayar tanpa membuat akun pemilik?</summary><p>Bisa. Checkout hanya meminta data pesanan dan ID Toko. Akses admin lisensi tetap terpisah dan dilindungi kata sandi.</p></details>
            <details><summary>Apakah LitePOS bisa dicoba dulu?</summary><p>Ya, aplikasi menyediakan masa uji coba gratis 7 hari sebelum lisensi berbayar diperlukan.</p></details>
        </div>
    </div>
</section>

<section class="cta-section">
    <div class="container cta-inner">
        <div><span>Mulai lebih rapi hari ini</span><h2>Saatnya kelola bisnis lebih cerdas.</h2></div>
        <a class="button button-accent" href="<?= e(url('/checkout?plan=online')) ?>">Beli lisensi LitePOS</a>
    </div>
</section>
