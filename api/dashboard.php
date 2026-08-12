<?php
// ============================================================
// SDMPKS - API Dashboard (statistik per role)
// act: stats
// ============================================================
require_once __DIR__ . '/db.php';

if (($_GET['act'] ?? '') !== 'stats') json_err('Aksi tidak dikenal.', 404);

$u = guard_role();

$out = ['user' => $u];

if ($u['role'] === 'lembaga') {
    $lid = (int)$u['lembaga_id'];
    $st = pdo()->prepare(
        'SELECT COUNT(*) AS total,
                SUM(CASE WHEN jk = "LAKI-LAKI" THEN 1 ELSE 0 END) AS pria,
                SUM(CASE WHEN jk = "PEREMPUAN" THEN 1 ELSE 0 END) AS wanita,
                SUM(CASE WHEN status = "diajukan" THEN 1 ELSE 0 END) AS menunggu,
                SUM(CASE WHEN status = "disetujui" THEN 1 ELSE 0 END) AS disetujui,
                SUM(CASE WHEN status = "dikembalikan" THEN 1 ELSE 0 END) AS dikembalikan
         FROM pekebun WHERE lembaga_id = ?'
    );
    $st->execute([$lid]);
    $s = $st->fetch();
    $out['stats'] = [
        'total' => (int)$s['total'],
        'pria' => (int)$s['pria'],
        'wanita' => (int)$s['wanita'],
        'menunggu' => (int)$s['menunggu'],
        'disetujui' => (int)$s['disetujui'],
        'dikembalikan' => (int)$s['dikembalikan'],
    ];
    $st = pdo()->prepare('SELECT COUNT(*) AS n FROM surat WHERE lembaga_id = ?');
    $st->execute([$lid]);
    $out['stats']['surat'] = (int)$st->fetch()['n'];

    $st = pdo()->prepare(
        'SELECT CASE WHEN jenis_pelatihan = "" THEN "Belum Diisi" ELSE jenis_pelatihan END AS jenis_pelatihan,
                COUNT(*) AS n
         FROM pekebun WHERE lembaga_id = ?
         GROUP BY jenis_pelatihan
         ORDER BY (jenis_pelatihan = ""), n DESC'
    );
    $st->execute([$lid]);
    $out['stats']['per_pelatihan'] = array_map(function ($r) {
        $r['n'] = (int)$r['n'];
        return $r;
    }, $st->fetchAll());

    $st = pdo()->prepare('SELECT * FROM pekebun WHERE lembaga_id = ? ORDER BY id DESC LIMIT 5');
    $st->execute([$lid]);
    $out['recent'] = $st->fetchAll();

    // bulanan 6 bulan terakhir (milik sendiri)
    $st = pdo()->prepare(
        "SELECT DATE_FORMAT(tgl_input, '%Y-%m') AS bulan, COUNT(*) AS n
         FROM pekebun WHERE lembaga_id = ? AND tgl_input >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
         GROUP BY bulan ORDER BY bulan"
    );
    $st->execute([$lid]);
    $out['bulanan'] = $st->fetchAll();
} else {
    // admin & dinas: lintas lembaga
    $st = pdo()->query(
        'SELECT COUNT(*) AS total,
                SUM(CASE WHEN jk = "LAKI-LAKI" THEN 1 ELSE 0 END) AS pria,
                SUM(CASE WHEN jk = "PEREMPUAN" THEN 1 ELSE 0 END) AS wanita,
                SUM(CASE WHEN status = "diajukan" THEN 1 ELSE 0 END) AS menunggu,
                SUM(CASE WHEN status = "disetujui" THEN 1 ELSE 0 END) AS disetujui,
                SUM(CASE WHEN status = "dikembalikan" THEN 1 ELSE 0 END) AS dikembalikan
         FROM pekebun'
    );
    $s = $st->fetch();
    $out['stats'] = [
        'total' => (int)$s['total'],
        'pria' => (int)$s['pria'],
        'wanita' => (int)$s['wanita'],
        'menunggu' => (int)$s['menunggu'],
        'disetujui' => (int)$s['disetujui'],
        'dikembalikan' => (int)$s['dikembalikan'],
    ];
    $out['stats']['lembaga'] = (int)pdo()->query('SELECT COUNT(*) FROM lembaga')->fetchColumn();
    $out['stats']['surat'] = (int)pdo()->query('SELECT COUNT(*) FROM surat')->fetchColumn();
    $out['stats']['per_pelatihan'] = array_map(function ($r) {
        $r['n'] = (int)$r['n'];
        return $r;
    }, pdo()->query(
        'SELECT CASE WHEN jenis_pelatihan = "" THEN "Belum Diisi" ELSE jenis_pelatihan END AS jenis_pelatihan,
                COUNT(*) AS n
         FROM pekebun
         GROUP BY jenis_pelatihan
         ORDER BY (jenis_pelatihan = ""), n DESC'
    )->fetchAll());
    if ($u['role'] === 'admin') {
        $out['stats']['akun'] = (int)pdo()->query('SELECT COUNT(*) FROM users')->fetchColumn();
    }

    // per lembaga (chart dinas/admin)
    $out['per_lembaga'] = pdo()->query(
        'SELECT l.id, l.nama_lembaga,
                COUNT(p.id) AS total,
                SUM(CASE WHEN p.status = "diajukan" THEN 1 ELSE 0 END) AS menunggu
         FROM lembaga l LEFT JOIN pekebun p ON p.lembaga_id = l.id
         GROUP BY l.id ORDER BY l.nama_lembaga'
    )->fetchAll();
    foreach ($out['per_lembaga'] as &$g) {
        $g['total'] = (int)$g['total'];
        $g['menunggu'] = (int)$g['menunggu'];
    }
    unset($g);

    $st = pdo()->query(
        'SELECT p.*, COALESCE(l.nama_lembaga, "") AS lembaga_nama
         FROM pekebun p LEFT JOIN lembaga l ON l.id = p.lembaga_id
         ORDER BY p.id DESC LIMIT 8'
    );
    $out['recent'] = $st->fetchAll();

    $st = pdo()->query(
        "SELECT DATE_FORMAT(tgl_input, '%Y-%m') AS bulan, COUNT(*) AS n
         FROM pekebun WHERE tgl_input >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
         GROUP BY bulan ORDER BY bulan"
    );
    $out['bulanan'] = $st->fetchAll();
}

json_ok(['stats' => $out]);
