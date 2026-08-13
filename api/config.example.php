<?php
// ============================================================
// SDMPKS - Konfigurasi Aplikasi (CONTOH)
// ------------------------------------------------------------
// CARA PAKAI:
//   1. Salin file ini menjadi "config.php" di folder yang sama:
//        cp config.example.php config.php   (Linux / Mac)
//        copy config.example.php config.php (Windows)
//   2. Sesuaikan kredensial database di bawah dengan lingkungan Anda.
//   3. Jangan pernah mengunggah "config.php" ke repository publik.
// ============================================================

// ----- Koneksi Database MySQL / MariaDB -----
define('DB_HOST', '127.0.0.1');
define('DB_NAME', 'sdmpks_db');
define('DB_USER', 'root');
define('DB_PASS', '');

// ----- Akun admin bawaan (dipakai installer/seed) -----
define('INSTALL_ADMIN_USER', 'admin');
define('INSTALL_ADMIN_PASS', 'admin123');

// ----- Sesi: cookie Secure (saat HTTPS) + httponly + SameSite=Lax -----
require_once __DIR__ . '/security.php';

if (session_status() === PHP_SESSION_NONE) {
    sd_session_cookie_secure();
    session_set_cookie_params([
        'httponly' => true,
        'samesite' => 'Lax',
        'path' => '/',
    ]);
    session_start();
}
