# Generator lisensi lokal

Gunakan `generator.html` di folder ini untuk membuat kode aktivasi melalui Chrome atau Edge. File tersebut berjalan lokal dan tidak membutuhkan akses ke terminal VPS.

Pilihan masa aktif:

- 1 bulan
- 3 bulan
- 6 bulan
- 1 tahun

`generator.html` dan `.license-generator-private.jwk` sengaja tidak masuk Git karena berisi kunci privat. Jangan mengunggah atau mengirim kedua file tersebut. Yang boleh diberikan kepada pelanggan hanya kode aktivasi hasil generator.

Jika `generator.html` terhapus tetapi kunci privat masih tersedia, jalankan dari folder `pos-android`:

```bash
node tools/buildLicenseGenerator.js
```

Jangan membuat pasangan kunci baru tanpa memperbarui kunci publik pada backend production. Kode dari kunci yang tidak cocok akan ditolak.
