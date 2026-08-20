# Panduan Migrasi — Hostinger VPS → Rumahweb Unlimited Hosting (Ultimate M)

> Aplikasi: **SDMPKS** (PHP 8 + MySQL/MariaDB, vanilla, tanpa framework & tanpa build).
> Sumber: VPS Hostinger (Docker stack, `aplikasisdmpksa.online`) — masa aktif habis.
> Tujuan: Rumahweb **Ultimate M** (Unlimited Hosting, cPanel + LiteSpeed + SSH + cron).

Prinsip: kode vanilla PHP **tidak butuh Docker/nginx**. Di shared hosting file langsung
hidup di `public_html` dan Apache/LiteSpeed membaca `.htaccess` yang sudah ada di repo.

---

## Fitur Ultimate M yang relevan

| Fitur | Dipakai? | Keterangan |
|---|---|---|
| Unlimited space/traffic/email | ✔ | — |
| cPanel + File Manager + FTP | ✔ | Kelola file, DB, cron, SSL |
| SSH (port **2223**, non-root) | ✔ | Buat auto-deploy `git pull` & lint |
| Cron Jobs (bisa per-menit) | ✔ | Backup DB rutin + polling deploy (opsional) |
| LiteSpeed + Turbo Booster + Lite Cache | ✔ | Auto, `.htaccess` didukung |
| PHP multi-versi (pilih 8.2/8.3) | ✔ | Wajib set via MultiPHP |
| MariaDB + phpMyAdmin | ✔ | Import DB di sini |
| SSL gratis Let's Encrypt (auto) | ✔ | Aktifkan di cPanel |
| Backup mingguan gratis + Instant Backup | ✔ | Backup DB/panel |
| Redis Object Cache, Node.js/Python, PHP X-Ray, AccelerateWP | ✖ | Tidak dipakai aplikasi (opsional) |
| Gratis bantuan migrasi dari Rumahweb | ✔ (opsional) | Bisa minta tim Rumahweb bantu pindahkan |

---

## FASE 0 — SELAMATKAN DATA DARI VPS (KERJAKAN PALING AWAL)

> Kamu TIDAK punya backup lokal. Selama VPS masih bisa diakses, ini satu-satunya sumber data.
> Plus: file Excel Template Data Pekebun yang kamu download adalah backup tambahan data pekebun
> (bisa di-import ulang ke DB kosong, NIK duplikat otomatis di-skip).

### 0a. Dump database (SSH ke VPS)

```bash
cd /var/www/sdmpks
docker exec sdmpks-db mariadb-dump -uroot -p'SdmpksRoot#2026!' sdmpks_db > sdmpks-db-$(date +%F).sql
ls -la sdmpks-db-*.sql        # pastikan ukuran wajar (KB–MB), bukan 0 byte
```

### 0b. Pack & download file data

```bash
sudo tar czf sdmpks-data.tar.gz -C /var/www/sdmpks/app uploads backups
```

Unduh ke laptop via SCP/SFTP (WinSCP / FileZilla / `scp`):

```bash
scp -r root@IP_VPS:/var/www/sdmpks/sdmpks-db-*.sql .
scp -r root@IP_VPS:/var/www/sdmpks/sdmpks-data.tar.gz .
```

### 0c. Verifikasi & simpan ke 2 tempat

- Buka `.sql` — harus berisi `CREATE TABLE` + `INSERT` (tabel `users`, `pekebun`, dst).
- Buka tar.gz — harus ada `uploads/pekebun/*.pdf` dan isi `backups/`.
- Simpan di **laptop + Google Drive/email** (jangan ulangi tanpa backup).

> Materi yang perlu diselamatkan: **DB** (`.sql`), **PDF unggahan** (`uploads/pekebun/`),
> **backup aplikasi** (`backups/`). Kode ada di GitHub & laptop, tidak perlu di-rescue.

---

## FASE 1 — Set Up Rumahweb Ultimate M (setelah order aktif)

1. **Login cPanel** → email aktivasi dari Rumahweb berisi user cPanel + domain.
2. **Aktifkan SSH**: cPanel → *SSH Access* → *Manage SSH Keys* → *Generate/Import Key*
   → pakai port **2223**, user = user cPanel. (Opsional dulu, dipakai di Fase 2/7.)
3. **Buat database** (cPanel → *MySQL Databases*):
   - Nama DB: `USER_sdmpks` (mis. `sdmpk_sdmpks`)
   - User DB: `USER_sdmpks` + password kuat (simpan!)
   - Add user to DB → **ALL PRIVILEGES**
4. **Set PHP 8.2/8.3**: cPanel → *MultiPHP Manager* → pilih domain → PHP 8.2 (atau 8.3).
   - Optional: *MultiPHP INI Editor* → `upload_max_filesize=20M`, `post_max_size=24M`
     (`.htaccess` sudah punya `php_value`, LiteSpeed mendukung — cek tetap aman di INI).
5. **SSL**: nanti setelah DNS nunjuk (Fase 5). Let's Encrypt otomatis di cPanel.

---

## FASE 2 — Upload Kode ke `public_html`

### Opsi A (disarankan): clone via SSH

```bash
ssh USER_cpanel@DOMAIN.com -p 2223
cd ~/public_html
# hapus file bawaan cPanel bila ada (index.html default dll), lalu:
git clone https://github.com/sukmawijaya160208-a11y/Aplikasi-Pelatihan-SDMPKS.git .
```

> Repo ini **public**, jadi clone HTTPS tanpa kredensial. Kalau repo nanti dibuat private,
> ganti pakai SSH deploy key GitHub atau Personal Access Token (lihat Fase 7).

### Opsi B: upload via File Manager/FTP

Upload **isi folder project** (bukan folder luarnya) ke `public_html/`:
`index.html`, `dashboard.html`, `api/`, `js/`, `css/`, `assets/`, `sql/`, `uploads/`,
`backups/`, `storage/`, `.htaccess`, `.gitignore`.

### 2a. Buat `api/config.php`

Salin dari `api/config.example.php`, isi kredensial DB dari Fase 1.3:

```php
define('DB_HOST', 'localhost');      // host DB di cPanel
define('DB_NAME', 'USER_sdmpks');
define('DB_USER', 'USER_sdmpks');
define('DB_PASS', 'PASSWORD_DB');
```

### 2b. Permission folder write

cPanel → *File Manager* → pilih `uploads`, `backups`, `storage` → *Permissions* → **755**
(atau 775 bila ada error write). Pastikan bisa ditulis PHP/LiteSpeed.

---

## FASE 3 — Import Database

Urutan impor di phpMyAdmin (cPanel → *phpMyAdmin* → pilih DB `USER_sdmpks` → *Import*):

1. `sql/schema.sql` (struktur + roles + permissions + akun admin)
2. `sql/indeks.sql` (index)
3. `sql/migrations/0001_seed_role_users.sql` (seed role/user)
4. `sql/migrations/0002_lokasi_lahan.sql`
5. **Data asli** dari dump VPS (Fase 0a) — hanya kalau dump-nya berhasil diselamatkan.

> `schema.sql` berisi `DROP TABLE` — **hanya** untuk instalasi baru, aman dipakai di server baru.
> Kalau dump VPS gagal, data pekebun bisa di-import ulang dari **Excel Template Data Pekebun**
> lewat fitur upload lembaga (data masuk sebagai data baru; NIK duplikat di-skip otomatis).

---

## FASE 4 — Restore File Data (upload/backups)

1. Ekstrak `sdmpks-data.tar.gz` → salin isi `uploads/` ke `public_html/uploads/`
   dan isi `backups/` ke `public_html/backups/`.
2. Pastikan folder `storage/` writable (rate-limit + audit log).
3. Verifikasi struktur akhir:

```
public_html/
├── index.html, dashboard.html
├── api/          (config.php sudah diisi)
├── js/ css/ assets/ sql/
├── uploads/  backups/  storage/
└── .htaccess
```

---

## FASE 5 — Cutover DNS + SSL

Domain `aplikasisdmpksa.online` terdaftar di **Hostinger** (hPanel). Dua cara:

- **Cara A (disarankan): ganti nameserver** di hPanel → DNS Zone → Nameservers →
  set ke NS Rumahweb (lihat email aktivasi / panel Rumahweb → cPanel).
- **Cara B: arahkan A record** di hPanel → DNS Zone → ubah `@` & `www` ke IP Rumahweb
  (dari email aktivasi, format `103.x.x.x`).

Tunggu propagasi 1–24 jam (`dig +short aplikasisdmpksa.online`).

Setelah nunjuk → cPanel → *SSL/TLS Status* → *Run AutoSSL* (Let's Encrypt).

---

## FASE 6 — Verifikasi (checklist)

- [ ] `https://aplikasisdmpksa.online/` → halaman login tampil (HTTPS, SSL hijau)
- [ ] Login `admin` (password dari DB/schema) → **langsung ganti password**
- [ ] Dashboard normal, notifikasi & polling berjalan
- [ ] Upload PDF lembaga → file > 20MB harus ditolak (limit sesuai set)
- [ ] Menu **Backup & Restore** → backup pertama masuk `backups/`
- [ ] Import Excel data pekebun → `ok_count` wajar
- [ ] `storage/audit.log` terisi (writable)
- [ ] `.htaccess` security headers aktif (cek via browser DevTools / cURL `curl -I https://...`)

---

## FASE 7 — Auto-Deploy (`git push` → server update)

Karena SSH tersedia di Ultimate M, alur deploy tetap bisa **push → deploy**, hanya beda mekanisme:

### Opsi A: GitHub Actions push-based (disarankan)

Repositori ini berisi `.github/workflows/deploy.yml` yang akan:

1. Trigger tiap push ke `main`.
2. SSH ke Rumahweb (port **2223**, user cPanel, pakai SSH key).
3. Jalankan `~/deploy-rumahweb.sh` → `git pull` + lint + health check + rollback otomatis.

Setup sekali:
1. Upload SSH **public key** di cPanel → *SSH Access* → *Manage SSH Keys*.
2. Cek key `.ssh/id_ed25519` server ada; salin **private key** ke GitHub repo →
   *Settings → Secrets and variables → Actions* → `SSH_HOST`, `SSH_USERNAME`,
   `SSH_PORT` (= `2223`), `SSH_KEY` (isi private key).
3. Di server: `git clone` pertama kali (Fase 2) supaya `public_html` sudah terhubung remote.

### Opsi B: Cron polling (mirip VPS)

cPanel → *Cron Jobs* → tiap menit (`* * * * *`):

```
* * * * * bash ~/deploy-rumahweb.sh >> ~/deploy-rumahweb.log 2>&1
```

Script sama persis; bedanya dipicu cron, bukan GitHub Actions.

### Migrasi database

- Auto-deploy **hanya menangani kode** (git pull + lint + health check).
- Perubahan schema dijalankan **manual via phpMyAdmin** (file `sql/migrations/XXXX_*.sql`),
  karena shared hosting tidak menyediakan CLI `mysql` di SSH. Marker `deploy/migrated/`
  tetap dipakai script agar migrasi tidak dijalankan ganda saat ada mesin migrator PHP.
  (Catatan: saat ini aplikasi memakai migrasi manual/script VPS — untuk shared hosting
  cukup impor file migrasi baru via phpMyAdmin.)

---

## Backup Database Rutin

- **Otomatis dari Rumahweb**: backup mingguan gratis + cPanel *Instant Backup*.
- **Cron tambahan (via SSH)**: mysqldump mungkin tidak tersedia di shared hosting.
  Solusi: pakai cPanel *Backup* / *Backup Wizard* terjadwal, atau jalankan PHP script
  yang men-dump via PDO ke file `.sql` di folder backup lalu download via FTP.
  Simpel & aman: rutin **Instant Backup** mingguan + copy `backups/` (fitur bawaan aplikasi)
  ke laptop secara berkala.

---

## Perbedaan Kunci VPS vs Rumahweb Ultimate M

| Aspek | VPS (Docker) | Rumahweb Ultimate M |
|---|---|---|
| Aplikasi | Container `sdmpks-app` | Langsung di `public_html` |
| Web server | nginx (config manual) | LiteSpeed (Apache-style, baca `.htaccess`) |
| DB | Container MariaDB | MariaDB di cPanel, host `localhost` |
| Deploy | Cron host + Docker restart | GitHub Actions SSH / cron → `git pull` |
| Migrasi SQL | CLI `mysql` via update.sh | Manual via phpMyAdmin |
| Rollback | update.sh | `deploy/update-rumahweb.sh` (`git reset --hard`) |
| TLS/SSL | certbot + nginx block | AutoSSL Let's Encrypt cPanel |
| Fitur tak terpakai | — | Redis, Node/Python, X-Ray, AccelerateWP |

---

## Troubleshooting Cepat

| Gejala | Penyebab | Solusi |
|---|---|---|
| 404 di semua halaman | Kode ter-upload di folder salah | Pastikan file ada di `public_html` (bukan subfolder) |
| Login gagal / 401 terus | Kredensial DB salah | Cek `api/config.php`; tes login phpMyAdmin |
| Upload PDF ditolak | Limit kecil | Set `upload_max_filesize`/`post_max_size` via MultiPHP INI |
| 500 di API | Ekstensi PHP kurang (pdo_mysql) | Aktifkan di MultiPHP / hubungi support |
| CSS/JS tidak termuat | CSP memblokir CDN | CSP sudah allowlist jsdelivr & cdnjs; cek referensi halaman |
| Error write rate-limit | `storage/` tidak writable | Set permission 755/775 di File Manager |
| SSL belum aktif | DNS belum propagasi | Tunggu + *Run AutoSSL* setelah nunjuk |

---

## Catatan Khusus File Excel Data Pekebun

- Format template: **42 kolom**, kolom wajib = Nama, NIK (16 digit), No. KK (16 digit),
  Jenis Kelamin, Jenis Pelatihan, Jalur, Provinsi, Kabupaten/Kota, Kecamatan, Desa/Kelurahan,
  Nama Kepala Desa.
- Import **membaca file di browser** (SheetJS) → kirim JSON ke `api/pekebun.php?act=import`.
- Server baru + DB kosong → semua baris valid masuk. DB sudah ada data → baris dengan NIK
  sama **di-skip otomatis** (tidak dobel, tidak error).
- Excel TIDAK berisi PDF berkas & perubahan yang diedit lewat aplikasi setelah import —
  tetap rescue `uploads/` + `backups/` dari VPS (Fase 0).