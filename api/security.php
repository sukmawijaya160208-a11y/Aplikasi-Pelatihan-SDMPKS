<?php
// ============================================================
// SDMPKS - Modul Keamanan (ringan, tanpa tabel DB baru)
// ------------------------------------------------------------
// 1. Rate limiter file-based -> storage/ratelimit/ (anti brute-force)
// 2. CSRF token berbasis session (anti cross-site request)
// 3. Idle session timeout (anti sesi menggantung)
//
// Tidak mengubah data/akun yang ada; hanya state sementara di file.
// ============================================================

if (!defined('SD_SEC')) {
    // Jaga agar tidak di-require dua kali secara tidak sengaja.
    define('SD_SEC', true);
}

/** Folder state sementara (di luar webroot dapat diakses, tapi tetap di-gitignore). */
function sd_storage_dir(): string
{
    $dir = __DIR__ . '/../storage/ratelimit';
    if (!is_dir($dir) && !@mkdir($dir, 0755, true)) {
        // fallback ke sys temp bila folder tak bisa dibuat
        $dir = sys_get_temp_dir() . '/sdmpks-ratelimit';
        if (!is_dir($dir)) @mkdir($dir, 0700, true);
    }
    return $dir;
}

/** IP pengunjung (menghormati X-Forwarded-For dari proxy terpercaya). */
function sd_client_ip(): string
{
    $xff = isset($_SERVER['HTTP_X_FORWARDED_FOR']) ? trim((string)$_SERVER['HTTP_X_FORWARDED_FOR']) : '';
    if ($xff !== '' && $xff !== 'unknown') {
        $parts = explode(',', $xff);
        $first = trim($parts[0]);
        if (filter_var($first, FILTER_VALIDATE_IP)) return $first;
    }
    return (string)($_SERVER['REMOTE_ADDR'] ?? '0.0.0.0');
}

/**
 * Tandai cookie sesi sebagai Secure bila berjalan di HTTPS.
 * Dipanggil setelah session_start; berlaku efektif saat next
 * session_regenerate_id() (mis. saat login berhasil).
 */
function sd_session_cookie_secure(): void
{
    $isHttps = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
        || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');
    $p = session_get_cookie_params();
    session_set_cookie_params([
        'lifetime' => $p['lifetime'],
        'path'     => $p['path'],
        'domain'   => $p['domain'],
        'secure'   => $isHttps,
        'httponly' => $p['httponly'],
        'samesite' => $p['samesite'],
    ]);
}

/**
 * Cek rate limit untuk satu "kunci" (mis. ip+username atau ip).
 * @return int 0 bila diizinkan; >0 = sisa detik blokir
 */
function rate_limit_hit(string $key, int $maxFail = 5, int $windowSec = 900, int $blockSec = 900): int
{
    $file = sd_storage_dir() . '/' . md5($key) . '.json';
    $state = ['fails' => [], 'blocked_until' => 0];
    if (is_file($file)) {
        $raw = @file_get_contents($file);
        $d = $raw ? json_decode($raw, true) : null;
        if (is_array($d)) $state = $d;
    }
    $now = time();

    // Sedang diblokir?
    if ((int)$state['blocked_until'] > $now) {
        return (int)$state['blocked_until'] - $now;
    }
    // Bersihkan blokir yang sudah lewat
    $state['blocked_until'] = 0;

    // Sliding window: buang percobaan yang lebih tua dari windowSec
    $fails = array_values(array_filter($state['fails'], fn($t) => $now - (int)$t < $windowSec));

    if (count($fails) >= $maxFail) {
        $state['blocked_until'] = $now + $blockSec;
        @file_put_contents($file, json_encode($state), LOCK_EX);
        return $blockSec;
    }
    $state['fails'] = $fails;
    @file_put_contents($file, json_encode($state), LOCK_EX);
    return 0;
}

/** Catat satu kegagalan (dipanggil saat login salah dll). */
function rate_limit_fail(string $key, int $windowSec = 900): void
{
    $file = sd_storage_dir() . '/' . md5($key) . '.json';
    $state = ['fails' => [], 'blocked_until' => 0];
    if (is_file($file)) {
        $raw = @file_get_contents($file);
        $d = $raw ? json_decode($raw, true) : null;
        if (is_array($d)) $state = $d;
    }
    $now = time();
    $state['fails'][] = $now;
    $state['fails'] = array_values(array_filter($state['fails'], fn($t) => $now - (int)$t < 2 * $windowSec));
    @file_put_contents($file, json_encode($state), LOCK_EX);
}

/** Hapus catatan kegagalan (dipanggil saat login sukses). */
function rate_limit_clear(string $key): void
{
    $file = sd_storage_dir() . '/' . md5($key) . '.json';
    if (is_file($file)) @unlink($file);
}

/**
 * Nama platform web server TANPA versi (hindari bocor versi eksak).
 */
function sd_server_name(): string
{
    $raw = strtolower((string)($_SERVER['SERVER_SOFTWARE'] ?? ''));
    if (strpos($raw, 'nginx') !== false) return 'nginx';
    if (strpos($raw, 'apache') !== false || strpos($raw, 'httpd') !== false) return 'apache';
    if (strpos($raw, 'lite') !== false) return 'litespeed';
    if (strpos($raw, 'iis') !== false) return 'iis';
    return (string)($_SERVER['SERVER_SOFTWARE'] ?? 'unknown');
}

/* ============================================================
   CSRF - token berbasis session, diverifikasi untuk POST/upload
   ============================================================ */

function csrf_token(): string
{
    if (empty($_SESSION['csrf_token'])) {
        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
    }
    return $_SESSION['csrf_token'];
}

/** Daftar act publik yang TIDAK wajib CSRF. */
function csrf_public_act(string $file, string $act): bool
{
    if ($file === 'auth.php' && in_array($act, ['login', 'logout', 'forgot_password'], true)) return true;
    if ($file === 'register.php' && $act === 'register') return true;
    return false;
}

/**
 * Verify CSRF untuk request mutasi (POST/upload) yang bukan action publik.
 * Harus dipanggil SETELAH session dimulai.
 */
function csrf_verify(string $file, string $act): void
{
    if (csrf_public_act($file, $act)) return;
    $token = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
    // Gunakan 403 + code csrf_invalid (bukan 419 yang tidak standar;
    // Apache/XAMPP mengganti 419 dengan 500).
    if ($token === '' || !hash_equals(csrf_token(), $token)) {
        json_err('Token keamanan tidak valid atau sesi kedaluwarsa. Muat ulang halaman lalu coba lagi.', 403, 'csrf_invalid');
    }
}

/* ============================================================
   Idle session timeout (default 30 menit)
   ============================================================ */

function idle_timeout_sec(): int
{
    return 1800;
}

/** Perbarui waktu aktivitas terakhir USER YANG SUDAH LOGIN. */
function session_touch(): void
{
    if (isset($_SESSION['user'])) {
        $_SESSION['last_activity'] = time();
    }
}

/**
 * Cek idle timeout; bila lewat batas, logout-paksa sesi.
 * Dipanggil dari guard/awal setiap API ber-login.
 */
function session_check_idle(): void
{
    if (!isset($_SESSION['user'])) return;
    $last = (int)($_SESSION['last_activity'] ?? 0);
    if ($last > 0 && (time() - $last) > idle_timeout_sec()) {
        $_SESSION = [];
        if (ini_get('session.use_cookies')) {
            $p = session_get_cookie_params();
            setcookie(session_name(), '', time() - 42000, $p['path'], $p['domain'], $p['secure'], $p['httponly']);
        }
        session_destroy();
        json_err('Sesi berakhir karena tidak ada aktivitas. Silakan masuk kembali.', 401, 'session_timeout');
    }
    $_SESSION['last_activity'] = time();
}
