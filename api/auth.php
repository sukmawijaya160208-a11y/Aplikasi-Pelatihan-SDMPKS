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

    $st = pdo()->prepare(
        'SELECT u.*, l.nama_lembaga
         FROM users u LEFT JOIN lembaga l ON l.id = u.lembaga_id
         WHERE u.username = ?'
    );
    $st->execute([$u]);
    $row = $st->fetch();
    if (!$row || !password_verify($p, $row['password'])) {
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

    session_regenerate_id(true);
    $_SESSION['user'] = [
        'id' => (int)$row['id'],
        'username' => $row['username'],
        'nama' => $row['nama'],
        'role' => $row['role'],
        'lembaga_id' => $row['lembaga_id'] !== null ? (int)$row['lembaga_id'] : null,
        'lembaga_nama' => (string)($row['nama_lembaga'] ?? ''),
    ];
    json_ok(['user' => $_SESSION['user']]);
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
    json_ok(['user' => $u]);
}

if ($act === 'change_password') {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') json_err('Metode tidak diizinkan.', 405);
    $u = guard_role();
    $d = body();
    $old = (string)($d['old'] ?? '');
    $new = (string)($d['new'] ?? '');
    if (strlen($new) < 6) json_err('Password baru minimal 6 karakter.');
    $st = pdo()->prepare('SELECT password FROM users WHERE id = ?');
    $st->execute([$u['id']]);
    $row = $st->fetch();
    if (!$row || !password_verify($old, $row['password'])) json_err('Password lama salah.');
    $up = pdo()->prepare('UPDATE users SET password = ? WHERE id = ?');
    $up->execute([password_hash($new, PASSWORD_DEFAULT), $u['id']]);
    json_ok();
}

json_err('Aksi tidak dikenal.', 404);
