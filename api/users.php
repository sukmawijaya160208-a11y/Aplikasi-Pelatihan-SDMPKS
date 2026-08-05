<?php
// ============================================================
// SDMPKS - API Pengguna (khusus admin)
// act: list | create | update | reset_password | toggle | delete
// ============================================================
require_once __DIR__ . '/db.php';

can('akun.kelola');

$act = $_GET['act'] ?? '';

if ($act === 'list') {
    $q = trim((string)($_GET['search'] ?? ''));
    $role = trim((string)($_GET['role'] ?? ''));
    $lembagaId = (int)($_GET['lembaga_id'] ?? 0);

    $sql = 'SELECT u.id, u.username, u.nama, u.role, u.aktif, u.lembaga_id, u.created_at,
                   COALESCE(l.nama_lembaga, "") AS lembaga_nama
            FROM users u LEFT JOIN lembaga l ON l.id = u.lembaga_id
            WHERE 1=1';
    $params = [];
    if ($q !== '') {
        $sql .= ' AND (u.username LIKE ? OR u.nama LIKE ?)';
        $params[] = "%$q%";
        $params[] = "%$q%";
    }
    if ($role !== '') {
        $sql .= ' AND u.role = ?';
        $params[] = $role;
    }
    if ($lembagaId > 0) {
        $sql .= ' AND u.lembaga_id = ?';
        $params[] = $lembagaId;
    }
    $sql .= ' ORDER BY u.role, u.nama';
    $st = pdo()->prepare($sql);
    $st->execute($params);
    json_ok(['rows' => $st->fetchAll()]);
}

if ($act === 'create' || $act === 'update') {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') json_err('Metode tidak diizinkan.', 405);
    $d = body();
    $id = (int)($d['id'] ?? 0);
    $username = trim((string)($d['username'] ?? ''));
    $nama = trim((string)($d['nama'] ?? ''));
    $role = trim((string)($d['role'] ?? ''));
    $lembagaId = (int)($d['lembaga_id'] ?? 0);
    $aktif = isset($d['aktif']) ? (!empty($d['aktif']) ? 1 : 0) : 1;
    $password = (string)($d['password'] ?? '');

    if (!in_array($role, ['admin', 'dinas', 'lembaga'], true)) json_err('Role tidak valid.');
    if ($username === '' || !preg_match('/^[a-zA-Z0-9_.-]{3,50}$/', $username)) {
        json_err('Username minimal 3 karakter (huruf/angka/._-).');
    }
    if ($nama === '') json_err('Nama lengkap wajib diisi.');
    if ($role === 'lembaga' && $lembagaId <= 0) json_err('Pilih kelembagaan untuk akun lembaga.');

    // cek duplikasi username (kecuali dirinya sendiri)
    $chk = pdo()->prepare('SELECT id FROM users WHERE username = ? AND id <> ?');
    $chk->execute([$username, $id]);
    if ($chk->fetch()) json_err('Username "' . $username . '" sudah digunakan.');

    // proteksi: admin tidak boleh menonaktifkan/menurunkan akunnya sendiri
    $self = can('akun.kelola');
    if ($id === $self['id'] && ($act === 'update')) {
        if ((int)$aktif !== 1) json_err('Tidak dapat menonaktifkan akun Anda sendiri.');
        if ($role !== 'admin') json_err('Tidak dapat mengubah role akun Anda sendiri.');
    }

    if ($act === 'create') {
        if (strlen($password) < 6) json_err('Password minimal 6 karakter.');
        $st = pdo()->prepare('INSERT INTO users (username, password, nama, role, lembaga_id, aktif) VALUES (?,?,?,?,?,?)');
        $st->execute([$username, password_hash($password, PASSWORD_DEFAULT), $nama, $role, $role === 'lembaga' ? $lembagaId : null, $aktif]);
        json_ok(['id' => (int)pdo()->lastInsertId()]);
    } else {
        if ($id <= 0) json_err('ID akun tidak valid.');
        $st = pdo()->prepare('UPDATE users SET username = ?, nama = ?, role = ?, lembaga_id = ?, aktif = ? WHERE id = ?');
        $st->execute([$username, $nama, $role, $role === 'lembaga' ? $lembagaId : null, $aktif, $id]);
        json_ok();
    }
}

if ($act === 'reset_password') {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') json_err('Metode tidak diizinkan.', 405);
    $d = body();
    $id = (int)($d['id'] ?? 0);
    $password = (string)($d['password'] ?? '');
    if ($id <= 0) json_err('ID akun tidak valid.');
    if (strlen($password) < 6) json_err('Password minimal 6 karakter.');
    $st = pdo()->prepare('UPDATE users SET password = ? WHERE id = ?');
    $st->execute([password_hash($password, PASSWORD_DEFAULT), $id]);
    json_ok();
}

if ($act === 'toggle') {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') json_err('Metode tidak diizinkan.', 405);
    $d = body();
    $id = (int)($d['id'] ?? 0);
    $self = can('akun.kelola');
    if ($id === $self['id']) json_err('Tidak dapat menonaktifkan akun Anda sendiri.');
    $st = pdo()->prepare('UPDATE users SET aktif = 1 - aktif WHERE id = ?');
    $st->execute([$id]);
    json_ok();
}

if ($act === 'delete') {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') json_err('Metode tidak diizinkan.', 405);
    $d = body();
    $id = (int)($d['id'] ?? 0);
    $self = can('akun.kelola');
    if ($id === $self['id']) json_err('Tidak dapat menghapus akun Anda sendiri.');
    $st = pdo()->prepare('DELETE FROM users WHERE id = ?');
    $st->execute([$id]);
    json_ok();
}

json_err('Aksi tidak dikenal.', 404);
