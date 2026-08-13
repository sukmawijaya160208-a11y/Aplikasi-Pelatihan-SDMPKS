# Aplikasi Pelatihan SDMPKS

Aplikasi web ringan (tanpa build tools) untuk sinkronisasi data kelembagaan
pekebun, berkas (PDF), usulan pelatihan, persetujuan Dinas, dan surat resmi.

- **Stack**: PHP 8 (PDO) + MySQL/MariaDB + HTML/CSS/JS vanilla
- **Panduan deploy**: lihat [DEPLOY.md](DEPLOY.md)
- **Aturan arsitektur & keamanan**: lihat [TEMPLATE-PROYEK-RINGAN.md](TEMPLATE-PROYEK-RINGAN.md)

## Fitur keamanan

- Rate limit login (5 gagal / 15 menit per IP+username, blokir 15 menit)
- CSRF token di semua POST/upload (header `X-CSRF-Token`)
- Password baru minimal 8 karakter
- Idle session timeout 30 menit
- Security headers + Content Security Policy (script hanya dari domain sendiri + CDN allowlist)
- Lupa password via notifikasi admin + WhatsApp (0822-2728-3416)
- RBAC berbasis tabel `roles` → `role_permissions` → `permissions`

## Struktur

```
api/            endpoint per domain (?act=...)
assets/         logo & favicon
css/            style.css (token CSS)
js/             api.js (fetch wrapper), auth.js, store.js, data.js, ...
storage/        state sementara (rate-limit, audit log) — bukan bagian repo
sql/            schema + migrasi incremental
```