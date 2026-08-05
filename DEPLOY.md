# Panduan Deployment - VPS Hostinger (Ubuntu 24.04 LTS + Nginx)

Panduan memasang aplikasi **SDMPKS** sebagai **proyek kedua** di VPS Hostinger yang sudah memiliki satu proyek berjalan. Prinsipnya: Nginx + PHP-FPM + MySQL **dipakai bersama**, hanya menambah: 1 folder aplikasi, 1 konfigurasi nginx (server block), dan 1 database.

---

## 1. Siapkan Server (sekali saja, bila belum ada)

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y nginx mysql-server php8.3-fpm php8.3-mysql \
  php8.3-mbstring php8.3-xml php8.3-curl php8.3-zip php8.3-gd php8.3-intl unzip git
```

Pastikan dua-duanya aktif:

```bash
sudo systemctl enable --now nginx php8.3-fpm mysql
mysql --version
```

> Ubah `php8.3` sesuai versi yang terpasang (`php -v`). Jika project pertama sudah menginstal ini semua, langsung ke langkah 2.

## 2. Siapkan Domain & DNS

1. Di panel Hostinger → **Domains** → daftarkan/beli domain baru.
2. Di **hPanel → DNS Zone** domain tersebut, tambahkan:
   - `A` record: `@` → `<IP VPS>`
   - `A` record: `www` → `<IP VPS>`
   - (Opsional) `AAAA` record → IPv6 VPS
3. Tunggu propagasi DNS (biasanya < 1 jam; cek dengan `dig +short domain.com`).

## 3. Ambil Kode dari GitHub

```bash
sudo mkdir -p /var/www
cd /var/www
sudo git clone https://github.com/sukmawijaya160208-a11y/Aplikasi-Pelatihan-SDMPKS.git sdmpks
cd sdmpks
sudo cp api/config.example.php api/config.php
```

## 4. Buat Database & User MySQL

```bash
sudo mysql
```

```sql
CREATE DATABASE sdmpks_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'sdmpks_user'@'localhost' IDENTIFIED BY 'GANTI_PASSWORD_KUAT';
GRANT ALL PRIVILEGES ON sdmpks_db.* TO 'sdmpks_user'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

Import struktur + data awal:

```bash
sudo mysql sdmpks_db < /var/www/sdmpks/sql/schema.sql
sudo mysql sdmpks_db < /var/www/sdmpks/sql/indeks.sql
```

> `schema.sql` sudah berisi roles, permissions, dan akun admin. **Tidak** berisi data pekebun/lembaga (murni instalasi baru).

Edit kredensial di `api/config.php`:

```bash
sudo nano /var/www/sdmpks/api/config.php
```

```php
define('DB_HOST', '127.0.0.1');
define('DB_NAME', 'sdmpks_db');
define('DB_USER', 'sdmpks_user');
define('DB_PASS', 'GANTI_PASSWORD_KUAT');
```

## 5. Izin Folder (write untuk unggahan & backup)

```bash
sudo chown -R www-data:www-data /var/www/sdmpks
sudo chmod -R 755 /var/www/sdmpks
sudo mkdir -p /var/www/sdmpks/uploads/pekebun /var/www/sdmpks/backups
sudo chown -R www-data:www-data /var/www/sdmpks/uploads /var/www/sdmpks/backups
```

## 6. Konfigurasi Nginx (server block untuk domain ke-2)

Buat file:

```bash
sudo nano /etc/nginx/sites-available/sdmpks
```

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name sdmpks.example.com;   # GANTI dengan domain Anda

    root /var/www/sdmpks;
    index index.html;

    client_max_body_size 10M;         # upload PDF maks 5 MB

    # Blokir file sensitif (nginx tidak membaca .htaccess!)
    location ~ ^/api/(config|config\.example)\.php$ { deny all; }
    location ^~ /backups/      { deny all; }
    location ^~ /uploads/pekebun/ {
        deny all;
        location ~ \.pdf$ { allow all; }   # PDF boleh diakses via URL? bila ya, uncomment
    }

    # Cache aset statis 7 hari (meniru .htaccess)
    location ~* \.(css|js|png|jpg|jpeg|gif|svg|ico|woff2?)$ {
        expires 7d;
        add_header Cache-Control "public, immutable";
        try_files $uri =404;
    }

    # File HTML/JSON wilayah tanpa cache
    location ~* \.(html|json)$ {
        add_header Cache-Control "no-cache, no-store, must-revalidate";
    }

    location / {
        try_files $uri $uri/ =404;
    }

    # PHP-FPM
    location ~ \.php$ {
        include snippets/fastcgi-php.conf;
        fastcgi_pass unix:/run/php/php8.3-fpm.sock;
        fastcgi_param PHP_VALUE "upload_max_filesize=10M post_max_size=12M max_execution_time=120";
    }
}
```

Aktifkan dan muat ulang:

```bash
sudo ln -s /etc/nginx/sites-available/sdmpks /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

## 7. HTTPS (SSL) - sangat disarankan

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d sdmpks.example.com -d www.sdmpks.example.com
```

Certbot otomatis mengubah server block ke HTTPS dan menambah cron renewal.

## 8. Verifikasi

- Buka `https://sdmpks.example.com/` → halaman login muncul.
- Login `admin` / `admin123` → **langsung ganti password**.
- Uji menu Backup & Restore → buat backup pertama (file masuk ke `backups/`).
- Uji upload PDF dari akun lembaga (coba file > 5 MB → harus ditolak).

> Jika halaman login muncul tapi API `401`, cek `api/config.php` (kredensial) dan `systemctl status php8.3-fpm`.

## 9. Update Aplikasi ke Versi Baru

```bash
cd /var/www/sdmpks
sudo git pull
sudo php -l api/*.php        # cek sintaks
sudo systemctl reload php8.3-fpm
```

Bila ada perubahan skema database, impor file SQL terbaru secara manual dan cadangkan DB dulu:

```bash
sudo mysqldump sdmpks_db > backup-$(date +%F).sql
```

## Backup Database (rutin, via cron)

```bash
sudo crontab -e
```

```cron
# Backup otomatis tiap hari 02:00 (simpan 7 hari terakhir)
0 2 * * * mysqldump sdmpks_db > /var/backups/sdmpks-$(date +\%F).sql && find /var/backups -name 'sdmpks-*.sql' -mtime +7 -delete
```

> Fitur Backup & Restore bawaan aplikasi menyimpan file di `backups/` (terblokir dari web). Untuk keamanan maksimal, backup lewat cron di atas.

## Troubleshooting Cepat

| Gejala | Penyebab | Solusi |
|---|---|---|
| 404 pada semua halaman | Document root salah | Pastikan `root /var/www/sdmpks` dan `index index.html` |
| Login gagal/401 terus | Kredensial DB salah | Cek `api/config.php`; `sudo mysql -u sdmpks_user -p sdmpks_db` |
| Upload PDF ditolak | ukuran melebihi limit | Naikkan `client_max_body_size` + `PHP_VALUE upload_max_filesize` |
| 500 di semua API | PHP ext pdo_mysql kurang | `sudo apt install php8.3-mysql` lalu reload fpm |
| Aset tidak termuat (CSS/JS) | Nginx `try_files` salah | Pastikan blok `location /` menuju `try_files $uri $uri/ =404` |
