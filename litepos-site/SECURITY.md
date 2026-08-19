# Keamanan LitePOS Site

## Yang sudah diterapkan

- Harga, paket, dan durasi dibaca dari database di server.
- Webhook Midtrans diperiksa dengan SHA-512 signature lalu diverifikasi kembali melalui endpoint status Midtrans.
- Order ID dan nominal harus sama sebelum lisensi diterbitkan.
- Penerbitan lisensi idempotent melalui unique key pada `licenses.order_id`.
- Server Key tidak pernah disisipkan pada HTML/JavaScript.
- Semua query aplikasi menggunakan PDO prepared statements.
- Form sensitif memakai CSRF token; login, checkout, status, aktivasi, dan generator memakai rate limit database.
- Session admin memakai `HttpOnly`, `SameSite=Lax`, Secure saat HTTPS, strict mode, pergantian session ID, idle timeout 30 menit, dan binding user-agent.
- Token lisensi disimpan terenkripsi AES-256-GCM; dashboard hanya menampilkan empat karakter terakhir.
- Header CSP, HSTS (HTTPS), anti-framing, nosniff, referrer policy, dan permissions policy dikirim aplikasi.
- `.htaccess` memblokir directory listing, `.env`, SQL, log, source internal, dan request body besar.
- Error detail tidak tampil di production dan log meredaksi key umum.

## Keterbatasan penting aplikasi lama

Aplikasi Android yang sekarang masih menerima kode aktivasi deterministik **4 karakter** dan menyimpan rahasia pembentuk kode di dalam aplikasi. Format itu bukan kontrol lisensi yang kuat secara kriptografis: ruang kodenya kecil, kode yang sama dapat dipakai kembali untuk kombinasi ID Toko/durasi yang sama, dan algoritmanya dapat dipelajari dari APK.

Website ini tetap menghasilkan kode 4 karakter tersebut agar kompatibel tanpa mengubah tiga aplikasi yang sedang diperiksa. Di saat yang sama, setiap lisensi juga memiliki `license_key` acak 128-bit dan endpoint `/api/licenses/activate` untuk migrasi aplikasi berikutnya.

Tahap hardening berikutnya adalah mengubah aplikasi Android agar:

1. mengirim `license_key`, ID Toko, dan ID perangkat melalui HTTPS ke `/api/licenses/activate`;
2. tidak memiliki secret pembentuk lisensi di APK;
3. menyimpan bukti aktivasi bertanda tangan dari server;
4. memeriksa status/revocation secara periodik untuk mode online;
5. memastikan row konfigurasi lisensi dibuat dengan `INSERT ... ON CONFLICT/REPLACE`, bukan update yang dapat tidak memengaruhi baris.

Tanpa perubahan aplikasi tersebut, keamanan website dan pembayaran dapat kuat, tetapi kode lokal lama tidak dapat dibuat anti-pembajakan sepenuhnya.

## Checklist sebelum production

- Gunakan PHP versi yang masih mendapat security update dari hosting.
- `APP_ENV=production` dan `APP_DEBUG=false`.
- Gunakan database password unik dan batasi user hanya ke satu database.
- Gunakan admin password minimal 16 karakter yang tidak dipakai di tempat lain.
- Aktifkan HTTPS dan paksa redirect HTTP ke HTTPS dari cPanel/Cloudflare.
- Pastikan membuka `/.env`, `/database/schema.sql`, `/storage/logs/app.log`, dan `/app/bootstrap.php` menghasilkan 403/404.
- Jangan menyimpan backup `.zip`, `.sql`, atau `.env` di dalam `public_html`.
- Aktifkan backup database harian dan uji proses restore.
- Pantau `storage/logs/app.log`, transaksi gagal, dan lonjakan rate limit.
- Di Cloudflare Free, aktifkan proxy, Always Use HTTPS, Bot Fight Mode, dan rule rate limiting bila tersedia. Set `TRUST_CLOUDFLARE=true` hanya ketika domain benar-benar diproxy Cloudflare.
- Jangan menonaktifkan verifikasi TLS cURL.
- Rotasi Server Key Midtrans dan `APP_KEY` jika diduga bocor. Rotasi `APP_KEY` memerlukan proses re-enkripsi token lama; jangan menggantinya sembarangan.

## Bila website diserang

1. Aktifkan mode Under Attack/Managed Challenge di Cloudflare bila trafik mencurigakan membanjiri situs.
2. Ubah password cPanel, database, email admin, dan admin LitePOS.
3. Rotasi key Midtrans dari dashboard dan perbarui `.env`.
4. Bandingkan file website dengan salinan rilis bersih; jangan hanya menghapus file yang terlihat mencurigakan.
5. Periksa akun FTP, cron job, forwarder email, database admin, serta file baru/berubah.
6. Pulihkan dari backup bersih jika ada webshell atau perubahan file yang tidak dikenal.
7. Simpan log untuk analisis; jangan memasukkan payload webhook penuh atau secret ke laporan publik.
