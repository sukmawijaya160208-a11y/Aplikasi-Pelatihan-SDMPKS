<?php
// ============================================================
// SDMPKS - API Arsip Surat
// act: list | next_no | save | delete
// Scope: lembaga -> miliknya; admin -> semua
// ============================================================
require_once __DIR__ . '/db.php';

$act = $_GET['act'] ?? '';

function surat_scope(): int
{
    $u = guard_role('admin', 'lembaga');
    return $u['role'] === 'lembaga' ? (int)$u['lembaga_id'] : 0;
}

if ($act === 'list') {
    $scope = surat_scope();
    $q = trim((string)($_GET['search'] ?? ''));
    $jenis = trim((string)($_GET['jenis'] ?? ''));
    $lembagaId = (int)($_GET['lembaga_id'] ?? 0);

    $sql = 'SELECT s.id, s.lembaga_id, s.pekebun_id, s.jenis, s.jenis_label, s.no_surat, s.nama,
                   s.tanggal, s.tanggal_label, s.created_at,
                   COALESCE(l.nama_lembaga, "") AS lembaga_nama
            FROM surat s LEFT JOIN lembaga l ON l.id = s.lembaga_id
            WHERE 1=1';
    $params = [];
    if ($scope > 0) {
        $sql .= ' AND s.lembaga_id = ?';
        $params[] = $scope;
    } elseif ($lembagaId > 0) {
        $sql .= ' AND s.lembaga_id = ?';
        $params[] = $lembagaId;
    }
    if ($q !== '') {
        $sql .= ' AND (s.no_surat LIKE ? OR s.nama LIKE ? OR s.jenis_label LIKE ?)';
        $params[] = "%$q%";
        $params[] = "%$q%";
        $params[] = "%$q%";
    }
    if ($jenis !== '') {
        $sql .= ' AND s.jenis = ?';
        $params[] = $jenis;
    }
    $sql .= ' ORDER BY s.id DESC LIMIT 5000';
    $st = pdo()->prepare($sql);
    $st->execute($params);
    json_ok(['rows' => $st->fetchAll()]);
}

if ($act === 'detail') {
    $scope = surat_scope();
    $id = (int)($_GET['id'] ?? 0);
    $sql = 'SELECT s.*, COALESCE(l.nama_lembaga, "") AS lembaga_nama
            FROM surat s LEFT JOIN lembaga l ON l.id = s.lembaga_id
            WHERE s.id = ?';
    $st = pdo()->prepare($sql);
    $st->execute([$id]);
    $row = $st->fetch();
    if (!$row) json_err('Surat tidak ditemukan.', 404);
    if ($scope > 0 && (int)$row['lembaga_id'] !== $scope) json_err('Anda tidak memiliki izin atas data ini.', 403);
    json_ok(['row' => $row]);
}

if ($act === 'next_no') {
    $u = guard_role('admin', 'lembaga');
    $jenis = trim((string)($_GET['jenis'] ?? 'koperasi'));
    $lembagaId = $u['role'] === 'lembaga' ? (int)$u['lembaga_id'] : (int)($_GET['lembaga_id'] ?? 0);
    if ($lembagaId <= 0) json_err('Pilih kelembagaan.');
    $st = pdo()->prepare('SELECT nama_lembaga, kode_surat, kode_surat_desa FROM lembaga WHERE id = ?');
    $st->execute([$lembagaId]);
    $l = $st->fetch();
    if (!$l) json_err('Kelembagaan tidak ditemukan.', 404);
    $c = pdo()->prepare('SELECT nilai FROM counters WHERE lembaga_id = ? AND jenis = ?');
    $c->execute([$lembagaId, $jenis]);
    $nilai = (int)($c->fetch()['nilai'] ?? 0);
    $kode = in_array($jenis, ['beda_nama', 'fisik'], true)
        ? ($l['kode_surat_desa'] !== '' ? $l['kode_surat_desa'] : 'PD')
        : ($l['kode_surat'] ?: 'KUD-SS/MURA');
    $no = sprintf('%03d', $nilai + 1) . '/' . $kode . '/' . date('Y');
    json_ok(['no_surat' => 'Nomor : ' . $no]);
}

if ($act === 'save') {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') json_err('Metode tidak diizinkan.', 405);
    can('surat.tambah');
    $scope = surat_scope();
    $d = body();
    $jenis = trim((string)($d['jenis'] ?? ''));
    $jenisLabel = trim((string)($d['jenis_label'] ?? ''));
    $noSurat = trim((string)($d['no_surat'] ?? ''));
    $nama = trim((string)($d['nama'] ?? ''));
    $tanggal = trim((string)($d['tanggal'] ?? ''));
    $tanggalLabel = trim((string)($d['tanggal_label'] ?? ''));
    $html = (string)($d['html'] ?? '');
    $pekebunId = (int)($d['pekebun_id'] ?? 0);
    if ($jenis === '' || $jenisLabel === '' || $html === '') json_err('Data surat tidak lengkap.');
    if ($nama === '') json_err('Nama pekebun wajib diisi.');

    if ($scope > 0) {
        $lembagaId = $scope;
    } else {
        $lembagaId = (int)($d['lembaga_id'] ?? 0);
        if ($lembagaId <= 0) json_err('Pilih kelembagaan pemilik surat.');
    }

    $noUrutAkhir = null;
    if (in_array($jenis, ['koperasi', 'beda_nama'], true)) {
        $c = pdo()->prepare('SELECT nilai FROM counters WHERE lembaga_id = ? AND jenis = ?');
        $c->execute([$lembagaId, $jenis]);
        $nilai = (int)($c->fetch()['nilai'] ?? 0);
        $nilai++;
        $up = pdo()->prepare(
            'INSERT INTO counters (lembaga_id, jenis, nilai) VALUES (?,?,?)
             ON DUPLICATE KEY UPDATE nilai = VALUES(nilai)'
        );
        $up->execute([$lembagaId, $jenis, $nilai]);
        if ($noSurat === '') {
            $st = pdo()->prepare('SELECT kode_surat, kode_surat_desa FROM lembaga WHERE id = ?');
            $st->execute([$lembagaId]);
            $l = $st->fetch();
            $kode = in_array($jenis, ['beda_nama', 'fisik'], true)
                ? (($l['kode_surat_desa'] ?? '') !== '' ? $l['kode_surat_desa'] : 'PD')
                : (($l['kode_surat'] ?? '') ?: 'KUD-SS/MURA');
            $noSurat = 'Nomor : ' . sprintf('%03d', $nilai) . '/' . $kode . '/' . date('Y');
        }
    }

    $st = pdo()->prepare(
        'INSERT INTO surat (lembaga_id, pekebun_id, jenis, jenis_label, no_surat, nama, tanggal, tanggal_label, html)
         VALUES (?,?,?,?,?,?,?,?,?)'
    );
    $st->execute([$lembagaId, $pekebunId > 0 ? $pekebunId : null, $jenis, $jenisLabel, $noSurat, $nama, $tanggal !== '' ? $tanggal : null, $tanggalLabel, $html]);
    json_ok(['id' => (int)pdo()->lastInsertId(), 'no_surat' => $noSurat]);
}

if ($act === 'delete') {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') json_err('Metode tidak diizinkan.', 405);
    $u = can('surat.hapus');
    $scope = surat_scope();
    $d = body();
    $id = (int)($d['id'] ?? 0);
    $st = pdo()->prepare('SELECT * FROM surat WHERE id = ?');
    $st->execute([$id]);
    $s = $st->fetch();
    if (!$s) json_err('Surat tidak ditemukan.', 404);
    if ($scope > 0 && (int)$s['lembaga_id'] !== $scope) json_err('Anda tidak memiliki izin atas surat ini.', 403);
    // Batasan RBAC: lembaga tidak dapat menghapus surat yang terkait usulan
    // yang sudah disetujui (terkunci permanen). Admin tetap dapat menghapus.
    if ($u['role'] === 'lembaga' && (int)$s['pekebun_id'] > 0) {
        $p = pdo()->prepare('SELECT status FROM pekebun WHERE id = ?');
        $p->execute([(int)$s['pekebun_id']]);
        if ($p->fetch()['status'] === 'disetujui') {
            json_err('Surat terkait usulan yang sudah disetujui tidak dapat dihapus.');
        }
    }
    $st = pdo()->prepare('DELETE FROM surat WHERE id = ?');
    $st->execute([$id]);
    json_ok();
}

json_err('Aksi tidak dikenal.', 404);
