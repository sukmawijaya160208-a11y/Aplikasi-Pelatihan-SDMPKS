# PROMPT MIGRASI — LANJUTKAN DI LAPTOP BARU

Salin teks di bawah ke opencode (atau AI coding apa pun) di laptop baru. Prompt ini
self-contained: berisi semua konteks proyek, status migrasi, dan langkah lanjutan.

---

```
Kamu sedang membantu migrasi aplikasi web dari Hostinger VPS (sudah expired) ke
Rumahweb Unlimited Hosting paket Ultimate M (cPanel + LiteSpeed). Tugasmu:
pandu dan EKSEKUSI (bila diminta) semua langkah migrasi.

# KONTEKS PROYEK
- Nama aplikasi: SDMPKS (Aplikasi Pelatihan SDMPKS BPDP) — sinkronisasi data
  kelembagaan pekebun, berkas PDF, usulan pelatihan, persetujuan, surat resmi.
- Stack: PHP 8 (PDO) + MySQL/MariaDB + HTML/CSS/JS vanilla. TANPA framework,
  TANPA build tools, TANPA composer. Semua file PHP di folder `api/`.
- Repo: https://github.com/sukmawijaya160208-a11y/Aplikasi-Pelatihan-SDMPKS
  (branch: main, repo PUBLIC, remote HTTPS).
- Fitur keamanan aktif: rate-limit login, CSRF token (header X-CSRF-Token),
  idle timeout 30 menit, security headers + CSP, RBAC (roles/role_permissions),
  lupa password via notifikasi admin + WhatsApp.
- Struktur penting:
  - `api/`        endpoint per domain (?act=...) — `config.php` berisi kredensial DB
  - `js/`         fetch wrapper, auth, data, excel (import pekebun via SheetJS)
  - `sql/`        schema.sql, indeks.sql, migrations/ (0001, 0002)
  - `uploads/`    PDF unggahan pekebun (HANYA .htaccess di repo, data di server)
  - `backups/`    backup aplikasi (fitur Backup & Restore)
  - `storage/`    state sementara (rate-limit, audit.log) — harus writable
  - `deploy/`     script auto-deploy versi shared hosting (sudah ada di repo)
  - `.github/workflows/deploy.yml`  GitHub Actions SSH deploy (sudah ada di repo)
  - `.htaccess`   caching + security headers + limit upload (didukung LiteSpeed)
- Dokumen yang SUDAH ada di repo dan HARUS dibaca dulu:
  - `MIGRASI-RUMAHWEB.md`   → panduan migrasi lengkap (baca & ikuti)
  - `DEPLOY.md`             → riwayat arsitektur VPS Docker (konteks tambahan)
  - `README.md`             → ringkasan fitur & struktur
  - `deploy/update-rumahweb.sh` → script auto-deploy shared hosting

# STATUS MIGRASI (sudah dikerjakan sebelum pindah laptop)
- [x] Paket Rumahweb Ultimate M SUDAH DIBELI (aktif).
- [x] File persiapan dibuat: MIGRASI-RUMAHWEB.md, deploy/update-rumahweb.sh,
      .github/workflows/deploy.yml.
- [x] SSH keypair dibuat di laptop LAMA: C:\Users\Acer\.ssh\sdmpks_rumahweb
      (ed25519). Public key harus di-import ulang ke cPanel dari laptop baru
      (generate ulang atau salin keypair-nya).
- [ ] BELUM/TIDAK PASTI: rescue data VPS (dump DB + folder uploads/backups).
      JIKA belum, PRIORITAS PERTAMA adalah menyelamatkan data dari VPS selama
      masih bisa diakses (SSH VPS). Lihat FASE 0 di MIGRASI-RUMAHWEB.md.
      Backup cadangan: file Excel "Template Data Pekebun" bisa di-import ulang
      (data pekebun saja, TANPA PDF berkas).

# INFO YANG HARUS DIMINTA KE USER (jika belum tersedia)
1. cPanel username + hostname server SSH (port 2223) + IP server.
2. Status SSH Access di cPanel (sudah aktif? key sudah di-import/authorized?).
3. Apakah data VPS sudah diselamatkan? (dump .sql + tar.gz uploads/backups).
4. Database di cPanel: nama DB, user DB, password (buat baru via MySQL Databases).
5. Status DNS domain aplikasisdmpksa.online (masih di Hostinger hPanel?).
6. Apakah ada password SSH VPS / akses hPanel Hostinger untuk rescue data.

# RENCANA EKSEKUSI (urutan kerja)
1. FASE 0 — Rescue data dari VPS (jika masih bisa akses): dump MariaDB via
   `docker exec sdmpks-db mariadb-dump ...`, tar uploads/backups, download ke
   laptop, simpan 2 tempat. JANGAN lewati — data tidak ada backup lokal lain.
2. FASE 1 — Setup Rumahweb: SSH Access aktif + import public key; buat database
   + user via cPanel MySQL Databases; set PHP 8.2/8.3 via MultiPHP.
3. FASE 2 — Upload kode: clone repo ke ~/public_html, buat api/config.php dari
   config.example.php dengan kredensial DB (host=localhost), set permission
   uploads/backups/storage 755/775.
4. FASE 3 — Import DB via phpMyAdmin dengan urutan: sql/schema.sql →
   sql/indeks.sql → sql/migrations/0001 → 0002 → data dump VPS (jika ada).
   ATAU (bila SSH tersedia & MySQL CLI tidak ada) pakai script PHP import
   berbasis PDO yang membaca file .sql dan mengeksekusi per pernyataan.
5. FASE 4 — Restore file data: ekstrak tar.gz ke uploads/ dan backups/.
6. FASE 5 — Cutover DNS: pindah nameserver ke Rumahweb ATAU arahkan A record
   @ & www ke IP Rumahweb (domain di Hostinger hPanel). Tunggu propagasi.
7. FASE 6 — Aktifkan SSL AutoSSL Let's Encrypt di cPanel setelah DNS nunjuk.
8. FASE 7 — Verifikasi: halaman login, login admin (ganti password), upload PDF,
   Backup & Restore, import Excel, cek storage/audit.log writable,
   cek security headers via curl -I.
9. FASE 8 — Auto-deploy: pastikan ~/deploy-rumahweb.sh ada di server, set
   GitHub Actions secrets (SSH_HOST, SSH_USERNAME, SSH_PORT=2223, SSH_KEY),
   ATAU set cron cPanel `* * * * * bash ~/deploy-rumahweb.sh`.
10. FASE 9 — Backup rutin: aktifkan backup mingguan Rumahweb + download
    berkala isi backups/ (fitur aplikasi) ke laptop.

# TEKNIKAL PENTING (jangan lupa)
- SSH Rumahweb: port 2223, user = user cPanel, non-root. Uji:
  `ssh -i KEY -p 2223 USER@HOST`.
- Konfigurasi DB di shared hosting: host = `localhost` (bukan 127.0.0.1/container).
- `.htaccess` sudah ada & didukung LiteSpeed. Jika error 500, cek PHP version
  & ekstensi pdo_mysql via MultiPHP, atau ganti cara set upload limit via
  MultiPHP INI Editor (upload_max_filesize=20M, post_max_size=24M).
- Deploy script mengharapkan public_html sudah pernah di-`git clone`.
- Repo PUBLIC → clone HTTPS tanpa kredensial. Jika dibuat private nanti,
  gunakan SSH deploy key GitHub.
- Migrasi SQL versi baru dilakukan MANUAL via phpMyAdmin (shared hosting tidak
  punya CLI mysql di SSH).
- Fitur Rumahweb yang TIDAK dipakai aplikasi: Redis Object Cache, Node.js/Python,
  PHP X-Ray, AccelerateWP (WordPress). Abaikan.
- App memakai fitur Backup & Restore bawaan yang menulis ke backups/ (harus
  writable) dan storage/ untuk rate-limit + audit log.

# VERIFIKASI AKHIR (definisi selesai)
- https://aplikasisdmpksa.online/ terbuka dengan SSL hijau.
- Login admin berhasil, password admin sudah diganti.
- Data pekebun ada (dari dump ATAU import Excel) dengan ok_count wajar.
- PDF berkas yang terselamatkan bisa dibuka/diunduh.
- Backup pertama via menu Backup & Restore berhasil.
- `git push` ke main memicu deploy otomatis (GitHub Actions ATAU cron) dan
  server ter-update dengan rollback bila gagal.

Kerjakan langkah demi langkah. Setiap kali butuh keputusan, jelaskan opsi dan
rekomendasi. Mulai dengan meminta info yang belum tersedia dari user.
```