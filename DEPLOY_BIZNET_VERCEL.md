# Deploy LitePOS: Biznet NEO Lite + Vercel

Arsitektur produksi yang disarankan:

- `https://nama-project.vercel.app`: frontend Next.js dengan domain bawaan Vercel.
- `https://IP_PUBLIC_VPS`: Nginx pada VPS menuju Express di `127.0.0.1:5000`.
- MySQL hanya mendengarkan secara lokal pada VPS.
- Android menggunakan URL backend `https://IP_PUBLIC_VPS`.
- Upload gambar disimpan permanen di `/var/lib/litepos/uploads`.

Backend tetap wajib memakai HTTPS. Frontend Vercel berjalan melalui HTTPS dan browser akan memblokir request langsung ke backend HTTP. Sejak 2026, Let's Encrypt dapat menerbitkan sertifikat langsung untuk IPv4/IPv6, jadi domain backend tidak wajib. Sertifikat IP berlaku sekitar enam hari dan harus diperbarui otomatis.

## 1. Siapkan IP dan Security Group

Pastikan IP publik VPS tetap dan catat nilainya. Tidak diperlukan DNS record untuk mode sertifikat IP.

Pada Security Group Biznet dan UFW, buka hanya:

- `22/tcp` untuk SSH, sebaiknya dibatasi ke IP admin.
- `80/tcp` untuk validasi SSL dan redirect HTTP.
- `443/tcp` untuk API HTTPS.

Jangan membuka port `3306` dan `5000` ke publik.

## 2. Masuk ke VPS dari Git Bash

```bash
chmod 600 ~/Downloads/nama-private-key.pem
ssh -i ~/Downloads/nama-private-key.pem ubuntu@IP_PUBLIC_VPS
```

Biznet NEO Lite menyediakan akses root ke VM. Saat membuat SSH key dari portal, private key `.pem` dipakai untuk login sebagai user image VPS, umumnya `ubuntu` untuk Ubuntu.

## 3. Instal runtime

Contoh untuk Ubuntu:

```bash
sudo apt update
sudo apt upgrade -y
sudo apt install -y nginx mysql-server git curl snapd
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm install -g pm2
node -v
npm -v
```

Untuk VPS RAM 1 GB, tambahkan swap agar instalasi dependency dan Prisma tidak mudah kehabisan memori:

```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

## 4. Buat database

```bash
sudo mysql
```

Jalankan di prompt MySQL. Ganti password dengan password yang kuat:

```sql
CREATE DATABASE litepos CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'litepos'@'127.0.0.1' IDENTIFIED BY 'PASSWORD_DATABASE_KUAT';
GRANT ALL PRIVILEGES ON litepos.* TO 'litepos'@'127.0.0.1';
FLUSH PRIVILEGES;
EXIT;
```

Jika password mengandung karakter khusus, encode karakter tersebut saat dimasukkan ke `DATABASE_URL`.

## 5. Pasang backend

```bash
sudo mkdir -p /var/www/litepos /var/lib/litepos/uploads
sudo chown -R "$USER":"$USER" /var/www/litepos /var/lib/litepos
git clone URL_REPOSITORY_GIT /var/www/litepos
cd /var/www/litepos/pos-be
cp .env.example .env
nano .env
```

Nilai production minimum:

```dotenv
NODE_ENV=production
HOST=127.0.0.1
PORT=5000
DATABASE_URL="mysql://litepos:PASSWORD_URL_ENCODED@127.0.0.1:3306/litepos"
JWT_SECRET="SECRET_ACAK_MINIMAL_32_KARAKTER"
CORS_ORIGINS="https://nama-project.vercel.app"
UPLOAD_DIR="/var/lib/litepos/uploads"
```

Buat JWT secret dari VPS:

```bash
openssl rand -hex 32
```

Instal dan mulai backend:

```bash
npm ci
npm run build
npm run db:deploy
npm run seed
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup
```

`npm run seed` hanya dijalankan untuk database baru. Jalankan perintah `sudo ...` yang ditampilkan oleh `pm2 startup`, lalu `pm2 save` sekali lagi.

Periksa backend lokal VPS:

```bash
curl http://127.0.0.1:5000/api/health
pm2 logs litepos-api --lines 100
```

## 6. Aktifkan Nginx dan HTTPS pada IP

```bash
cd /var/www/litepos/pos-be
sudo mkdir -p /var/www/certbot/.well-known/acme-challenge
sudo cp deploy/nginx-litepos-api-ip-http.conf.example /etc/nginx/sites-available/litepos-api
sudo nano /etc/nginx/sites-available/litepos-api
```

Ganti seluruh `IP_PUBLIC_VPS` dengan IP publik sebenarnya, lalu aktifkan konfigurasi HTTP untuk proses validasi:

```bash
sudo ln -s /etc/nginx/sites-available/litepos-api /etc/nginx/sites-enabled/litepos-api
sudo nginx -t
sudo systemctl reload nginx
```

Pasang Certbot terbaru. Sertifikat IP dengan metode webroot membutuhkan Certbot 5.4 atau lebih baru:

```bash
sudo snap install core
sudo snap refresh core
sudo snap install --classic certbot
sudo ln -sf /snap/bin/certbot /usr/local/bin/certbot
certbot --version
sudo certbot certonly --preferred-profile shortlived --webroot --webroot-path /var/www/certbot --ip-address IP_PUBLIC_VPS
```

Setelah sertifikat berhasil dibuat, pasang konfigurasi HTTPS:

```bash
sudo cp deploy/nginx-litepos-api-ip-https.conf.example /etc/nginx/sites-available/litepos-api
sudo nano /etc/nginx/sites-available/litepos-api
sudo nginx -t
sudo systemctl reload nginx
sudo mkdir -p /etc/letsencrypt/renewal-hooks/deploy
printf '#!/bin/sh\nsystemctl reload nginx\n' | sudo tee /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh
sudo chmod +x /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh
sudo certbot renew --dry-run
systemctl list-timers | grep certbot
```

Sekali lagi ganti seluruh `IP_PUBLIC_VPS`, termasuk path sertifikat. Pastikan timer renewal Certbot aktif karena sertifikat IP berumur pendek.

Aktifkan firewall OS:

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
sudo ufw status
```

Tes dari komputer lokal:

```bash
curl https://IP_PUBLIC_VPS/api/health
curl https://IP_PUBLIC_VPS/api/catalog
```

## 7. Deploy frontend ke Vercel

1. Push repository ke GitHub/GitLab/Bitbucket.
2. Import repository di Vercel.
3. Set **Root Directory** menjadi `pos-fe`.
4. Framework preset: Next.js.
5. Tambahkan environment berikut untuk Production dan Preview:

```dotenv
NEXT_PUBLIC_API_URL=https://IP_PUBLIC_VPS
API_PROXY_TARGET=https://IP_PUBLIC_VPS
```

6. Deploy atau Redeploy.

Setelah URL production Vercel diketahui, masukkan URL tersebut ke `CORS_ORIGINS` backend dan reload:

```bash
cd /var/www/litepos/pos-be
nano .env
pm2 reload ecosystem.config.cjs --update-env
```

Environment `NEXT_PUBLIC_*` dimasukkan ke bundle browser saat build. Perubahan nilainya membutuhkan redeploy Vercel.

## 8. Hubungkan Android dan QR meja

Pada Android buka **Pengaturan > Sinkronisasi > URL Backend/API**, isi:

```text
https://IP_PUBLIC_VPS
```

Tekan **Tes Koneksi Backend**, lalu sinkronkan data. QR order meja harus menggunakan domain frontend:

```text
https://nama-project.vercel.app/katalog?table=T01
```

Katalog umum tetap menggunakan:

```text
https://nama-project.vercel.app/katalog
```

## 9. Migrasi data dan gambar lama

Untuk memindahkan database lama, buat dump dari server sumber lalu import sebelum menjalankan aplikasi:

```bash
mysqldump -u USER_LAMA -p --single-transaction --routines --triggers NAMA_DB > litepos.sql
scp -i ~/Downloads/nama-private-key.pem litepos.sql ubuntu@IP_PUBLIC_VPS:/tmp/litepos.sql
ssh -i ~/Downloads/nama-private-key.pem ubuntu@IP_PUBLIC_VPS
mysql -u litepos -p litepos < /tmp/litepos.sql
```

Pindahkan folder upload lama:

```bash
scp -i ~/Downloads/nama-private-key.pem -r pos-be/public/uploads/. ubuntu@IP_PUBLIC_VPS:/var/lib/litepos/uploads/
```

## 10. Update aplikasi berikutnya

```bash
cd /var/www/litepos
git pull
cd pos-be
npm ci
npm run build
npm run db:deploy
pm2 reload ecosystem.config.cjs --update-env
curl https://IP_PUBLIC_VPS/api/health
```

Sebelum perubahan skema atau update besar, backup database dan upload:

```bash
mysqldump -u litepos -p --single-transaction litepos > ~/litepos-backup.sql
tar -czf ~/litepos-uploads-backup.tar.gz /var/lib/litepos/uploads
```
