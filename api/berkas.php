<?php
// ============================================================
// SDMPKS - API Usulan / Verifikasi Berkas
// act: list (grouped per lembaga utk dinas/admin) | ajukan | setujui | kembalikan | riwayat
// ============================================================
require_once __DIR__ . '/db.php';

function now_mysql(): string
{
    return (string)pdo()->query('SELECT NOW()')->fetchColumn();
}

function pekebun_by_id(int $id): ?array
{
    $st = pdo()->prepare('SELECT * FROM pekebun WHERE id = ?');
    $st->execute([$id]);
    return $st->fetch() ?: null;
}

function can_act(int $id): array
{
    $u = current_user();
    $row = pekebun_by_id($id);
    if (!$row) json_err('Data pekebun tidak ditemukan.', 404);
    if ($u['role'] === 'lembaga' && (int)$row['lembaga_id'] !== (int)$u['lembaga_id']) {
        json_err('Anda tidak memiliki izin atas data ini.', 403);
    }
    return $row;
}

$act = $_GET['act'] ?? '';

if ($act === 'list') {
    $u = guard_role('admin', 'dinas', 'lembaga');
    if ($u['role'] === 'lembaga') {
        // Lembaga: usulan miliknya
        $st = pdo()->prepare(
            'SELECT p.id, p.lembaga_id, p.nama, p.nik, p.no_kk, p.jk, p.tempat_lahir, p.tanggal_lahir,
                    p.jenis_pelatihan, p.jalur, p.alamat, p.hp, p.desa, p.provinsi, p.kabupaten, p.kecamatan,
                    p.kepala_desa, p.status, p.tgl_input, p.tgl_diajukan, p.tgl_verifikasi, p.verifikator, p.alasan
             FROM pekebun p WHERE lembaga_id = ? ORDER BY p.id DESC'
        );
        $st->execute([$u['lembaga_id']]);
        json_ok(['rows' => $st->fetchAll()]);
    } else {
        // Dinas/Admin: dikelompokkan per lembaga
        $sql = 'SELECT l.id AS lembaga_id, l.nama_lembaga, l.kode_surat, l.tempat, l.tahun_anggaran, l.batas_usulan,
                       COUNT(p.id) AS total,
                       SUM(CASE WHEN p.status = "diajukan" THEN 1 ELSE 0 END) AS menunggu,
                       SUM(CASE WHEN p.status = "disetujui" THEN 1 ELSE 0 END) AS disetujui,
                       SUM(CASE WHEN p.status = "dikembalikan" THEN 1 ELSE 0 END) AS dikembalikan
                FROM lembaga l
                LEFT JOIN pekebun p ON p.lembaga_id = l.id
                GROUP BY l.id ORDER BY l.nama_lembaga';
        $groups = pdo()->query($sql)->fetchAll();

        $rows = [];
        $st = pdo()->prepare(
            'SELECT p.id, p.lembaga_id, p.nama, p.nik, p.no_kk, p.jk, p.tempat_lahir, p.tanggal_lahir,
                    p.jenis_pelatihan, p.jalur, p.alamat, p.hp, p.desa, p.provinsi, p.kabupaten, p.kecamatan,
                    p.kepala_desa, p.agama, p.pekerjaan, p.jalan_rt_rw, p.nib, p.status_tanah, p.dipergunakan,
                    p.batas_utara, p.batas_timur, p.batas_selatan, p.batas_barat, p.tahun_kuasai, p.perolehan_dari,
                    p.perolehan_sejak, p.saksi1_nama, p.saksi1_umur, p.saksi1_pekerjaan, p.saksi1_alamat,
                    p.saksi2_nama, p.saksi2_umur, p.saksi2_pekerjaan, p.saksi2_alamat, p.luas_lahan, p.no_shm,
                    p.pemilik_sebelumnya, p.status, p.tgl_input, p.tgl_diajukan, p.tgl_verifikasi,
                    p.verifikator, p.alasan,
                    COALESCE(l.nama_lembaga, "") AS lembaga_nama
             FROM pekebun p LEFT JOIN lembaga l ON l.id = p.lembaga_id
             ORDER BY p.id DESC LIMIT 10000'
        );
        $st->execute();
        foreach ($st->fetchAll() as $p) {
            $rows[] = $p;
        }
        foreach ($groups as &$g) {
            $g['total'] = (int)$g['total'];
            $g['menunggu'] = (int)$g['menunggu'];
            $g['disetujui'] = (int)$g['disetujui'];
            $g['dikembalikan'] = (int)$g['dikembalikan'];
        }
        unset($g);
        json_ok(['groups' => $groups, 'rows' => $rows]);
    }
}

if ($act === 'ajukan') {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') json_err('Metode tidak diizinkan.', 405);
    can('usulan.ajukan');
    $d = body();
    $row = can_act((int)($d['id'] ?? 0));
    if (!in_array($row['status'], ['draft', 'dikembalikan'], true)) {
        json_err('Berkas tidak dapat diajukan pada status ini.');
    }
    $cDoc = pdo()->prepare('SELECT COUNT(*) FROM dokumen WHERE pekebun_id = ?');
    $cDoc->execute([$row['id']]);
    if ((int)$cDoc->fetchColumn() === 0) {
        json_err('Upload dokumen (PDF, maks. 5 MB) pekebun terlebih dahulu sebelum mengajukan.');
    }

    // ---- Batas waktu usulan (kunci otomatis oleh dinas) ----
    $lem = pdo()->prepare('SELECT batas_usulan, tahun_anggaran FROM lembaga WHERE id = ?');
    $lem->execute([$row['lembaga_id']]);
    $lemRow = $lem->fetch() ?: [];
    $tahun = trim((string)($lemRow['tahun_anggaran'] ?? ''));
    if ($tahun === '' || !preg_match('/^\d{4}$/', $tahun)) $tahun = date('Y');
    $batas = $lemRow['batas_usulan'] ?? null;
    // Bandingkan berbasis teks terhadap jam PHP (now_mysql) agar konsisten
    // dengan penyimpanan via save_batas — bukan strtotime vs time() yang
    // bisa meleset bila jam MySQL berbeda dengan jam PHP.
    if ($batas && strcmp((string)$batas, now_mysql()) < 0) {
        json_err(
            'Batas waktu pengajuan usulan telah berakhir pada ' . date('d M Y H:i', strtotime($batas)) . '. Usulan ke Dinas Perkebunan terkunci otomatis. Input dan perbaikan data pekebun tetap dapat dilakukan.',
            423,
            'batas_berakhir',
            ['batas' => $batas, 'tahun' => $tahun]
        );
    }

    // ---- Satu KK = satu NIK usulan per tahun anggaran ----
    $cek = pdo()->prepare(
        'SELECT id, nama, nik, no_kk, status FROM pekebun
         WHERE id <> ? AND status IN ("diajukan","disetujui","dikembalikan") AND YEAR(tgl_diajukan) = ?
         AND lembaga_id = ?'
    );
    if ($row['no_kk'] !== '') {
        $cek->execute([$row['id'], $tahun, $row['lembaga_id']]);
        $kkRows = [];
        foreach ($cek->fetchAll() as $r) {
            if (($r['no_kk'] ?? '') !== '' && $r['no_kk'] === $row['no_kk']) $kkRows[] = $r;
        }
        if ($kkRows) {
            $ex = $kkRows[0];
            json_err(
                'Kartu Keluarga No. ' . $row['no_kk'] . ' telah mengusulkan usulan pelatihan SDMPKS pada Tahun Anggaran ' . $tahun . ' atas nama ' . $ex['nama'] . ' (NIK ' . $ex['nik'] . '). Hanya satu NIK yang dapat diusulkan per Kartu Keluarga dalam satu tahun anggaran.',
                422,
                'kk_terpakai',
                ['nama' => $ex['nama'], 'nik' => $ex['nik'], 'no_kk' => $row['no_kk'], 'tahun' => $tahun, 'status' => $ex['status']]
            );
        }
    }
    // ---- NIK tidak boleh ganda sebagai usulan ----
    $cek->execute([$row['id'], $tahun, $row['lembaga_id']]);
    foreach ($cek->fetchAll() as $r) {
        if (($r['nik'] ?? '') !== '' && $r['nik'] === $row['nik']) {
            json_err(
                'NIK ' . $row['nik'] . ' telah diusulkan pada Tahun Anggaran ' . $tahun . ' atas nama ' . $r['nama'] . '. NIK tidak dapat diajukan lebih dari satu kali.',
                422,
                'nik_terpakai',
                ['nama' => $r['nama'], 'nik' => $row['nik'], 'tahun' => $tahun, 'status' => $r['status']]
            );
        }
    }

    $riwayat = json_decode((string)($row['riwayat'] ?? '[]'), true) ?: [];
    $riwayat[] = ['aksi' => 'diajukan', 'tgl' => now_mysql(), 'oleh' => 'Lembaga Pekebun'];
    $st = pdo()->prepare(
        'UPDATE pekebun SET status = "diajukan", tgl_diajukan = ?, alasan = NULL, riwayat = ? WHERE id = ?'
    );
    $st->execute([now_mysql(), json_encode($riwayat, JSON_UNESCAPED_UNICODE), $row['id']]);

    kirim_notifikasi('dinas', 'Usulan baru masuk', $row['nama'] . ' (NIK ' . $row['nik'] . ') dari lembaga mengajukan usulan.', 'info', 'usulan');
    kirim_notifikasi('admin', 'Usulan baru masuk', $row['nama'] . ' (NIK ' . $row['nik'] . ') dari lembaga mengajukan usulan.', 'info', 'usulan');
    json_ok();
}

if ($act === 'setujui') {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') json_err('Metode tidak diizinkan.', 405);
    $u = can('usulan.setujui');
    $d = body();
    $row = pekebun_by_id((int)($d['id'] ?? 0));
    if (!$row) json_err('Data pekebun tidak ditemukan.', 404);
    if ($row['status'] !== 'diajukan') json_err('Berkas tidak dapat disetujui pada status ini.');
    $riwayat = json_decode((string)($row['riwayat'] ?? '[]'), true) ?: [];
    $riwayat[] = ['aksi' => 'disetujui', 'tgl' => now_mysql(), 'oleh' => $u['nama'] ?: 'Dinas Perkebunan'];
    $st = pdo()->prepare(
        'UPDATE pekebun SET status = "disetujui", tgl_verifikasi = ?, verifikator = ?, alasan = NULL, riwayat = ? WHERE id = ?'
    );
    $st->execute([now_mysql(), $u['nama'] ?: 'Dinas Perkebunan', json_encode($riwayat, JSON_UNESCAPED_UNICODE), $row['id']]);

    kirim_notifikasi_lembaga((int)$row['lembaga_id'], 'Usulan disetujui', 'Usulan "' . $row['nama'] . '" disetujui oleh ' . ($u['nama'] ?: 'Dinas Perkebunan') . '.', 'sukses', 'pengajuan');
    kirim_notifikasi('admin', 'Usulan disetujui', 'Usulan "' . $row['nama'] . '" disetujui oleh ' . ($u['nama'] ?: 'Dinas Perkebunan') . '.', 'sukses', 'usulan');
    json_ok();
}

if ($act === 'kembalikan') {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') json_err('Metode tidak diizinkan.', 405);
    $u = can('usulan.kembalikan');
    $d = body();
    $row = pekebun_by_id((int)($d['id'] ?? 0));
    if (!$row) json_err('Data pekebun tidak ditemukan.', 404);
    if ($row['status'] !== 'diajukan') json_err('Berkas tidak dapat dikembalikan pada status ini.');
    $catatan = trim((string)($d['alasan'] ?? ''));
    if ($catatan === '') json_err('Keterangan penolakan / perbaikan wajib diisi.');
    $riwayat = json_decode((string)($row['riwayat'] ?? '[]'), true) ?: [];
    $riwayat[] = ['aksi' => 'dikembalikan', 'tgl' => now_mysql(), 'oleh' => $u['nama'] ?: 'Dinas Perkebunan', 'catatan' => $catatan];
    $st = pdo()->prepare(
        'UPDATE pekebun SET status = "dikembalikan", tgl_verifikasi = ?, verifikator = ?, alasan = ?, riwayat = ? WHERE id = ?'
    );
    $st->execute([now_mysql(), $u['nama'] ?: 'Dinas Perkebunan', $catatan, json_encode($riwayat, JSON_UNESCAPED_UNICODE), $row['id']]);

    kirim_notifikasi_lembaga((int)$row['lembaga_id'], 'Usulan dikembalikan', 'Usulan "' . $row['nama'] . '" dikembalikan untuk diperbaiki. Alasan: ' . $catatan, 'peringatan', 'pengajuan');
    kirim_notifikasi('admin', 'Usulan dikembalikan', 'Usulan "' . $row['nama'] . '" dikembalikan oleh ' . ($u['nama'] ?: 'Dinas Perkebunan') . '.', 'peringatan', 'usulan');
    json_ok();
}

if ($act === 'batalkan') {
    // Dinas/Admin: membatalkan keputusan usulan yang SUDAH DISETUJUI
    // kembali ke draft agar dapat diajukan ulang / direvisi oleh lembaga.
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') json_err('Metode tidak diizinkan.', 405);
    $u = can('usulan.batalkan');
    $d = body();
    $row = pekebun_by_id((int)($d['id'] ?? 0));
    if (!$row) json_err('Data pekebun tidak ditemukan.', 404);
    if ($row['status'] !== 'disetujui') json_err('Hanya usulan berstatus Disetujui yang dapat dibatalkan.');
    $catatan = trim((string)($d['alasan'] ?? ''));
    $riwayat = json_decode((string)($row['riwayat'] ?? '[]'), true) ?: [];
    $riwayat[] = ['aksi' => 'dibatalkan', 'tgl' => now_mysql(), 'oleh' => $u['nama'] ?: 'Dinas Perkebunan', 'catatan' => $catatan];
    $st = pdo()->prepare(
        'UPDATE pekebun SET status = "draft", tgl_verifikasi = NULL, verifikator = NULL, alasan = NULL, riwayat = ? WHERE id = ?'
    );
    $st->execute([json_encode($riwayat, JSON_UNESCAPED_UNICODE), $row['id']]);

    $notif = 'Usulan "' . $row['nama'] . '" dibatalkan oleh ' . ($u['nama'] ?: 'Dinas Perkebunan') . ($catatan !== '' ? '. Alasan: ' . $catatan : '') . '. Silakan ajukan ulang.';
    kirim_notifikasi_lembaga((int)$row['lembaga_id'], 'Usulan dibatalkan', $notif, 'peringatan', 'pengajuan');
    kirim_notifikasi('admin', 'Usulan dibatalkan', 'Usulan "' . $row['nama'] . '" dibatalkan oleh ' . ($u['nama'] ?: 'Dinas Perkebunan') . '.', 'peringatan', 'usulan');
    json_ok();
}

if ($act === 'override') {
    // Override darurat (hanya admin): membuka usulan yang sudah disetujui
    // agar dapat diperbaiki/diajukan ulang oleh lembaga.
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') json_err('Metode tidak diizinkan.', 405);
    $u = can('usulan.override');
    $d = body();
    $row = pekebun_by_id((int)($d['id'] ?? 0));
    if (!$row) json_err('Data pekebun tidak ditemukan.', 404);
    if ($row['status'] !== 'disetujui') json_err('Override hanya berlaku untuk usulan berstatus Disetujui.');
    $catatan = trim((string)($d['alasan'] ?? ''));
    if ($catatan === '') json_err('Alasan override wajib diisi.');
    $target = in_array(($d['status'] ?? ''), ['draft', 'dikembalikan'], true) ? $d['status'] : 'dikembalikan';
    $riwayat = json_decode((string)($row['riwayat'] ?? '[]'), true) ?: [];
    $riwayat[] = ['aksi' => 'dioverride', 'tgl' => now_mysql(), 'oleh' => $u['nama'] ?: 'Administrator', 'catatan' => $catatan];
    $st = pdo()->prepare(
        'UPDATE pekebun SET status = ?, alasan = ?, riwayat = ? WHERE id = ?'
    );
    $st->execute([$target, $catatan, json_encode($riwayat, JSON_UNESCAPED_UNICODE), $row['id']]);

    kirim_notifikasi_lembaga((int)$row['lembaga_id'], 'Override oleh administrator', 'Status usulan "' . $row['nama'] . '" dibuka kembali oleh administrator. Alasan: ' . $catatan, 'peringatan', 'pengajuan');
    kirim_notifikasi('dinas', 'Override usulan', 'Usulan "' . $row['nama'] . '" dibuka kembali oleh administrator.', 'peringatan', 'usulan');
    json_ok();
}

if ($act === 'riwayat') {
    guard_role();
    $row = can_act((int)($_GET['id'] ?? 0));
    json_ok(['riwayat' => json_decode((string)($row['riwayat'] ?? '[]'), true) ?: []]);
}

json_err('Aksi tidak dikenal.', 404);
