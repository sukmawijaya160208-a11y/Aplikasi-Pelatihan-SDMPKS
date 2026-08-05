<?php
// ============================================================
// SDMPKS - API Kelembagaan
// act: list (semua role sesuai scope) | save | delete | logo
// ============================================================
require_once __DIR__ . '/db.php';

$act = $_GET['act'] ?? '';

if ($act === 'list') {
    $u = guard_role();
    // Dinas & admin: semua lembaga + statistik. Lembaga: hanya miliknya.
    $sql = 'SELECT l.id, l.jenis_lembaga, l.singkatan, l.nama_lembaga, l.ketua, l.jabatan, l.alamat, l.tempat,
                   l.kode_surat, l.tahun_anggaran, l.kepala_desa, l.logo,
                   COUNT(p.id) AS total_pekebun,
                   SUM(CASE WHEN p.status = "diajukan" THEN 1 ELSE 0 END) AS menunggu,
                   SUM(CASE WHEN p.status = "disetujui" THEN 1 ELSE 0 END) AS disetujui,
                   SUM(CASE WHEN p.status = "dikembalikan" THEN 1 ELSE 0 END) AS dikembalikan
            FROM lembaga l
            LEFT JOIN pekebun p ON p.lembaga_id = l.id';
    $params = [];
    if ($u['role'] === 'lembaga') {
        $sql .= ' WHERE l.id = ?';
        $params[] = $u['lembaga_id'];
    }
    $sql .= ' GROUP BY l.id ORDER BY l.nama_lembaga';
    $st = pdo()->prepare($sql);
    $st->execute($params);
    $rows = $st->fetchAll();
    foreach ($rows as &$r) {
        $r['total_pekebun'] = (int)$r['total_pekebun'];
        $r['menunggu'] = (int)$r['menunggu'];
        $r['disetujui'] = (int)$r['disetujui'];
        $r['dikembalikan'] = (int)$r['dikembalikan'];
    }
    unset($r);
    json_ok(['rows' => $rows]);
}

if ($act === 'save') {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') json_err('Metode tidak diizinkan.', 405);
    can('lembaga.kelola');
    $d = body();
    $id = (int)($d['id'] ?? 0);
    $nama = trim((string)($d['nama_lembaga'] ?? ''));
    if ($nama === '') json_err('Nama kelembagaan wajib diisi.');

    $fields = [
        'nama_lembaga' => $nama,
        'jenis_lembaga' => trim((string)($d['jenis_lembaga'] ?? 'KOPERASI UNIT DESA (KUD)')),
        'singkatan' => trim((string)($d['singkatan'] ?? '')),
        'ketua' => trim((string)($d['ketua'] ?? '')),
        'jabatan' => trim((string)($d['jabatan'] ?? '')),
        'alamat' => trim((string)($d['alamat'] ?? '')),
        'tempat' => trim((string)($d['tempat'] ?? '')),
        'kode_surat' => trim((string)($d['kode_surat'] ?? 'KUD-SS/MURA')),
        'tahun_anggaran' => trim((string)($d['tahun_anggaran'] ?? date('Y'))),
        'kepala_desa' => trim((string)($d['kepala_desa'] ?? '')),
    ];

    if ($id > 0) {
        $st = pdo()->prepare(
            'UPDATE lembaga SET nama_lembaga=?, jenis_lembaga=?, singkatan=?, ketua=?, jabatan=?, alamat=?, tempat=?, kode_surat=?, tahun_anggaran=?, kepala_desa=? WHERE id=?'
        );
        $st->execute([
            $fields['nama_lembaga'], $fields['jenis_lembaga'], $fields['singkatan'], $fields['ketua'], $fields['jabatan'],
            $fields['alamat'], $fields['tempat'], $fields['kode_surat'], $fields['tahun_anggaran'],
            $fields['kepala_desa'], $id,
        ]);
        json_ok(['id' => $id]);
    } else {
        $st = pdo()->prepare(
            'INSERT INTO lembaga (nama_lembaga, jenis_lembaga, singkatan, ketua, jabatan, alamat, tempat, kode_surat, tahun_anggaran, kepala_desa) VALUES (?,?,?,?,?,?,?,?,?,?)'
        );
        $st->execute([
            $fields['nama_lembaga'], $fields['jenis_lembaga'], $fields['singkatan'], $fields['ketua'], $fields['jabatan'],
            $fields['alamat'], $fields['tempat'], $fields['kode_surat'], $fields['tahun_anggaran'],
            $fields['kepala_desa'],
        ]);
        json_ok(['id' => (int)pdo()->lastInsertId()]);
    }
}

if ($act === 'delete') {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') json_err('Metode tidak diizinkan.', 405);
    can('lembaga.kelola');
    $d = body();
    $id = (int)($d['id'] ?? 0);
    if ($id <= 0) json_err('ID kelembagaan tidak valid.');
    $st = pdo()->prepare('SELECT username FROM users WHERE lembaga_id = ?');
    $st->execute([$id]);
    $usernames = $st->fetchAll(PDO::FETCH_COLUMN);
    if ($usernames) {
        $n = count($usernames);
        json_err('Lembaga masih memiliki ' . $n . ' akun pengguna (' . implode(', ', $usernames) . '). Hapus akun tersebut terlebih dahulu di menu Akun Pengguna.');
    }
    $st = pdo()->prepare('DELETE FROM lembaga WHERE id = ?');
    $st->execute([$id]);
    json_ok();
}

if ($act === 'logo') {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') json_err('Metode tidak diizinkan.', 405);
    if (current_user()['role'] === 'lembaga') {
        can('pengaturan.ubah');
    } else {
        can('lembaga.kelola');
    }
    $u = current_user();
    $d = body();
    $id = (int)($d['id'] ?? 0); // untuk admin: id lembaga tujuan
    if ($u['role'] === 'lembaga') $id = (int)$u['lembaga_id'];
    if ($id <= 0) json_err('ID kelembagaan tidak valid.');
    $logo = (string)($d['logo'] ?? '');
    $logo = substr($logo, 0, 2 * 1024 * 1024); // batas 2MB
    $st = pdo()->prepare('UPDATE lembaga SET logo = ? WHERE id = ?');
    $st->execute([$logo !== '' ? $logo : null, $id]);
    json_ok();
}

json_err('Aksi tidak dikenal.', 404);
