<?php
// ============================================================
// SDMPKS - API Dokumen Pekebun (upload PDF)
// act: list | upload | hapus | download
// Izin: lembaga (miliknya, tidak saat terkunci), admin (semua),
//       dinas (lihat & unduh saja, tidak boleh upload/hapus)
// ============================================================
require_once __DIR__ . '/db.php';

define('MAX_UPLOAD', 5 * 1024 * 1024); // 5 MB

function pekebun_terkunci(array $row): bool
{
    return in_array($row['status'], ['diajukan', 'disetujui'], true);
}

function can_view_dokumen(int $pekebunId): void
{
    $u = can('data.lihat');
    $st = pdo()->prepare('SELECT lembaga_id FROM pekebun WHERE id = ?');
    $st->execute([$pekebunId]);
    $l = $st->fetchColumn();
    if (!$l) json_err('Data pekebun tidak ditemukan.', 404);
    if ($u['role'] === 'lembaga' && (int)$l !== (int)$u['lembaga_id']) {
        json_err('Anda tidak memiliki izin atas data ini.', 403);
    }
}

function can_edit_dokumen(int $pekebunId): void
{
    // RBAC: upload/hapus dokumen hanya untuk admin & lembaga pemilik (saat tidak terkunci).
    // Dinas Perkebunan: verifikator pasif — hanya boleh melihat/mengunduh.
    $u = can('dokumen.unggah');
    $st = pdo()->prepare('SELECT * FROM pekebun WHERE id = ?');
    $st->execute([$pekebunId]);
    $row = $st->fetch();
    if (!$row) json_err('Data pekebun tidak ditemukan.', 404);
    if ($u['role'] === 'lembaga' && (int)$row['lembaga_id'] !== (int)$u['lembaga_id']) {
        json_err('Anda tidak memiliki izin atas data ini.', 403);
    }
    // Kunci hanya berlaku untuk lembaga; admin bebas mengelola dokumen.
    if ($u['role'] === 'lembaga' && pekebun_terkunci($row)) {
        json_err('Berkas sedang diproses (menunggu verifikasi / disetujui) sehingga dokumen tidak dapat diubah.');
    }
}

$act = $_GET['act'] ?? '';

if ($act === 'list') {
    $id = (int)($_GET['pekebun_id'] ?? 0);
    can_view_dokumen($id);
    $st = pdo()->prepare('SELECT * FROM dokumen WHERE pekebun_id = ? ORDER BY id ASC');
    $st->execute([$id]);
    $rows = $st->fetchAll();
    foreach ($rows as &$r) {
        $r['ukuran_label'] = $r['ukuran'] >= 1048576
            ? round($r['ukuran'] / 1048576, 1) . ' MB'
            : max(1, (int)round($r['ukuran'] / 1024)) . ' KB';
    }
    unset($r);
    json_ok(['rows' => $rows]);
}

if ($act === 'upload') {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') json_err('Metode tidak diizinkan.', 405);
    can_edit_dokumen((int)($_POST['pekebun_id'] ?? $_GET['pekebun_id'] ?? 0));

    if (empty($_FILES['file']) || $_FILES['file']['error'] !== UPLOAD_ERR_OK) {
        json_err('Gagal mengunggah file. Coba lagi.');
    }
    $f = $_FILES['file'];
    if ($f['size'] <= 0) json_err('File kosong.');
    if ($f['size'] > MAX_UPLOAD) json_err('Ukuran file maksimal 5 MB.');

    $ext = strtolower(pathinfo((string)$f['name'], PATHINFO_EXTENSION));
    $mime = '';
    if (function_exists('finfo_open')) {
        $mime = (string)finfo_file(finfo_open(FILEINFO_MIME_TYPE), $f['tmp_name']);
    }
    if ($ext !== 'pdf' || !in_array($mime, ['application/pdf', 'application/x-pdf'], true)) {
        json_err('Hanya file PDF yang diperbolehkan.');
    }

    $pekebunId = (int)($_POST['pekebun_id'] ?? $_GET['pekebun_id'] ?? 0);
    $dir = __DIR__ . '/../uploads/pekebun/' . $pekebunId;
    if (!is_dir($dir) && !@mkdir($dir, 0755, true)) {
        json_err('Gagal membuat folder penyimpanan dokumen.');
    }
    $fname = date('YmdHis') . '_' . bin2hex(random_bytes(6)) . '.pdf';
    if (!move_uploaded_file($f['tmp_name'], $dir . '/' . $fname)) {
        json_err('Gagal menyimpan file di server.');
    }

    $st = pdo()->prepare(
        'INSERT INTO dokumen (pekebun_id, nama_asli, file_name, tipe, ukuran) VALUES (?, ?, ?, ?, ?)'
    );
    $st->execute([$pekebunId, $f['name'], $fname, $mime, (int)$f['size']]);
    json_ok(['id' => (int)pdo()->lastInsertId()]);
}

if ($act === 'hapus') {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') json_err('Metode tidak diizinkan.', 405);
    $d = body();
    $id = (int)($d['id'] ?? 0);
    $st = pdo()->prepare('SELECT * FROM dokumen WHERE id = ?');
    $st->execute([$id]);
    $row = $st->fetch();
    if (!$row) json_err('Dokumen tidak ditemukan.', 404);
    can('dokumen.hapus');
    can_edit_dokumen((int)$row['pekebun_id']);

    $path = __DIR__ . '/../uploads/pekebun/' . (int)$row['pekebun_id'] . '/' . $row['file_name'];
    if (is_file($path)) @unlink($path);
    pdo()->prepare('DELETE FROM dokumen WHERE id = ?')->execute([$id]);
    json_ok();
}

if ($act === 'download') {
    $u = can('data.lihat');
    $id = (int)($_GET['id'] ?? 0);
    $st = pdo()->prepare(
        'SELECT d.*, p.lembaga_id FROM dokumen d JOIN pekebun p ON p.id = d.pekebun_id WHERE d.id = ?'
    );
    $st->execute([$id]);
    $row = $st->fetch();
    if (!$row) json_err('Dokumen tidak ditemukan.', 404);
    if ($u['role'] === 'lembaga' && (int)$row['lembaga_id'] !== (int)$u['lembaga_id']) {
        json_err('Anda tidak memiliki izin atas data ini.', 403);
    }
    $path = __DIR__ . '/../uploads/pekebun/' . (int)$row['pekebun_id'] . '/' . $row['file_name'];
    if (!is_file($path)) json_err('Berkas fisik tidak ditemukan.', 404);

    header('Content-Type: application/pdf; charset=utf-8');
    header('Content-Disposition: inline; filename="' . addslashes($row['nama_asli']) . '"');
    header('Content-Length: ' . (string)filesize($path));
    header('Cache-Control: private, max-age=0, must-revalidate');
    header('Pragma: public');
    readfile($path);
    exit;
}

json_err('Aksi tidak dikenal.', 404);
