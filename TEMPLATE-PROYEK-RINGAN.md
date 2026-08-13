# TEMPLATE PROYEK RINGAN — "Aplikasi Pelatihan SDMPKS"

> Template prompt kerja (tidak dijalankan otomatis) yang mendokumentasikan
> keputusan arsitektur aplikasi ringan tanpa build-tools. Setiap pekerjaan
> baru di aplikasi ini HARUS mengikuti aturan di bawah.

---

## 1. Deskripsi Aplikasi

- **Tujuan**: Sinkronisasi data kelembagaan pekebun, berkas (PDF), usulan
  pelatihan, persetujuan Dinas, dan surat resmi — dipakai Dinas Perkebunan,
  KUD/Lembaga Pekebun, dan Administrator.
- **Stack**: HTML/CSS/JS vanilla + PHP 8 (PDO) + MySQL/MariaDB.
- **Tidak ada build tools**: tidak ada npm, composer, webpack, framework JS.
- **Deploy**: nginx + PHP-FPM di container Docker (VPS), atau Apache mod_php
  (XAMPP lokal).

## 2. Struktur Wajib

```
api/            satu file per domain; ?act= membedakan aksi (auth, pekebun, ...)
api/db.php      helper: pdo(), json_ok/json_err, body(), guard_role(), can()
api/security.php rate limiter, CSRF, idle session
assets/         logo, favicon (assets/img/)
css/            style.css (token CSS variable, tanpa framework)
js/             api.js (fetch wrapper), auth.js, store.js, data.js, ...
storage/        state sementara (rate-limit, audit) — TIDAK di-git
uploads/        dokumen unggahan (path per lembaga/berkas)
sql/            schema.sql + migrasi numerik (0001_..., 0002_...)
config.example.php (dasar) -> config.php (lokal, TIDAK di-git)
```

## 3. Aturan Wajib (JANGAN dilanggar)

1. **PDO prepared statement** untuk SEMUA query SQL. Tidak ada interpolasi
   string user ke SQL.
2. **Autentikasi**: session PHP + `session_regenerate_id(true)` saat login;
   `guard_role()`/`can()` di semua API ber-login; idle timeout 30 menit;
   cookie session `httponly` + `samesite=Lax` (+`secure` saat HTTPS).
3. **API selalu JSON murni** (`json_ok`/`json_err`); jangan cetak error/warning
   ke body (sumber "Unexpected token '<'").
4. **Unggahan**: validasi tipe & ukuran server-side, `basename()` untuk nama,
   simpan di folder non-eksekusi (`uploads/`), tidak pernah simpan di webroot
   dengan nama asli user.
5. **XSS**: semua output user `htmlspecialchars` (JS pakai `textContent`,
   BUKAN `insertAdjacentHTML` dengan input user).
6. **CSRF**: semua POST/upload wajib header `X-CSRF-Token`; diverifikasi
   `csrf_verify()`; gunakan `csrf_token()` dari `api/security.php`.
7. **Brute-force**: `rate_limit_*()` (file-based di `storage/ratelimit/`) untuk
   login, lupa-password, dan register.
8. **Slider/kenaikan fitur**: password baru minimal 8 karakter.
9. **Error tidak bocor**: jangan tampilkan detail SQL/stack ke klien;
   `display_errors=0` + log server.
10. **Notifikasi** via tabel `notifikasi` + `kirim_notifikasi()` (near
    real-time via polling), bukan WebSocket.
11. **RBAC** via `roles` → `role_permissions` → `permissions`; jangan men-skip
    guard, jangan tambah role baru tanpa izin pemilik proyek.
12. **Deploy**: nginx (VPS) → perubahan di `docker/` wajib `docker restart`
    container (bind-mount + sed = inode berubah). PHP_VALUE multi-parameter
    dengan spasi TIDAK valid di PHP-FPM — gunakan file INI di folder `docker/app/`.
13. **Secret**: `config.php` TIDAK pernah di-git; gunakan `{env:...}` dan
    variabel environment bila perlu secret saat build CI.
14. **Backward compatibility**: JANGAN hapus/mengubah data DB atau akun;
    migrasi selalu incremental (`sql/`).

## 4. Keamanan Lapisan (recap)

- Rate limit login: 5 gagal / 15 menit / (IP + username), blokir 15 menit.
- Reset password: melalui permintaan user → notifikasi admin → admin reset
  (fitur kelola akun) → password baru via WhatsApp (0822-2728-3416).
- CSP: `script-src 'self' + CDN allowlist`; tanpa `'unsafe-inline'` script.
- Security headers: nosniff, frame-ancestors SAMEORIGIN, referrer-policy,
  permissions-policy, `server_tokens off` (nginx) / unset Server (.htaccess).

## 5. Verifikasi Setiap Perubahan

1. `api/sysinfo.php` tidak menampilkan detail versi berlebih ke publik. ✔
2. Login salah berulang → blokir. ✔
3. POST tanpa CSRF token → 419. ✔
4. Upload PDF 20 MB berhasil; upload >batas → pesan jelas. ✔
5. Halaman tidak pernah menampilkan error PHP mentah. ✔