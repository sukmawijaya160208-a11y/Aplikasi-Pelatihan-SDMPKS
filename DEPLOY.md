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

### 3a. (Rekomendasi) Deploy Key SSH khusus VPS

Buat keypair di VPS (sekali saja):

```bash
mkdir -p /root/.ssh
ssh-keygen -t ed25519 -f /root/.ssh/id_sdmpks -N ""
cat /root/.ssh/id_sdmpks.pub
```

Salin hasilnya, lalu di GitHub repo ini: **Settings → Deploy keys → Add deploy key** → tempel public key → title `VPS sdmpks` → **jangan centang** "Allow write access" (read-only cukup untuk auto-deploy).

> Catatan: satu deploy key hanya bisa dipakai satu repository. VPS project 1 punya key sendiri; project ini pakai key sendiri (`id_sdmpks`). Public key yang sama tidak bisa dipakai di dua repo.

```bash
cd /var/www
sudo git clone git@github.com:sukmawijaya160208-a11y/Aplikasi-Pelatihan-SDMPKS.git sdmpks
cd sdmpks
sudo cp api/config.example.php api/config.php
```

### 3b. Alternatif: clone via HTTPS

```bash
cd /var/www
sudo git clone https://github.com/sukmawijaya160208-a11y/Aplikasi-Pelatihan-SDMPKS.git sdmpks
cd sdmpks
sudo cp api/config.example.php api/config.php
```

> Update aplikasi di bagian 9 menggunakan remote yang sama (SSH atau HTTPS).

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

---

## Lampiran: Topologi Deploy Aktual (VPS 31.97.50.22 - 5 Agt 2026)

> Setup di atas (nginx host) TIDAK dipakai. VPS ini menjalankan project KUD (Docker, port 80/443) sehingga SDMPKS dipasang sebagai stack Docker kedua. Referensi utama: bagian ini.

### Arsitektur

```
/var/www/sdmpks/
??? docker-compose.yml          # stack SDMPKS (project: sdmpks)
?   ??? sdmpks-db     MariaDB 10.11  (container-only, network sdmpks_sdmpks-net)
?   ??? sdmpks-app    PHP 8.3-fpm-alpine + pdo_mysql (bind ./app:/var/www)
?   ??? sdmpks-nginx  nginx:alpine  (host port 8080, acme webroot proxy)
??? app/                       # clone repo via deploy key SSH (/root/keykud)
```

- Database: `sdmpks_db` (user `sdmpks_user`), host `db` (nama container, bukan 127.0.0.1)
- Akses publik domain: port 80/443 dipegang container `kud-nginx` (project KUD).
  `sdmpks-nginx` di-`docker network connect` ke `kud_kud-network`; blok server
  `aplikasisdmpksa.online` ditambahkan di `/var/www/kud/docker/nginx.conf`.
- SSL: Let's Encrypt via certbot webroot (`-w /var/www/sdmpks/app`), path
  `/.well-known/acme-challenge/` diproxy kud-nginx ? sdmpks-nginx.
  Auto-renew certbot + hook deploy `/etc/letsencrypt/renewal-hooks/deploy/sdmpks-reload.sh`.
- Backdoor akses langsung: `http://31.97.50.22:8080` (HTTP tanpa SSL).

### PENTING: peringatan git pull project KUD

Blok SDMPKS hidup di `/var/www/kud/docker/nginx.conf` (milik repo project 1).
Jika project KUD di-`git pull`, blok SDMPKS bisa tertimpa ? domain SDMPKS 404.
Pulihkan: append blok server port 80 (acme + redirect) & 443 dari bagian
`docker/` pada repo SDMPKS (lihat `deploy/sdmpks-block.conf` & `sdmpks-ssl-block.conf`),
lalu `docker restart kud-nginx`.

### Update aplikasi SDMPKS

```bash
cd /var/www/sdmpks/app && git pull
docker exec sdmpks-app php -l api/*.php >/dev/null
docker exec sdmpks-nginx nginx -s reload   # (statis, tak perlu, tapi aman)
```

### Backup DB (cron host)

```cron
0 2 * * * docker exec sdmpks-db mariadb-dump -uroot -pSdmpksRoot#2026! sdmpks_db > /var/backups/sdmpks-$(date +\%F).sql && find /var/backups -name 'sdmpks-*.sql' -mtime +7 -delete
```

### Auto-Deploy (aktif sejak 5 Agt 2026)

Alur: `git push` ? cron VPS (tiap 2 menit) mendeteksi commit baru ? pull ? lint ? migrasi ? health check ? **rollback otomatis** bila gagal. Bisa dilihat di `/var/www/sdmpks/deploy/update.log`.

| Cron | File | Fungsi |
|---|---|---|
| `*/2 * * * *` | `deploy/update.sh` | Auto-deploy + rollback (flock anti-bentrok) |
| `*/5 * * * *` | `deploy/guard-nginx.sh` | Hidupkan container mati, sambungkan network KUD, pulihkan blok nginx SDMPKS bila project KUD menimpanya |
| `0 2 * * *` | `deploy/backup-db.sh` | Dump DB ke `/var/backups/sdmpks-*.sql`, simpan 7 hari |
| `@reboot` | `deploy/harden-net.sh` | Pastikan 8080 hanya localhost |

Kredensial DB container ada di `deploy/.env` (chmod 600). Update manual: `cd /var/www/sdmpks/app && git pull` (aman ? update.sh yang menangani lint/migrasi/reload).

### Migrasi DB (konvensi)

- File baru: `sql/migrations/00XX_keterangan.sql` (non-destruktif, idempotent).
- Otomatis diaplikasi SEKALI oleh update.sh (marker di `deploy/migrated/`).
- `sql/schema.sql` berisi DROP TABLE ? HANYA untuk instalasi baru, tidak pernah auto-run.

### Keamanan & catatan penting

- Port `8080` hanya `127.0.0.1` (publish bind di `docker-compose.yml`); akses publik hanya lewat `https://aplikasisdmpksa.online`.
- `sdmpks-nginx` menumpang `kud_kud-network` (external) ? jangan hapus network ini.
- Jika project KUD `git pull` menimpa `kud-nginx.conf`, guard memulihkan otomatis ?5 menit.
- Uji sebelum push (laptop): jalankan 4 suite test, wajib `TOTAL-FAIL = 0` (lihat `run-tests.cmd` + pre-push hook lint).
