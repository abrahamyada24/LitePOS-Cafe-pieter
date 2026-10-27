# Tahap 1 — nota, invoice, WhatsApp, history dan navigasi

## Cakupan

- Sidebar mengikuti route aktif, termasuk URL berakhiran `/`; submenu inventori terbuka saat route inventori diakses.
- Checkout Android menyimpan header, item, perubahan stok/poin, counter invoice dan snapshot nota dalam satu transaksi SQLite. Snapshot digunakan kembali untuk cetak ulang.
- Nota dapat dicetak ketika offline setelah penyimpanan lokal berhasil. Status sinkronisasi ditampilkan terpisah; data yang belum diterima server tetap diantrekan.
- Checkout web menggunakan kunci idempotensi persisten dan menyediakan pemulihan checkout yang responsnya terputus. Retry menggunakan transaksi yang sama. Order meja yang sudah terhubung ke pembayaran tidak dibuatkan pembayaran kedua melalui checkout web.
- Invoice baru: `INV/YYYYMMDD/K01/0001` untuk Android dan `INV/YYYYMMDD/W01/0001` untuk web. Urutan harian memakai tanggal Asia/Jakarta. Invoice historis tidak diganti.
- Android mendapatkan kode perangkat dari backend pada penggunaan pertama. Jika penggunaan pertama berlangsung offline/server belum tersedia, aplikasi memakai kode cadangan unik yang tetap; nomor urutnya tetap harian. Setelah kode tersimpan, kode tidak diganti saat reconnect. Urutan per perangkat bukan satu urutan global seluruh outlet.
- Share nota menyediakan pilihan kontak pelanggan dari aplikasi dan input nomor manual. Tidak menambah kontak pada buku telepon perangkat. Android mencoba membagikan gambar/caption ke WhatsApp; tersedia juga pembukaan chat dengan nota teks. Web menyediakan chat tujuan dengan nota teks dan share/unduh gambar secara terpisah. Pembukaan aplikasi share tidak dianggap bukti pesan sudah terkirim.
- Pagination pada laporan shift web, pengelolaan shift web dan laporan shift Android. Filter periode diterapkan sebelum pagination. Ekspor laporan shift/transaksi web mengambil semua halaman hasil filter.
- History transaksi lama Android dapat diambil dari server berdasarkan periode. Sinkronisasi rutin tetap memakai rentang pendek agar ringan.

## Urutan pemasangan

1. Review dan commit kode lokal.
2. Backup database VPS.
3. Update kode backend VPS, pasang migrasi tahap 1, generate Prisma Client, lalu restart API.
4. Deploy frontend ke hosting yang digunakan. Situs `litepos-cafe-pieter.pages.dev` memakai Cloudflare Pages, sehingga deployment frontend diperiksa di Cloudflare, terpisah dari VPS.
5. Build dan pasang Android sendiri setelah backend siap. APK lama tidak otomatis diperbarui oleh push Git.

Paket GitHub tahap 1 mencakup perbaikan nota, invoice, share WhatsApp, history dan sidebar. Perubahan Firebase/notifikasi yang telah ada sebelum tahap 1 dipisahkan dan tetap lokal. Migrasi produksi dan update VPS dilakukan oleh pengguna; build Android juga diserahkan kepada pengguna.

## Git lokal — PowerShell

Remote saat diperiksa: `origin` menunjuk `abrahamyada24/LitePOS-Cafe-pieter`, branch lokal `main`. Kedua repo audit hanya referensi. Pastikan remote masih benar sebelum push:

```powershell
cd D:\AndroidPos-web
git status --short
git branch --show-current
git remote -v
git diff --stat
```

Folder ini sudah memiliki perubahan sebelum tahap 1, termasuk Firebase/notifikasi dan dukungan native WhatsApp. Jangan menjalankan `git add .` tanpa review. Untuk file yang sudah diubah sebelumnya (`schema.prisma`, `ReceiptPreviewScreen.tsx`), gunakan staging interaktif jika ingin memisahkan commit. Native WhatsApp yang sudah disiapkan lokal juga harus ikut bila belum ada di repo tujuan.

Daftar file tahap 1:

```powershell
$stage1Files = @(
  'PANDUAN_TAHAP_1.md',
  '.gitignore',
  'pos-be/prisma/schema.prisma',
  'pos-be/prisma/migrations/202610270001_checkout_invoice/migration.sql',
  'pos-be/src/controllers/transactionController.js',
  'pos-be/src/controllers/syncController.js',
  'pos-be/src/controllers/reportController.js',
  'pos-be/src/controllers/shiftController.js',
  'pos-be/src/routes/transactionRoutes.js',
  'pos-be/src/services/invoiceService.js',
  'pos-be/src/services/invoiceService.test.js',
  'pos-be/src/services/reportPaginationService.js',
  'pos-be/src/services/reportPaginationService.test.js',
  'pos-fe/src/components/Sidebar.jsx',
  'pos-fe/src/components/ReportPagination.jsx',
  'pos-fe/src/components/WhatsAppReceiptDialog.jsx',
  'pos-fe/src/components/TransactionDetailModal.jsx',
  'pos-fe/src/components/pos/ReceiptPreviewModal.jsx',
  'pos-fe/src/utils/checkoutRequest.js',
  'pos-fe/src/utils/reportPages.js',
  'pos-fe/src/app/(pos)/pos/page.js',
  'pos-fe/src/app/(admin)/reports/page.js',
  'pos-fe/src/app/(admin)/shifts/page.js',
  'pos-android/src/database/db.ts',
  'pos-android/src/services/checkoutStorage.ts',
  'pos-android/src/utils/receiptSnapshot.ts',
  'pos-android/__tests__/receiptSnapshot.test.ts',
  'pos-android/src/services/syncService.ts',
  'pos-android/src/screens/CheckoutScreen.tsx',
  'pos-android/src/screens/ReceiptPreviewScreen.tsx',
  'pos-android/src/screens/ReportScreen.tsx',
  'tests/checkoutController.test.cjs',
  'tests/checkoutStorage.test.cjs',
  'tests/checkoutRequest.test.cjs',
  'tests/syncService.test.cjs',
  'tests/stage1-browser.cjs'
)
$mixedFiles = @(
  'pos-be/prisma/schema.prisma',
  'pos-android/src/screens/ReceiptPreviewScreen.tsx'
)
$newStage1Files = $stage1Files | Where-Object { $_ -notin $mixedFiles }
git add -- $newStage1Files
git add -p -- $mixedFiles
```

Pada `schema.prisma`, pilih model counter/terminal dan kolom checkout/gateway tahap 1. Model Firebase/PushDevice yang sudah berubah sebelumnya dapat dipisahkan bila tidak sedang diterbitkan. Pada `ReceiptPreviewScreen.tsx`, perubahan share WhatsApp yang sudah disiapkan sebelumnya merupakan ketergantungan tahap 1: review bersama pemilih kontak/status nota, jangan meninggalkan referensi modul atau helper yang diperlukan.

Dukungan native share yang telah ada pada perubahan lokal sebelum tahap ini:

```powershell
git add -- pos-android/android/app/src/main/java/com/posandroid/WhatsAppReceiptShareModule.kt pos-android/android/app/src/main/java/com/posandroid/WhatsAppReceiptSharePackage.kt pos-android/android/app/src/main/res/xml/receipt_share_paths.xml
git add -p -- pos-android/android/app/src/main/AndroidManifest.xml pos-android/android/app/src/main/java/com/posandroid/MainApplication.kt
```

Pilih bagian deklarasi package WhatsApp, registrasi `WhatsAppReceiptSharePackage`, `FileProvider`, dan queries WhatsApp. Perubahan Firebase yang lain boleh dijadikan commit terpisah setelah ditinjau. Jangan ikutkan `.env`, private key, service account, database dump, atau APK.

Setelah daftar staged benar:

```powershell
git diff --cached --stat
git diff --cached --check
git diff --cached
git commit -m "fix: reliable receipts invoices sharing and paginated history"
git push origin main
```

## Backend VPS — SSH/Linux

Dokumentasi proyek memakai `/var/www/litepos/pos-be`, MySQL dan PM2 bernama `litepos-api`. Sesuaikan direktori/nama database bila instalasi nyata berbeda. Ini perintah di VPS, bukan di PowerShell lokal.

Backup menggunakan akun database yang mempunyai hak backup. Ganti `NAMA_DATABASE` dan user sesuai instalasi:

```bash
mysqldump -u root -p --single-transaction NAMA_DATABASE > ~/litepos-before-stage1-$(date +%Y%m%d-%H%M%S).sql
cd /var/www/litepos
git status --short
git remote -v
git pull --ff-only origin main
cd pos-be
npm ci
```

Pastikan backup berhasil sebelum melanjutkan. Jika `git pull --ff-only` gagal karena perubahan lokal/divergensi, periksa dahulu; jangan melakukan reset paksa.

Migrasi tahap 1 menambah tabel `invoice_terminals`, `invoice_counters`, dan kolom nullable `checkout_key`, `checkout_fingerprint`, `gateway_token`, `gateway_url`. Tidak menghapus atau menomori ulang transaksi historis.

Schema lama proyek memakai `prisma db push` dan riwayat migrasinya belum tentu dibaseline. Jangan langsung menjalankan seluruh `prisma migrate deploy` pada database lama. Untuk instalasi tersebut, periksa kolom dan terapkan **hanya SQL tahap 1 sekali** menggunakan akun admin database:

```bash
mysql -u root -p NAMA_DATABASE -e "SHOW TABLES LIKE 'invoice_terminals'; SHOW COLUMNS FROM transactions LIKE 'checkout_key';"
# Jika tabel/kolom tahap 1 belum ada:
mysql -u root -p NAMA_DATABASE < prisma/migrations/202610270001_checkout_invoice/migration.sql
```

Jika tabel/kolom sudah ada atau instalasi mempunyai migrasi parsial, jangan menjalankan ulang SQL secara membabi buta. Cocokkan schema dengan SQL terlebih dahulu. SQL ini tidak memakai `IF NOT EXISTS` pada penambahan kolom agar pemasangan parsial tidak dianggap berhasil diam-diam. Pada database dengan riwayat Prisma yang sudah rapi, gunakan proses migrasi terkelola milik instalasi tersebut; jangan mencampur dua metode.

Setelah schema siap:

```bash
npm run build
pm2 reload ecosystem.config.cjs --update-env
pm2 status
curl --fail http://127.0.0.1:5000/api/health
pm2 logs litepos-api --lines 80 --nostream
```

Ganti port health bila `PORT` instalasi berbeda. Runtime database tetap tidak memerlukan hak DDL setelah migrasi selesai. Jangan menjalankan seed/reset, `migrate reset`, atau `db push --accept-data-loss` untuk update ini.

## Frontend Cloudflare Pages dan Android

- Situs produksi yang ditunjukkan pengguna adalah `https://litepos-cafe-pieter.pages.dev`. Buka Cloudflare Dashboard → Workers & Pages → proyek `litepos-cafe-pieter` → Deployments. Pastikan deployment Production memakai commit tahap 1 `3a44a3e` atau commit sesudahnya yang memuat tahap 1, dan build/deploy berhasil. Pada pemeriksaan 27 Oktober 2026, JavaScript publik halaman shift masih belum memuat pagination tahap 1.
- Jika proyek memakai integrasi Git, pastikan repository `abrahamyada24/LitePOS-Cafe-pieter`, production branch `main`, root directory `pos-fe`, build command `npm run build`, dan build output directory `out`. Jalankan deployment produksi terbaru setelah pengaturan benar. Jika deployment gagal, periksa build log. Jika memakai Direct Upload, build `pos-fe` lalu unggah isi hasil `pos-fe/out` ke proyek Pages yang sama; push Git saja tidak mengunggah hasil build untuk proyek Direct Upload.
- Setelah deployment produksi berhasil, refresh dengan Ctrl+Shift+R dan periksa `/shifts/` menampilkan kontrol halaman serta `/categories/` menandai submenu Kategori. Screenshot halaman Pengaturan yang masih menyorot Produk & Stok juga menunjukkan perilaku sidebar lama. Panduan awal menyebut Vercel berdasarkan dokumen lama; untuk alamat `pages.dev` gunakan Cloudflare. Update VPS tidak mengganti file frontend Cloudflare.
- Screenshot dashboard Cloudflare mengonfirmasi peringatan "This project is disconnected from your Git account" dan deployment produksi masih `c2d2acc`. Periksa GitHub → Settings → Applications → Installed GitHub Apps → Cloudflare Workers and Pages → Configure, lalu pastikan akses repo ini tersedia. Di Cloudflare, buka Settings → Builds → Git Repository → Manage untuk mengelola koneksi. Jika tetap terputus, ikuti prosedur reinstall GitHub App pada dokumentasi resmi Cloudflare; reinstall memengaruhi integrasi proyek lain yang memakai instalasi yang sama. Pertahankan proyek Pages dan domain yang sudah digunakan. Setelah terhubung, buat deployment dari HEAD `main` terbaru, bukan mengulang commit produksi lama.
- Pertahankan `NEXT_PUBLIC_API_URL` menuju backend outlet yang benar. Tidak perlu mengganti domain, branding atau konfigurasi lisensi untuk tahap 1.
- Setelah backend siap, pengguna membangun Android memakai prosedur/signing key yang biasa dipakai. Instal sebagai update aplikasi dengan package dan signing key yang sama. Jangan uninstall atau hapus data aplikasi sebelum seluruh transaksi offline tersinkron dan database lokal dicadangkan.
- Perubahan native share memerlukan build APK baru; reload JavaScript saja tidak menambahkan modul native ke APK lama.

### Instalasi dependency Android dan ERESOLVE

`react-native-ping@1.2.8`, yang diperlukan printer, mendeklarasikan peer React Native hingga 0.70 sedangkan proyek memakai 0.84.1. Pengaturan `pos-android/.npmrc` memakai `legacy-peer-deps=true` agar `npm ci` mengikuti dependency tree yang digunakan proyek. Ini mengatasi resolusi instalasi; kompatibilitas printer tetap diuji pada perangkat. Jangan menurunkan React Native hanya untuk mengikuti peer range tersebut.

`patch-package@8.0.1` dinyatakan sebagai devDependency karena postinstall harus menerapkan patch SQLite dan printer secara konsisten. Tidak perlu menghapus lockfile atau memperbarui npm global untuk error ini.

Pemeriksaan instalasi bersih dari package/lockfile versi GitHub dengan perbaikan ini berhasil: `npm ci` memasang 1109 paket dan postinstall menerapkan kedua patch SQLite/printer tanpa error. Uji dilakukan di folder terpisah, tanpa Gradle atau build APK. Referensi: https://docs.npmjs.com/cli/v11/commands/npm-ci/ dan https://developers.cloudflare.com/pages/configuration/git-integration/github-integration/.

Git Bash Windows:

```bash
cd /d/AndroidPos-web/pos-android
npm ci --legacy-peer-deps
cd android
./gradlew.bat assembleRelease
```

PowerShell Windows:

```powershell
cd D:\AndroidPos-web\pos-android
npm ci --legacy-peer-deps
cd android
.\gradlew.bat assembleRelease
```

Jalankan Gradle setelah instalasi dependency berhasil. APK berada di `pos-android/android/app/build/outputs/apk/release/app-release.apk`. Pertahankan signing key sesuai aplikasi yang terpasang. Build APK tetap dijalankan pengguna. Folder kerja lokal masih memiliki pengembangan Firebase terpisah; build dari folder itu juga menyertakan perubahan lokal tersebut.

### Error C++ Camera Kit saat build Android

Jika build gagal pada `NativeCameraKitSpecJSI-generated.cpp` dengan `unknown type name 'NativeCameraKitModuleCxxSpecJSI'`, penyebabnya adalah output codegen lama yang ikut terkemas di `react-native-camera-kit@17.0.1`. Header baru dari RN 0.84 memakai nama kelas berbeda. Masalah yang sama dijelaskan upstream: https://github.com/teslamotors/react-native-camera-kit/pull/789.

Postinstall proyek menjalankan `scripts/clean-camera-kit-codegen.cjs` sebelum patch-package. Script hanya membersihkan folder build hasil generate Camera Kit versi 17.0.1 di node_modules, dengan pemeriksaan path; source kamera dan data aplikasi tidak disentuh. Gradle akan membuat ulang output memakai versi React Native proyek. Untuk instalasi yang sudah terlanjur gagal, jalankan dari `pos-android` di Git Bash:

```bash
node scripts/clean-camera-kit-codegen.cjs
cd android
./gradlew.bat generateCodegenArtifactsFromSchema --rerun-tasks
./gradlew.bat assembleRelease
```

Tidak perlu downgrade React Native, menonaktifkan New Architecture, atau mengubah VPS untuk masalah ini. Jangan menjalankan Gradle clean sebelum codegen dipulihkan karena referensi CMake dapat menunjuk folder codegen yang baru dibersihkan.

## Pemeriksaan setelah pemasangan

1. Buka `/stock/`, refresh, pindah Transaksi, lalu back: highlight dan submenu harus mengikuti route.
2. Periksa history shift pada periode dengan lebih dari 20 shift. Buka halaman terakhir dan ekspor; jumlah ekspor harus mencakup seluruh hasil filter.
3. Buat transaksi uji, cocokkan invoice di nota dan history. Retry request yang sama harus menghasilkan invoice yang sama.
4. Android offline: simpan/cetak nota, periksa history lokal, kemudian reconnect dan pastikan status menjadi tersinkron serta invoice di web sama. Kegagalan satu item harus membatalkan seluruh penyimpanan checkout lokal.
5. Pilih pelanggan dari aplikasi yang nomornya belum tersimpan di kontak device. Periksa gambar/caption dan nomor tujuan di WhatsApp sebelum menekan Kirim. Uji WhatsApp biasa dan Business pada perangkat yang digunakan.
6. Periksa transaksi lama masih terbaca dan dapat dicetak ulang. Jangan merekonstruksi transaksi yang hilang hanya dari foto tanpa memeriksa database perangkat/server terlebih dahulu.

## Mengulang pemeriksaan pengembangan

```powershell
cd D:\AndroidPos-web
node --test tests/*.test.cjs pos-be/src/services/*.test.js pos-be/src/utils/*.test.js
cd pos-android
node node_modules/typescript/bin/tsc --noEmit
npm test -- --runInBand
cd ../pos-fe
npm run build
```

Tes browser menggunakan static export, Edge headless, dan API fixture di memori: `node tests/stage1-browser.cjs` dari root. Set `PLAYWRIGHT_MODULE` ke modul Playwright lokal bila lokasi runtime berbeda. Tidak memakai database atau API outlet nyata. Gambar hasil pemeriksaan disimpan di `artifacts/stage1`.

Tes Node yang memakai `node:sqlite` diperiksa menggunakan Node.js 24.15.0. Lokasi Playwright bawaan dalam script adalah fallback perangkat pengembangan, bukan dependency runtime aplikasi produksi.

## Hasil pemeriksaan lokal, 27 Oktober 2026

- 46 tes Node lulus: backend, retry checkout, rollback SQLite, penomoran, pagination, partial sync dan history lintas halaman.
- 11 tes Android pada 4 suite lulus; TypeScript `--noEmit` lulus.
- Schema Prisma valid dan Prisma Client berhasil dibuat. Tidak ada migrasi yang diterapkan pada database outlet.
- Build static export frontend lulus untuk 26 halaman.
- Browser memakai fixture lokal: highlight route dan navigasi back, pagination transaksi dan kedua halaman shift, ekspor seluruh hasil filter, pemuatan detail nota, pemilihan nomor WhatsApp, tampilan mobile, serta pemulihan checkout dengan kunci/body yang sama.
- Pengiriman WhatsApp/printer pada perangkat fisik, transaksi Midtrans nyata, serta migrasi pada MySQL produksi belum diuji. Build APK diserahkan kepada pengguna sesuai permintaan; percobaan build lokal sebelumnya dihentikan.
- Update VPS dan migrasi produksi belum dijalankan. Transaksi lama yang dilaporkan tidak terlihat belum direkonstruksi; cocokkan invoice dengan database perangkat dan server sebelum koreksi data.

Tahap 2 yang disarankan: akurasi HPP/retur, penyamaan rekap pembayaran dan hak akses. Tahap 3: modifier dan resep bahan baku opsional. Keduanya tidak otomatis dikerjakan dalam tahap 1.

## Catatan publikasi tahap 1

Remote tujuan: `https://github.com/abrahamyada24/LitePOS-Cafe-pieter`, branch `main`. Rilis ini menyertakan dukungan native WhatsApp, tetapi tidak menyertakan perubahan Firebase yang belum diterbitkan, konfigurasi `google-services.json`, service account, `.env`, APK, cache build atau screenshot fixture. Berkas schema, AndroidManifest dan MainApplication pada paket commit hanya memuat perubahan tahap 1 yang diperlukan; salinan kerja lokal tetap mempertahankan pengembangan Firebase sebelumnya. Karena itu `git status` lokal masih dapat menampilkan perubahan setelah push berhasil. Jangan membuang perubahan lokal tersebut dengan reset/clean.
