<?php
// ============================================================
// SDMPKS - API Autentikasi
// act: login | logout | me | change_password
// ============================================================
require_once __DIR__ . '/db.php';

$act = $_GET['act'] ?? '';

if ($act === 'login') {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') json_err('Metode tidak diizinkan.', 405);
    $d = body();
    $u = trim((string)($d['username'] ?? ''));
    $p = (string)($d['password'] ?? '');
    $role = trim((string)($d['role'] ?? ''));
    if ($u === '' || $p === '') json_err('Username dan password wajib diisi.');

    // Anti brute-force: blokir 15 menit setelah 5 percobaan gagal
    // per kombinasi IP + username.
    $rlKey = 'login:' . sd_client_ip() . ':' . mb_strtolower($u);
    $sisa = rate_limit_hit($rlKey);
    if ($sisa > 0) {
        json_err('Terlalu banyak percobaan. Coba lagi dalam ' . ceil($sisa / 60) . ' menit.', 429, 'rate_limited', ['menit' => ceil($sisa / 60)]);
    }

    $st = pdo()->prepare(
        'SELECT u.*, l.nama_lembaga
         FROM users u LEFT JOIN lembaga l ON l.id = u.lembaga_id
         WHERE u.username = ?'
    );
    $st->execute([$u]);
    $row = $st->fetch();
    if (!$row || !password_verify($p, $row['password'])) {
        rate_limit_fail($rlKey);
        json_err('Username atau password salah. Silakan coba lagi.');
    }
    if ((int)$row['aktif'] !== 1) {
        if ($row['role'] === 'lembaga') {
            json_err('Akun lembaga Anda belum disetujui oleh Administrator. Silakan hubungi administrator.');
        }
        json_err('Akun Anda dinonaktifkan. Hubungi administrator.');
    }
    if ($role !== '' && $row['role'] !== $role) {
        json_err('Akun tidak sesuai dengan role yang dipilih.');
    }

    // Login sukses: bersihkan riwayat kegagalan + sesi baru.
    rate_limit_clear($rlKey);
    session_regenerate_id(true);
    $_SESSION['user'] = [
        'id' => (int)$row['id'],
        'username' => $row['username'],
        'nama' => $row['nama'],
        'role' => $row['role'],
        'lembaga_id' => $row['lembaga_id'] !== null ? (int)$row['lembaga_id'] : null,
        'lembaga_nama' => (string)($row['nama_lembaga'] ?? ''),
    ];
    $_SESSION['last_activity'] = time();
    json_ok(['user' => $_SESSION['user'], 'csrf' => csrf_token()]);
}

if ($act === 'logout') {
    $_SESSION = [];
    if (ini_get('session.use_cookies')) {
        $p = session_get_cookie_params();
        setcookie(session_name(), '', time() - 42000, $p['path'], $p['domain'], $p['secure'], $p['httponly']);
    }
    session_destroy();
    json_ok();
}

if ($act === 'me') {
    $u = current_user();
    if (!$u) json_err('Sesi berakhir.', 401);
    json_ok(['user' => $u, 'csrf' => csrf_token()]);
}

if ($act === 'forgot_password') {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') json_err('Metode tidak diizinkan.', 405);
    $d = body();
    $u = trim((string)($d['username'] ?? ''));
    if ($u === '') json_err('Username wajib diisi.');

    // Anti spam: maksimal 3 permintaan per 60 menit per IP.
    $rlKey = 'forgot:' . sd_client_ip();
    $sisa = rate_limit_hit($rlKey, 3, 3600, 3600);
    if ($sisa > 0) {
        json_err('Terlalu banyak permintaan. Coba lagi dalam ' . ceil($sisa / 60) . ' menit.', 429, 'rate_limited');
    }
    // Setiap permintaan tercatat (entah akun ada atau tidak).
    rate_limit_fail($rlKey, 3600);

    // Jangan bocorkan apakah akun terdaftar (anti user-enumeration):
    // tanggapan selalu sama, apakah akun ada atau tidak.
    $found = null;
    $st = pdo()->prepare('SELECT id, username, nama, role FROM users WHERE username = ? LIMIT 1');
    $st->execute([$u]);
    $found = $st->fetch();

    if ($found) {
        kirim_notifikasi(
            'admin',
            'Permintaan reset password',
            'Akun "' . $found['username'] . '" (' . $found['nama'] . ') meminta reset password. Silakan reset dari menu Kelola Akun lalu sampaikan password baru via WhatsApp.',
            'warning',
            null
        );
        // Catat ke audit log (file, bukan DB).
        @file_put_contents(
            __DIR__ . '/../storage/audit.log',
            '[' . date('c') . '] forgot_password user=' . $found['username'] . ' ip=' . sd_client_ip() . PHP_EOL,
            FILE_APPEND | LOCK_EX
        );
    } else {
        // tetap catat percobaan agar bisa dipantau
        @file_put_contents(
            __DIR__ . '/../storage/audit.log',
            '[' . date('c') . '] forgot_password UNKNOWN user=' . $u . ' ip=' . sd_client_ip() . PHP_EOL,
            FILE_APPEND | LOCK_EX
        );
    }

    json_ok(['pesan' => 'Jika akun terdaftar, permintaan Anda telah diteruskan ke Administrator. Anda akan dihubungi via WhatsApp oleh petugas.']);
}

if ($act === 'change_password') {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') json_err('Metode tidak diizinkan.', 405);
    $u = guard_role();
    $d = body();
    $old = (string)($d['old'] ?? '');
    $new = (string)($d['new'] ?? '');
    if (strlen($new) < 8) json_err('Password baru minimal 8 karakter.');
    $st = pdo()->prepare('SELECT password FROM users WHERE id = ?');
    $st->execute([$u['id']]);
    $row = $st->fetch();
    if (!$row || !password_verify($old, $row['password'])) json_err('Password lama salah.');
    $up = pdo()->prepare('UPDATE users SET password = ? WHERE id = ?');
    $up->execute([password_hash($new, PASSWORD_DEFAULT), $u['id']]);
    json_ok();
}

json_err('Aksi tidak dikenal.', 404);
