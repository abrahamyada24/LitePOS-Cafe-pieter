# LitePOS Profile & License Center

Website profil LitePOS, checkout Midtrans, penerbitan lisensi otomatis, dan generator lisensi manual berbasis PHP 8.1+ serta MySQL/MariaDB. Paket ini dibuat tanpa Node.js, queue worker, atau Composer sehingga dapat berjalan di shared hosting/cPanel biasa.

## Fitur

- Landing page LitePOS berdasarkan materi brosur.
- Paket Offline Rp25.000/bulan/perangkat dan Online Rp150.000/bulan.
- Checkout Snap Midtrans dengan harga yang selalu diambil dari database.
- Webhook diverifikasi dengan signature **dan** pengecekan status langsung ke API Midtrans.
- Nominal dan order ID dicocokkan sebelum status dibayar.
- Lisensi dibuat idempotent: satu pembayaran hanya menghasilkan satu lisensi.
- Halaman pembayaran memantau status dan menampilkan kode setelah pembayaran valid.
- Dashboard admin dengan generator manual pengganti `generator.html` lama.
- CSRF, rate limit berbasis database, prepared statements, session cookie aman, CSP, dan enkripsi token AES-256-GCM.

## Kebutuhan hosting

- PHP 8.1 atau lebih baru.
- Ekstensi `curl`, `openssl`, dan `pdo_mysql`.
- MySQL 8 atau MariaDB 10.4+.
- HTTPS aktif. SSL gratis dari hosting atau Cloudflare sudah cukup.
- Apache dengan `.htaccess`/`mod_rewrite`. Untuk Nginx, aturan rewrite perlu disesuaikan oleh penyedia hosting.

Tidak membutuhkan VPS, daemon, cron, atau akses SSH setelah konfigurasi selesai.

## Instalasi di shared hosting/cPanel

1. Buat database dan user MySQL dari cPanel. Berikan hak akses hanya pada database LitePOS.
2. Impor `database/schema.sql` lewat phpMyAdmin.
3. Upload seluruh isi folder ini ke document root domain/subdomain, misalnya `public_html`.
4. Salin `.env.example` menjadi `.env` dan isi konfigurasi database, domain, Midtrans, admin, serta kontak.
5. Buat `APP_KEY` di komputer lokal:

   ```bash
   php bin/generate-app-key.php
   ```

6. Buat hash kata sandi admin yang panjang dan unik:

   ```bash
   php bin/hash-password.php
   ```

7. Masukkan hasilnya ke `APP_KEY` dan `ADMIN_PASSWORD_HASH` di `.env`. Jangan isi kata sandi biasa ke `.env`.
8. Pastikan folder `storage/logs` dapat ditulis PHP (umumnya permission `755`; gunakan `775` hanya bila hosting memerlukannya).
9. Buka `/health`; respons yang benar adalah `{"status":"ok"}`.
10. Buka `/admin/login` dan uji generator dengan ID Toko dari aplikasi.

Jika file `.env` dibuat lewat File Manager, pastikan tidak dapat diunduh dari browser. `.htaccess` bawaan sudah memblokirnya, tetapi pengujian tetap wajib dilakukan setelah upload.

## Konfigurasi Midtrans

Gunakan key Sandbox lebih dulu:

```dotenv
MIDTRANS_IS_PRODUCTION=false
MIDTRANS_SERVER_KEY=SB-Mid-server-...
MIDTRANS_CLIENT_KEY=SB-Mid-client-...
```

Di dashboard Midtrans, atur Payment Notification URL menjadi:

```text
https://domain-anda.com/webhooks/midtrans
```

Lakukan transaksi Sandbox sampai kode aktivasi muncul. Setelah akun merchant production aktif, ganti dengan production Server Key dan Client Key lalu ubah `MIDTRANS_IS_PRODUCTION=true`.

Server Key hanya berada di `.env`. Client Key memang boleh dipakai oleh Snap di browser.

## Alur pembayaran

1. Pelanggan memilih paket dan memasukkan ID Toko.
2. Server mengambil harga/durasi dari database dan membuat order `pending`.
3. Server meminta Snap token menggunakan Server Key.
4. Pelanggan membayar di Snap Midtrans.
5. Midtrans mengirim webhook.
6. Server memeriksa signature, mengambil status resmi dari Midtrans, serta mencocokkan order ID dan nominal.
7. Hanya status `settlement`, atau `capture` dengan fraud status `accept`, yang mengubah order menjadi `paid` dan menerbitkan lisensi.
8. Halaman pembayaran menampilkan kode aktivasi.

Callback JavaScript Snap tidak pernah dijadikan bukti pembayaran.

## Mengubah harga

Ubah harga melalui phpMyAdmin pada tabel `license_plans`. Jangan menaruh harga dari input browser. Kolom `duration_days` untuk aplikasi saat ini harus salah satu dari: `14, 30, 60, 90, 180, 360, 365, 720, 1000`.

## Pengujian lokal

Salin `.env.example` menjadi `.env`, isi database test, lalu jalankan:

```bash
php tests/run.php
php -S 127.0.0.1:8097 router.php
```

Website dapat dibuka di `http://127.0.0.1:8097`.

## Struktur utama

- `app/Controllers`: endpoint web, API, admin, dan webhook.
- `app/Services`: Midtrans, order, dan penerbitan lisensi.
- `app/Core`: database, keamanan, enkripsi, view, dan rate limit.
- `app/Views`: tampilan website.
- `assets`: CSS, JavaScript, logo, dan brosur.
- `database/schema.sql`: skema dan seed paket.
- `SECURITY.md`: hardening dan keterbatasan keamanan lisensi lama.
