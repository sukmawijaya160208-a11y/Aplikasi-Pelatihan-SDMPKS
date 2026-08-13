<?php
// ============================================================
// SDMPKS - Backup & Restore
//   Admin   : backup/restore database penuh (file .sql)
//   Lembaga : backup/restore data milik kelembagaannya (file .json)
// ============================================================
require_once __DIR__ . '/db.php';

define('BK_DIR', __DIR__ . '/../backups');
define('BK_MAX_FILES', 30);

const BK_TABLES = ['roles', 'role_permissions', 'permissions', 'users', 'lembaga', 'pekebun', 'surat', 'dokumen', 'notifikasi', 'counters', 'pengaturan'];

const PEKEBUN_COLS = [
    'nama', 'nik', 'no_kk', 'jk', 'tempat_lahir', 'tanggal_lahir', 'jenis_pelatihan', 'jalur', 'alamat', 'hp',
    'desa', 'provinsi', 'kabupaten', 'kecamatan', 'kepala_desa', 'agama', 'pekerjaan', 'jalan_rt_rw', 'nib',
    'status_tanah', 'dipergunakan', 'batas_utara', 'batas_timur', 'batas_selatan', 'batas_barat', 'tahun_kuasai',
    'perolehan_dari', 'perolehan_sejak', 'saksi1_nama', 'saksi1_umur', 'saksi1_pekerjaan', 'saksi1_alamat',
    'saksi2_nama', 'saksi2_umur', 'saksi2_pekerjaan', 'saksi2_alamat', 'luas_lahan', 'no_shm',
    'pemilik_sebelumnya', 'status', 'tgl_input', 'tgl_diajukan', 'tgl_verifikasi', 'verifikator', 'alasan',
];

const SURAT_COLS = ['lembaga_id', 'pekebun_id', 'jenis', 'jenis_label', 'no_surat', 'nama', 'tanggal', 'tanggal_label', 'html', 'created_at'];

function bk_dir(): string
{
    if (!is_dir(BK_DIR)) @mkdir(BK_DIR, 0755, true);
    if (!is_file(BK_DIR . '/.htaccess')) {
        @file_put_contents(BK_DIR . '/.htaccess', "Require all denied\nDeny from all\n");
    }
    return BK_DIR;
}

function bk_qid(string $s): string
{
    return '`' . str_replace('`', '``', $s) . '`';
}

function bk_validate_file_name(string $name): bool
{
    return (bool)preg_match('/^sdmpks_\d{8}_\d{6}\.sql$/', $name);
}

function bk_dump_database(): string
{
    $pdo = pdo();
    $out = "-- ============================================================\n";
    $out .= "-- SDMPKS - Backup Database\n";
    $out .= "-- Aplikasi Pelatihan SDMPKS BPDP\n";
    $out .= "-- Tanggal : " . date('Y-m-d H:i:s') . "\n";
    $out .= "-- Database: " . DB_NAME . "\n";
    $out .= "-- ============================================================\n\n";
    $out .= "SET NAMES utf8mb4;\nSET FOREIGN_KEY_CHECKS = 0;\n\n";

    $rows = $pdo->query('SHOW FULL TABLES')->fetchAll(PDO::FETCH_NUM);
    foreach ($rows as [$t, $type]) {
        $tq = bk_qid($t);
        $create = $pdo->query("SHOW CREATE TABLE $tq")->fetch(PDO::FETCH_NUM)[1];
        $out .= "-- ------------------------------------------------------------\n";
        $out .= "-- Struktur tabel: $t\n";
        $out .= "-- ------------------------------------------------------------\n";
        $out .= "DROP TABLE IF EXISTS $tq;\n";
        $out .= $create . ";\n\n";
        if ($type !== 'BASE TABLE') continue;
        $rows2 = $pdo->query("SELECT * FROM $tq")->fetchAll(PDO::FETCH_NUM);
        if (!$rows2) continue;
        $out .= "INSERT INTO $tq VALUES\n";
        $batch = [];
        foreach ($rows2 as $r) {
            $vals = array_map(static function ($v) use ($pdo) {
                return $v === null ? 'NULL' : $pdo->quote((string)$v);
            }, $r);
            $batch[] = '(' . implode(',', $vals) . ')';
            if (count($batch) >= 300) {
                $out .= implode(",\n", $batch) . ";\n\n";
                $batch = [];
            }
        }
        if ($batch) {
            $out .= implode(",\n", $batch) . ";\n\n";
        }
    }
    $out .= "SET FOREIGN_KEY_CHECKS = 1;\n";
    return $out;
}

function bk_validate_sql(string $sql): bool
{
    if (stripos($sql, '-- SDMPKS - Backup Database') === false && stripos($sql, '-- SDMPKS Backup') === false) {
        return false;
    }
    if (!preg_match_all('/CREATE TABLE `([a-z_0-9]+)`/i', $sql, $m)) return false;
    foreach ($m[1] as $t) {
        if (!in_array($t, BK_TABLES, true)) return false;
    }
    if (preg_match_all('/CREATE\s+(?:ALGORITHM[^,]+,\s*)?(?:DEFINER[^`]*`[^`]*`@`[^`]*`\s+)?(?:SQL\s+SECURITY\s+[A-Z_]+\s+)?VIEW\s+`([a-z_0-9]+)`/i', $sql, $vm)) {
        foreach ($vm[1] as $vt) {
            if ($vt !== 'usulan') return false;
        }
    }
    if (preg_match('/(DROP DATABASE|CREATE USER|GRANT |INTO OUTFILE|LOAD_FILE|SET GLOBAL|information_schema\.|mysql\.)/i', $sql)) {
        return false;
    }
    return true;
}

function bk_restore_sql(string $sql): void
{
    $pdo = pdo();
    $pdo->exec('SET FOREIGN_KEY_CHECKS = 0');
    $pdo->exec($sql);
    $pdo->exec('SET FOREIGN_KEY_CHECKS = 1');
}

function bk_list(): array
{
    $items = [];
    foreach (glob(bk_dir() . '/sdmpks_*.sql') ?: [] as $f) {
        $items[] = [
            'nama' => basename($f),
            'ukuran' => filesize($f),
            'dibuat' => date('Y-m-d H:i:s', filemtime($f)),
        ];
    }
    usort($items, static function ($a, $b) {
        return strcmp($b['nama'], $a['nama']);
    });
    return $items;
}

function bk_prune(): void
{
    $files = glob(bk_dir() . '/sdmpks_*.sql') ?: [];
    if (count($files) <= BK_MAX_FILES) return;
    usort($files, static function ($a, $b) {
        return filemtime($a) <=> filemtime($b);
    });
    while (count($files) > BK_MAX_FILES) {
        @unlink(array_shift($files));
    }
}

function bk_uploaded_file(): string
{
    if (empty($_FILES['file'])) json_err('Pilih file backup terlebih dahulu.', 400);
    $f = $_FILES['file'];
    if (!is_uploaded_file($f['tmp_name']) || $f['error'] !== UPLOAD_ERR_OK) {
        json_err('Gagal mengunggah file. Coba lagi.', 400);
    }
    return $f['tmp_name'];
}

/* ============================================================
   Lembaga: JSON backup/restore data milik kelembagaan sendiri
   ============================================================ */

function bk_le_build(int $lembagaId, string $namaLembaga): array
{
    $pdo = pdo();
    $cols = implode(',', array_map('bk_qid', PEKEBUN_COLS));
    $st = $pdo->prepare("SELECT id, $cols FROM pekebun WHERE lembaga_id = ? ORDER BY id");
    $st->execute([$lembagaId]);
    $pekebun = $st->fetchAll();

    $st = $pdo->prepare('SELECT ' . implode(',', array_map('bk_qid', SURAT_COLS)) . ' FROM surat WHERE lembaga_id = ? ORDER BY id');
    $st->execute([$lembagaId]);
    $surat = $st->fetchAll();

    $st = $pdo->prepare('SELECT jenis, nilai FROM counters WHERE lembaga_id = ? ORDER BY jenis');
    $st->execute([$lembagaId]);
    $counters = $st->fetchAll();

    return [
        'aplikasi' => 'SDMPKS',
        'tipe' => 'backup-lembaga',
        'versi' => 1,
        'lembaga_id' => $lembagaId,
        'nama_lembaga' => $namaLembaga,
        'dibuat' => date('Y-m-d H:i:s'),
        'jumlah' => [
            'pekebun' => count($pekebun),
            'surat' => count($surat),
            'counters' => count($counters),
        ],
        'data' => [
            'pekebun' => $pekebun,
            'surat' => $surat,
            'counters' => $counters,
        ],
    ];
}

function bk_le_restore(array $d, int $lembagaId): array
{
    $pdo = pdo();
    $imported = ['pekebun' => 0, 'surat' => 0, 'counters' => 0];
    $skipped = ['pekebun' => 0, 'surat' => 0];

    $cols = PEKEBUN_COLS;
    foreach ($d['data']['pekebun'] as $row) {
        if (!is_array($row) || !isset($row['nik'])) { $skipped['pekebun']++; continue; }
        $st = $pdo->prepare('SELECT id, lembaga_id FROM pekebun WHERE nik = ? LIMIT 1');
        $st->execute([$row['nik']]);
        $existing = $st->fetch();
        if ($existing && (int)$existing['lembaga_id'] !== $lembagaId) {
            $skipped['pekebun']++;
            continue;
        }
        $vals = [];
        foreach ($cols as $c) {
            $vals[$c] = $row[$c] ?? null;
        }
        $vals['lembaga_id'] = $lembagaId;
        try {
            if ($existing) {
                $setCols = array_merge(['lembaga_id'], $cols);
                $set = implode(',', array_map(static function ($c) use ($pdo, $vals) {
                    return bk_qid($c) . ' = ' . ($vals[$c] === null ? 'NULL' : $pdo->quote((string)$vals[$c]));
                }, $setCols));
                $pdo->prepare("UPDATE pekebun SET $set WHERE id = ?")->execute([$existing['id']]);
            } else {
                $insCols = array_merge(['lembaga_id'], $cols);
                $vq = array_map(static function ($v) use ($pdo) {
                    return $v === null ? 'NULL' : $pdo->quote((string)$v);
                }, array_values(array_map(static function ($c) use ($vals) {
                    return $vals[$c];
                }, $insCols)));
                $pdo->exec('INSERT INTO pekebun (' . implode(',', array_map('bk_qid', $insCols)) . ') VALUES (' . implode(',', $vq) . ')');
            }
            $imported['pekebun']++;
        } catch (Throwable $e) {
            error_log('[backup-le-restore] pekebun ' . ($row['nik'] ?? '?') . ': ' . $e->getMessage());
            $skipped['pekebun']++;
        }
    }

    foreach ($d['data']['surat'] as $row) {
        if (!is_array($row) || !isset($row['no_surat'])) { $skipped['surat']++; continue; }
        $st = $pdo->prepare('SELECT id FROM surat WHERE lembaga_id = ? AND no_surat = ? AND jenis = ? LIMIT 1');
        $st->execute([$lembagaId, $row['no_surat'], $row['jenis'] ?? '']);
        if ($st->fetch()) { $skipped['surat']++; continue; }
        $cols2 = SURAT_COLS;
        $vals = [];
        foreach ($cols2 as $c) {
            $vals[] = $c === 'lembaga_id' ? $lembagaId : ($row[$c] ?? null);
        }
        $vq = array_map(static function ($v) use ($pdo) {
            return $v === null ? 'NULL' : $pdo->quote((string)$v);
        }, $vals);
        try {
            $pdo->exec('INSERT INTO surat (' . implode(',', array_map('bk_qid', $cols2)) . ') VALUES (' . implode(',', $vq) . ')');
            $imported['surat']++;
        } catch (Throwable $e) {
            $skipped['surat']++;
        }
    }

    foreach ($d['data']['counters'] as $row) {
        if (!is_array($row) || !isset($row['jenis'])) continue;
        $pdo->prepare('INSERT INTO counters (lembaga_id, jenis, nilai) VALUES (?, ?, ?)
                       ON DUPLICATE KEY UPDATE nilai = VALUES(nilai)')
            ->execute([$lembagaId, $row['jenis'], (int)($row['nilai'] ?? 0)]);
        $imported['counters']++;
    }

    return ['diimpor' => $imported, 'dilewati' => $skipped];
}

/* ============================================================
   Restart Data: kosongkan data pekebun
   Admin   : seluruh pekebun dari semua kelembagaan
   Lembaga : pekebun milik kelembagaan sendiri
   ============================================================ */

function bk_reset_counts(?int $lembagaId): array
{
    $pdo = pdo();
    $where = $lembagaId === null ? '1=1' : 'lembaga_id = ' . (int)$lembagaId;
    $ids = array_map('intval', $pdo->query("SELECT id FROM pekebun WHERE $where")->fetchAll(PDO::FETCH_COLUMN));
    $nDok = 0;
    if ($ids) {
        $in = implode(',', $ids);
        $nDok = (int)$pdo->query("SELECT COUNT(*) FROM dokumen WHERE pekebun_id IN ($in)")->fetchColumn();
    }
    if ($lembagaId !== null) {
        $st = $pdo->prepare('SELECT COUNT(*) FROM surat WHERE pekebun_id IS NOT NULL AND lembaga_id = ?');
        $st->execute([$lembagaId]);
    } else {
        $st = $pdo->query('SELECT COUNT(*) FROM surat WHERE pekebun_id IS NOT NULL');
    }
    return [
        'ids' => $ids,
        'pekebun' => count($ids),
        'dokumen' => $nDok,
        'surat' => (int)$st->fetchColumn(),
    ];
}

function bk_reset_clear_files(array $ids): void
{
    foreach ($ids as $id) {
        $dir = __DIR__ . '/../uploads/pekebun/' . (int)$id;
        if (!is_dir($dir)) continue;
        foreach (glob(rtrim($dir, '/') . '/*') ?: [] as $f) {
            if (is_file($f)) @unlink($f);
        }
        @rmdir($dir);
    }
}

function bk_reset_pekebun(?int $lembagaId): array
{
    $c = bk_reset_counts($lembagaId);
    $pdo = pdo();
    $pdo->beginTransaction();
    try {
        if ($lembagaId === null) {
            $pdo->exec('DELETE FROM surat WHERE pekebun_id IS NOT NULL');
            $pdo->exec('DELETE FROM pekebun'); // dokumen ikut terhapus via FK CASCADE
        } else {
            $st = $pdo->prepare('DELETE FROM surat WHERE lembaga_id = ? AND pekebun_id IS NOT NULL');
            $st->execute([$lembagaId]);
            $st = $pdo->prepare('DELETE FROM pekebun WHERE lembaga_id = ?');
            $st->execute([$lembagaId]);
        }
        $pdo->commit();
    } catch (Throwable $e) {
        $pdo->rollBack();
        error_log('[backup-reset] ' . $e->getMessage());
        json_err('Gagal mereset data pekebun. Coba lagi.', 500);
    }
    bk_reset_clear_files($c['ids']);
    return ['pekebun' => $c['pekebun'], 'dokumen' => $c['dokumen'], 'surat' => $c['surat']];
}

/* ============================================================
   Routing
   ============================================================ */

$act = $_GET['act'] ?? '';
$u = guard_role();

if ($act === 'create') {
    guard_role('admin');
    $name = 'sdmpks_' . date('Ymd_His') . '.sql';
    $path = bk_dir() . '/' . $name;
    if (file_put_contents($path, bk_dump_database()) === false) {
        json_err('Gagal menulis file backup di server.', 500);
    }
    bk_prune();
    json_ok(['nama' => $name, 'rows' => bk_list()]);
}

if ($act === 'list') {
    guard_role('admin');
    json_ok(['rows' => bk_list()]);
}

if ($act === 'download') {
    guard_role('admin');
    $name = isset($_GET['file']) ? basename($_GET['file']) : '';
    if (!bk_validate_file_name($name)) json_err('Nama file tidak valid.', 400);
    $path = bk_dir() . '/' . $name;
    if (!is_file($path)) json_err('File backup tidak ditemukan.', 404);
    header('Content-Type: application/sql; charset=utf-8');
    header('Content-Disposition: attachment; filename="' . $name . '"');
    header('Content-Length: ' . filesize($path));
    header('X-Content-Type-Options: nosniff');
    readfile($path);
    exit;
}

if ($act === 'delete') {
    guard_role('admin');
    $name = basename(body()['file'] ?? '');
    if (!bk_validate_file_name($name)) json_err('Nama file tidak valid.', 400);
    $path = bk_dir() . '/' . $name;
    if (!is_file($path)) json_err('File backup tidak ditemukan.', 404);
    if (!@unlink($path)) json_err('Gagal menghapus file backup.', 500);
    json_ok(['rows' => bk_list()]);
}

if ($act === 'restore') {
    guard_role('admin');
    $name = basename(body()['file'] ?? '');
    if ($name) {
        if (!bk_validate_file_name($name)) json_err('Nama file tidak valid.', 400);
        $path = bk_dir() . '/' . $name;
        if (!is_file($path)) json_err('File backup tidak ditemukan.', 404);
    } else {
        $path = bk_uploaded_file();
    }
    if (filesize($path) > 64 * 1024 * 1024) json_err('Ukuran file terlalu besar (maks 64 MB).', 413);
    $sql = @file_get_contents($path);
    if ($sql === false || $sql === '') json_err('File backup kosong atau tidak dapat dibaca.', 422);
    if (!bk_validate_sql($sql)) json_err('File bukan backup database SDMPKS yang valid.', 422);
    bk_restore_sql($sql);
    kirim_notifikasi('admin', 'Database dipulihkan', 'Backup ' . ($name ?: '(unggahan)') . ' berhasil dipulihkan.', 'success');
    json_ok(['message' => 'Database berhasil dipulihkan.']);
}

if ($act === 'le_create') {
    guard_role('lembaga');
    $lid = (int)$u['lembaga_id'];
    $st = pdo()->prepare('SELECT nama_lembaga FROM lembaga WHERE id = ?');
    $st->execute([$lid]);
    $nama = $st->fetchColumn() ?: '';
    json_ok(['data' => bk_le_build($lid, (string)$nama)]);
}

if ($act === 'le_restore') {
    guard_role('lembaga');
    $lid = (int)$u['lembaga_id'];
    $path = bk_uploaded_file();
    if (filesize($path) > 20 * 1024 * 1024) json_err('Ukuran file terlalu besar (maks 20 MB).', 413);
    $raw = @file_get_contents($path);
    $d = json_decode((string)$raw, true);
    if (!is_array($d) || ($d['tipe'] ?? '') !== 'backup-lembaga') {
        json_err('File bukan backup data kelembagaan SDMPKS yang valid.', 422);
    }
    if ((int)($d['lembaga_id'] ?? 0) !== $lid) {
        json_err('Backup ini milik kelembagaan lain dan tidak dapat dipulihkan.', 403);
    }
    if (!isset($d['data']['pekebun']) || !isset($d['data']['surat']) || !isset($d['data']['counters'])) {
        json_err('Isi file backup tidak lengkap.', 422);
    }
    $res = bk_le_restore($d, $lid);
    $sum = $res['diimpor']['pekebun'] + $res['diimpor']['surat'] + $res['diimpor']['counters'];
    json_ok(['diimpor' => $res['diimpor'], 'dilewati' => $res['dilewati'], 'message' => $sum . ' data berhasil dipulihkan.']);
}

if ($act === 'reset_preview' || $act === 'reset') {
    if ($u['role'] === 'admin') {
        $lid = null;
    } elseif ($u['role'] === 'lembaga') {
        $lid = (int)$u['lembaga_id'];
    } else {
        json_err('Anda tidak memiliki izin untuk aksi ini.', 403);
    }

    if ($act === 'reset_preview') {
        $c = bk_reset_counts($lid);
        json_ok(['dihapus' => ['pekebun' => $c['pekebun'], 'dokumen' => $c['dokumen'], 'surat' => $c['surat']]]);
    }

    if (empty(body()['konfirmasi'])) json_err('Konfirmasi restart belum diberikan.', 400);
    $d = bk_reset_pekebun($lid);
    $msg = 'Data pekebun dikosongkan (' . $d['pekebun'] . ' pekebun, ' . $d['dokumen'] . ' dokumen, ' . $d['surat'] . ' surat).';
    if ($lid === null) {
        kirim_notifikasi('admin', 'Data pekebun di-restart', $msg, 'warning');
    } else {
        kirim_notifikasi_lembaga($lid, 'Data pekebun di-restart', $msg, 'warning');
    }
    json_ok(['dihapus' => $d, 'message' => $msg]);
}

json_err('Aksi tidak dikenali.', 404);
