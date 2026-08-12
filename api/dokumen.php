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

    $UPLOAD_ERR_MSG = [
        UPLOAD_ERR_INI_SIZE   => 'File melebihi batas upload_max_filesize server (' . ini_get('upload_max_filesize') . '). Dokumen pekebun maksimal 5 MB.',
        UPLOAD_ERR_FORM_SIZE  => 'File melebihi batas ukuran yang ditentukan.',
        UPLOAD_ERR_PARTIAL    => 'File hanya terunggah sebagian. Silakan coba lagi.',
        UPLOAD_ERR_NO_FILE    => 'Tidak ada file yang dipilih.',
        UPLOAD_ERR_NO_TMP_DIR => 'Folder temporer unggahan server tidak tersedia.',
        UPLOAD_ERR_CANT_WRITE => 'Server tidak dapat menulis file unggahan (izin folder). Hubungi administrator.',
        UPLOAD_ERR_EXTENSION  => 'Ekstensi PHP memblokir unggahan file ini.',
    ];

    if (empty($_FILES)) {
        error_log('[SDMPKS upload] $_FILES kosong: file_uploads=' . ini_get('file_uploads')
            . ', upload_max_filesize=' . ini_get('upload_max_filesize')
            . ', post_max_size=' . ini_get('post_max_size')
            . ', tmp=' . sys_get_temp_dir() . ', CL=' . ($_SERVER['CONTENT_LENGTH'] ?? '-'));
        json_err(
            'Server tidak menerima file unggahan. Penyebab umum: ukuran file melebihi batas server (post_max_size='
            . ini_get('post_max_size') . ') atau unggahan file dinonaktifkan. Coba file yang lebih kecil dan hubungi administrator bila tetap gagal.',
            422,
            'upload_no_files'
        );
    }
    if (empty($_FILES['file'])) {
        json_err('Field file tidak ditemukan pada request unggahan.', 422, 'upload_no_field');
    }

    $f = $_FILES['file'];
    if ($f['error'] !== UPLOAD_ERR_OK) {
        error_log('[SDMPKS upload] error=' . $f['error'] . ' size=' . $f['size'] . ' name=' . $f['name']);
        json_err(
            $UPLOAD_ERR_MSG[$f['error']] ?? ('Kode kesalahan unggahan server: ' . $f['error'] . '. Hubungi administrator.'),
            422,
            'upload_err_' . $f['error']
        );
    }
    if ($f['size'] <= 0) json_err('File kosong.');
    if ($f['size'] > MAX_UPLOAD) json_err('Ukuran file maksimal 5 MB.', 422, 'upload_too_large');

    $ext = strtolower(pathinfo((string)$f['name'], PATHINFO_EXTENSION));
    $mime = '';
    if (function_exists('finfo_open')) {
        $mime = (string)finfo_file(finfo_open(FILEINFO_MIME_TYPE), $f['tmp_name']);
    }
    $head = file_get_contents($f['tmp_name'], false, null, 0, 5);
    $isPdfMagic = $head !== false && strncmp($head, '%PDF-', 5) === 0;
    $mimeOk = in_array($mime, ['application/pdf', 'application/x-pdf'], true);
    if ($ext !== 'pdf' || ($mime === '' && !$isPdfMagic) || ($mime !== '' && !$mimeOk && !$isPdfMagic)) {
        json_err('Hanya file PDF yang diperbolehkan.');
    }
    if (empty($mime)) $mime = 'application/pdf';

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
