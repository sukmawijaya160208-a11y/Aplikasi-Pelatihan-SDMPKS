<?php
// ============================================================
// SDMPKS - Backup & Restore
//   Admin   : backup/restore database + dokumen PDF (file .zip)
//   Lembaga : backup/restore data + dokumen PDF miliknya (file .zip)
//   File .sql / .json lama tetap dapat dipulihkan.
// ============================================================
require_once __DIR__ . '/db.php';

define('BK_DIR', __DIR__ . '/../backups');
define('BK_MAX_FILES', 30);
define('BK_UPLOAD_DIR', __DIR__ . '/../uploads/pekebun');
define('BK_MAX_RESTORE', 512 * 1024 * 1024);
define('BK_MAX_SQL', 256 * 1024 * 1024);
define('BK_MAX_JSON', 64 * 1024 * 1024);
define('BK_MAX_ENTRIES', 20000);
define('BK_MAX_UNCOMPRESSED', 2 * 1024 * 1024 * 1024);

const BK_TABLES = ['roles', 'role_permissions', 'permissions', 'users', 'lembaga', 'lembaga_desa', 'pekebun', 'surat', 'dokumen', 'notifikasi', 'counters', 'pengaturan'];

const PEKEBUN_COLS = [
    'nama', 'nik', 'no_kk', 'jk', 'tempat_lahir', 'tanggal_lahir', 'jenis_pelatihan', 'jalur', 'alamat', 'hp',
    'desa', 'provinsi', 'kabupaten', 'kecamatan', 'lahan_provinsi', 'lahan_kabupaten', 'lahan_kecamatan', 'lahan_desa',
    'kepala_desa', 'agama', 'pekerjaan', 'jalan_rt_rw', 'nib',
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
    return (bool)preg_match('/^sdmpks_\d{8}_\d{6}\.(sql|zip)$/', $name);
}

function bk_format(string $name): string
{
    return strtolower(pathinfo($name, PATHINFO_EXTENSION));
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
        $isView = ($type === 'VIEW');
        $out .= "-- ------------------------------------------------------------\n";
        $out .= "-- Struktur " . ($isView ? 'view' : 'tabel') . ": $t\n";
        $out .= "-- ------------------------------------------------------------\n";
        $out .= ($isView ? "DROP VIEW IF EXISTS $tq;\n" : "DROP TABLE IF EXISTS $tq;\n");
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
    $files = array_merge(
        glob(bk_dir() . '/sdmpks_*.sql') ?: [],
        glob(bk_dir() . '/sdmpks_*.zip') ?: []
    );
    foreach ($files as $f) {
        $name = basename($f);
        $format = bk_format($name);
        $dokumen = null;
        if ($format === 'zip' && class_exists('ZipArchive')) {
            $zip = new ZipArchive();
            if ($zip->open($f) === true) {
                $raw = $zip->getFromName('manifest.json');
                @$zip->close();
                $m = $raw !== false ? json_decode($raw, true) : null;
                if (is_array($m)) $dokumen = (int)($m['dokumen']['jumlah_file'] ?? 0);
            }
        }
        $items[] = [
            'nama' => $name,
            'ukuran' => (int)@filesize($f),
            'dibuat' => date('Y-m-d H:i:s', (int)@filemtime($f)),
            'format' => $format,
            'dokumen' => $dokumen,
        ];
    }
    usort($items, static function ($a, $b) {
        return strcmp($b['nama'], $a['nama']);
    });
    return $items;
}

function bk_prune(): void
{
    $files = array_merge(
        glob(bk_dir() . '/sdmpks_*.sql') ?: [],
        glob(bk_dir() . '/sdmpks_*.zip') ?: []
    );
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
   ZIP: backup database + dokumen PDF
   ============================================================ */

function bk_rmtree(string $dir): void
{
    if ($dir === '' || !is_dir($dir)) return;
    $it = new RecursiveIteratorIterator(
        new RecursiveDirectoryIterator($dir, FilesystemIterator::SKIP_DOTS),
        RecursiveIteratorIterator::CHILD_FIRST
    );
    foreach ($it as $f) {
        $path = $f->getPathname();
        if ($f->isDir() && !$f->isLink()) {
            @rmdir($path);
        } else {
            @unlink($path);
        }
    }
    @rmdir($dir);
}

function bk_collect_uploads(string $baseDir): array
{
    if (!is_dir($baseDir)) return [];
    $base = realpath($baseDir);
    if ($base === false) return [];
    $base = rtrim(str_replace('\\', '/', $base), '/');
    $out = [];
    $it = new RecursiveIteratorIterator(
        new RecursiveDirectoryIterator($base, FilesystemIterator::SKIP_DOTS)
    );
    foreach ($it as $f) {
        if (!$f->isFile() || $f->isLink()) continue;
        $path = str_replace('\\', '/', $f->getPathname());
        if (strpos($path, $base . '/') !== 0) continue;
        $rel = substr($path, strlen($base) + 1);
        if (!preg_match('#^\d+/[A-Za-z0-9._-]+\.pdf$#', $rel)) continue;
        $out[$rel] = $f->getPathname();
    }
    ksort($out);
    return $out;
}

function bk_zip_fail(?ZipArchive $zip, ?string $tmp, string $msg, int $code = 422): void
{
    if ($zip) @$zip->close();
    if ($tmp) bk_rmtree($tmp);
    json_err($msg, $code);
}

function bk_zip_extract(string $path, string $mainFile): array
{
    if (!class_exists('ZipArchive')) {
        json_err('Ekstensi PHP ZipArchive tidak tersedia di server. Hubungi administrator.', 500);
    }
    $zip = new ZipArchive();
    if ($zip->open($path) !== true) {
        json_err('File ZIP tidak dapat dibuka.', 422);
    }
    $num = (int)$zip->numFiles;
    if ($num <= 0 || $num > BK_MAX_ENTRIES) {
        bk_zip_fail($zip, null, 'Jumlah entri di dalam ZIP tidak valid.');
    }

    $files = [];
    $total = 0;
    for ($i = 0; $i < $num; $i++) {
        $stat = $zip->statIndex($i);
        if (!$stat) continue;
        $entry = str_replace('\\', '/', (string)$stat['name']);
        if ($entry === '' || $entry[0] === '/' || strpos($entry, "\0") !== false) {
            bk_zip_fail($zip, null, 'ZIP berisi path yang tidak valid.');
        }
        if (preg_match('#(^|/)\.\.(/|$)#', $entry)) {
            bk_zip_fail($zip, null, 'ZIP berisi path yang tidak aman.');
        }
        if (substr($entry, -1) === '/') continue;
        $allowed = ($entry === $mainFile)
            || ($entry === 'manifest.json')
            || preg_match('#^uploads/pekebun/\d+/[A-Za-z0-9._-]+\.pdf$#', $entry);
        if (!$allowed) {
            bk_zip_fail($zip, null, 'ZIP berisi file yang tidak diizinkan: ' . $entry);
        }
        $total += (int)($stat['size'] ?? 0);
        if ($total > BK_MAX_UNCOMPRESSED) {
            bk_zip_fail($zip, null, 'Isi ZIP terlalu besar.');
        }
        $files[] = $entry;
    }
    if (!in_array($mainFile, $files, true)) {
        bk_zip_fail($zip, null, 'ZIP tidak berisi ' . $mainFile . '.');
    }

    $tmp = sys_get_temp_dir() . '/sdmpks_restore_' . bin2hex(random_bytes(8));
    if (!@mkdir($tmp, 0700, true)) {
        bk_zip_fail($zip, null, 'Gagal menyiapkan folder sementara untuk restore.', 500);
    }
    foreach ($files as $entry) {
        $target = $tmp . '/' . $entry;
        $dir = dirname($target);
        if (!is_dir($dir) && !@mkdir($dir, 0700, true)) {
            bk_zip_fail($zip, $tmp, 'Gagal mengekstrak ZIP.', 500);
        }
        $in = $zip->getStream($entry);
        if (!$in) {
            bk_zip_fail($zip, $tmp, 'Gagal membaca isi ZIP.', 422);
        }
        $out = @fopen($target, 'wb');
        if (!$out) {
            fclose($in);
            bk_zip_fail($zip, $tmp, 'Gagal mengekstrak ZIP.', 500);
        }
        $copied = stream_copy_to_stream($in, $out);
        fclose($in);
        fclose($out);
        if ($copied === false) {
            bk_zip_fail($zip, $tmp, 'Gagal mengekstrak ZIP.', 500);
        }
    }
    @$zip->close();

    return [
        'tmp' => $tmp,
        'main' => $tmp . '/' . $mainFile,
        'uploads' => $tmp . '/uploads/pekebun',
    ];
}

function bk_create_zip(): string
{
    if (!class_exists('ZipArchive')) {
        json_err('Ekstensi PHP ZipArchive tidak tersedia di server. Hubungi administrator.', 500);
    }
    $name = 'sdmpks_' . date('Ymd_His') . '.zip';
    $path = bk_dir() . '/' . $name;
    $zip = new ZipArchive();
    if ($zip->open($path, ZipArchive::CREATE | ZipArchive::OVERWRITE) !== true) {
        json_err('Gagal membuat file ZIP di server.', 500);
    }
    $sql = bk_dump_database();
    if (!$zip->addFromString('database.sql', $sql)) {
        @$zip->close();
        @unlink($path);
        json_err('Gagal menulis database ke dalam ZIP.', 500);
    }

    $uploads = bk_collect_uploads(BK_UPLOAD_DIR);
    $totalBytes = 0;
    foreach ($uploads as $rel => $abs) {
        if (!$zip->addFile($abs, 'uploads/pekebun/' . $rel)) {
            @$zip->close();
            @unlink($path);
            json_err('Gagal menambahkan dokumen ke dalam ZIP.', 500);
        }
        $totalBytes += (int)@filesize($abs);
    }

    $manifest = [
        'aplikasi' => 'SDMPKS',
        'tipe' => 'backup-admin',
        'versi' => 2,
        'dibuat' => date('Y-m-d H:i:s'),
        'database' => DB_NAME,
        'dokumen' => [
            'jumlah_file' => count($uploads),
            'jumlah_pekebun' => count(array_unique(array_map(static function ($rel) {
                return (int)explode('/', $rel)[0];
            }, array_keys($uploads)))),
            'ukuran' => $totalBytes,
        ],
    ];
    if (!$zip->addFromString('manifest.json', json_encode($manifest, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES))) {
        @$zip->close();
        @unlink($path);
        json_err('Gagal menulis manifest backup.', 500);
    }
    if (!$zip->close()) {
        @unlink($path);
        json_err('Gagal menyelesaikan file ZIP.', 500);
    }
    return $name;
}

function bk_swap_uploads(string $source): ?string
{
    $target = BK_UPLOAD_DIR;
    $parent = dirname($target);
    if (!is_dir($parent) && !@mkdir($parent, 0755, true)) {
        throw new RuntimeException('Gagal menyiapkan folder uploads.');
    }
    $oldName = null;
    if (is_dir($target)) {
        $stamp = date('Ymd_His');
        $oldName = 'pekebun_old_' . $stamp;
        $oldPath = $parent . '/' . $oldName;
        $i = 1;
        while (is_dir($oldPath)) {
            $oldName = 'pekebun_old_' . $stamp . '_' . $i++;
            $oldPath = $parent . '/' . $oldName;
        }
        if (!@rename($target, $oldPath)) {
            throw new RuntimeException('Gagal menyimpan folder dokumen lama.');
        }
    }
    if (!@rename($source, $target)) {
        if ($oldName && is_dir($parent . '/' . $oldName)) {
            @rename($parent . '/' . $oldName, $target);
        }
        throw new RuntimeException('Gagal memasang folder dokumen dari backup.');
    }
    return $oldName;
}

function bk_le_create_zip(int $lembagaId, string $namaLembaga): array
{
    if (!class_exists('ZipArchive')) {
        json_err('Ekstensi PHP ZipArchive tidak tersedia di server. Hubungi administrator.', 500);
    }
    $data = bk_le_build($lembagaId, $namaLembaga);
    $tmp = tempnam(sys_get_temp_dir(), 'sdmpks_le_');
    if ($tmp === false) json_err('Gagal menyiapkan file backup.', 500);
    $zip = new ZipArchive();
    if ($zip->open($tmp, ZipArchive::CREATE | ZipArchive::OVERWRITE) !== true) {
        @unlink($tmp);
        json_err('Gagal membuat file ZIP backup.', 500);
    }
    if (!$zip->addFromString('data.json', json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES))) {
        @$zip->close();
        @unlink($tmp);
        json_err('Gagal menulis data backup.', 500);
    }
    $files = 0;
    foreach ($data['data']['dokumen'] as $doc) {
        if (!is_array($doc)) continue;
        $pekebunId = (int)($doc['pekebun_id'] ?? 0);
        $file = (string)($doc['file_name'] ?? '');
        if ($pekebunId <= 0 || !preg_match('/^[A-Za-z0-9._-]+\.pdf$/', $file)) continue;
        $abs = BK_UPLOAD_DIR . '/' . $pekebunId . '/' . $file;
        if (!is_file($abs)) continue;
        if (!$zip->addFile($abs, 'uploads/pekebun/' . $pekebunId . '/' . $file)) {
            @$zip->close();
            @unlink($tmp);
            json_err('Gagal menambahkan dokumen ke dalam ZIP.', 500);
        }
        $files++;
    }
    if (!$zip->close()) {
        @unlink($tmp);
        json_err('Gagal menyelesaikan file ZIP.', 500);
    }
    $slug = strtolower((string)preg_replace('/[^a-z0-9]+/i', '_', $namaLembaga));
    $slug = trim($slug, '_') ?: 'lembaga';
    return [
        'path' => $tmp,
        'nama' => 'backup_' . $slug . '_' . date('Ymd_His') . '.zip',
        'dokumen' => $files,
    ];
}

/* ============================================================
   Lembaga: backup/restore data milik kelembagaan sendiri
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

    $st = $pdo->prepare(
        'SELECT d.id, d.pekebun_id, p.nik, d.nama_asli, d.file_name, d.tipe, d.ukuran, d.created_at
         FROM dokumen d
         JOIN pekebun p ON p.id = d.pekebun_id
         WHERE p.lembaga_id = ?
         ORDER BY d.id'
    );
    $st->execute([$lembagaId]);
    $dokumen = $st->fetchAll();

    return [
        'aplikasi' => 'SDMPKS',
        'tipe' => 'backup-lembaga',
        'versi' => 2,
        'lembaga_id' => $lembagaId,
        'nama_lembaga' => $namaLembaga,
        'dibuat' => date('Y-m-d H:i:s'),
        'jumlah' => [
            'pekebun' => count($pekebun),
            'surat' => count($surat),
            'counters' => count($counters),
            'dokumen' => count($dokumen),
        ],
        'data' => [
            'pekebun' => $pekebun,
            'surat' => $surat,
            'counters' => $counters,
            'dokumen' => $dokumen,
        ],
    ];
}

function bk_le_restore(array $d, int $lembagaId, ?string $uploadsSource = null): array
{
    $pdo = pdo();
    $imported = ['pekebun' => 0, 'surat' => 0, 'counters' => 0, 'dokumen' => 0];
    $skipped = ['pekebun' => 0, 'surat' => 0, 'dokumen' => 0];
    $nikMap = [];
    $idMap = [];

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
                $newId = (int)$existing['id'];
            } else {
                $insCols = array_merge(['lembaga_id'], $cols);
                $vq = array_map(static function ($v) use ($pdo) {
                    return $v === null ? 'NULL' : $pdo->quote((string)$v);
                }, array_values(array_map(static function ($c) use ($vals) {
                    return $vals[$c];
                }, $insCols)));
                $pdo->exec('INSERT INTO pekebun (' . implode(',', array_map('bk_qid', $insCols)) . ') VALUES (' . implode(',', $vq) . ')');
                $newId = (int)$pdo->lastInsertId();
            }
            $nikMap[(string)$row['nik']] = $newId;
            if (isset($row['id'])) $idMap[(int)$row['id']] = $newId;
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

    foreach (($d['data']['dokumen'] ?? []) as $doc) {
        if (!is_array($doc)) { $skipped['dokumen']++; continue; }
        $file = (string)($doc['file_name'] ?? '');
        if (!preg_match('/^[A-Za-z0-9._-]+\.pdf$/', $file)) { $skipped['dokumen']++; continue; }

        $nik = (string)($doc['nik'] ?? '');
        $newPekebunId = $nik !== '' ? (int)($nikMap[$nik] ?? 0) : 0;
        if ($newPekebunId <= 0 && isset($doc['pekebun_id'])) {
            $newPekebunId = (int)($idMap[(int)$doc['pekebun_id']] ?? 0);
        }
        if ($newPekebunId <= 0) { $skipped['dokumen']++; continue; }

        $chk = $pdo->prepare('SELECT lembaga_id FROM pekebun WHERE id = ?');
        $chk->execute([$newPekebunId]);
        if ((int)$chk->fetchColumn() !== $lembagaId) { $skipped['dokumen']++; continue; }

        $destDir = BK_UPLOAD_DIR . '/' . $newPekebunId;
        $dest = $destDir . '/' . $file;
        $hasFile = false;
        if ($uploadsSource !== null) {
            $oldId = (int)($doc['pekebun_id'] ?? 0);
            $candidates = [
                $uploadsSource . '/' . $oldId . '/' . $file,
                $uploadsSource . '/' . $newPekebunId . '/' . $file,
            ];
            $src = null;
            foreach ($candidates as $c) {
                if (is_file($c)) { $src = $c; break; }
            }
            if ($src !== null) {
                if (!is_dir($destDir) && !@mkdir($destDir, 0755, true)) {
                    $skipped['dokumen']++;
                    continue;
                }
                if (!@copy($src, $dest)) {
                    $skipped['dokumen']++;
                    continue;
                }
                $hasFile = true;
            }
        } elseif (is_file($dest)) {
            $hasFile = true;
        }
        if (!$hasFile) { $skipped['dokumen']++; continue; }

        try {
            $st = $pdo->prepare('SELECT id FROM dokumen WHERE pekebun_id = ? AND file_name = ? LIMIT 1');
            $st->execute([$newPekebunId, $file]);
            $existingDoc = $st->fetch();
            $namaAsli = (string)($doc['nama_asli'] ?? $file);
            $tipe = (string)($doc['tipe'] ?? 'application/pdf');
            $ukuran = (int)($doc['ukuran'] ?? (@filesize($dest) ?: 0));
            if ($existingDoc) {
                $pdo->prepare('UPDATE dokumen SET nama_asli = ?, tipe = ?, ukuran = ? WHERE id = ?')
                    ->execute([$namaAsli, $tipe, $ukuran, $existingDoc['id']]);
            } else {
                $pdo->prepare('INSERT INTO dokumen (pekebun_id, nama_asli, file_name, tipe, ukuran) VALUES (?, ?, ?, ?, ?)')
                    ->execute([$newPekebunId, $namaAsli, $file, $tipe, $ukuran]);
            }
            $imported['dokumen']++;
        } catch (Throwable $e) {
            error_log('[backup-le-restore] dokumen ' . $file . ': ' . $e->getMessage());
            $skipped['dokumen']++;
        }
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
    $name = bk_create_zip();
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
    $isZip = bk_format($name) === 'zip';
    header('Content-Type: ' . ($isZip ? 'application/zip' : 'application/sql; charset=utf-8'));
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
    $uploadedName = (string)($_FILES['file']['name'] ?? '');
    if ($name) {
        if (!bk_validate_file_name($name)) json_err('Nama file tidak valid.', 400);
        $path = bk_dir() . '/' . $name;
        if (!is_file($path)) json_err('File backup tidak ditemukan.', 404);
    } else {
        $path = bk_uploaded_file();
    }
    $ext = strtolower(pathinfo($name !== '' ? $name : $uploadedName, PATHINFO_EXTENSION));
    if ($ext === '') $ext = 'sql';
    if (filesize($path) > BK_MAX_RESTORE) {
        json_err('Ukuran file terlalu besar (maks ' . round(BK_MAX_RESTORE / 1048576) . ' MB).', 413);
    }

    if ($ext === 'zip') {
        $z = bk_zip_extract($path, 'database.sql');
        if (filesize($z['main']) > BK_MAX_SQL) {
            bk_rmtree($z['tmp']);
            json_err('Database di dalam ZIP terlalu besar (maks ' . round(BK_MAX_SQL / 1048576) . ' MB).', 413);
        }
        $sql = @file_get_contents($z['main']);
        if ($sql === false || $sql === '') {
            bk_rmtree($z['tmp']);
            json_err('File database di dalam ZIP kosong atau tidak dapat dibaca.', 422);
        }
        if (!bk_validate_sql($sql)) {
            bk_rmtree($z['tmp']);
            json_err('File database di dalam ZIP bukan backup SDMPKS yang valid.', 422);
        }
        try {
            bk_restore_sql($sql);
        } catch (Throwable $e) {
            bk_rmtree($z['tmp']);
            error_log('[backup-restore] ' . $e->getMessage());
            json_err('Gagal memulihkan database: ' . $e->getMessage(), 500);
        }

        $manifest = null;
        if (is_file($z['tmp'] . '/manifest.json')) {
            $manifest = json_decode((string)@file_get_contents($z['tmp'] . '/manifest.json'), true);
        }
        $isFull = is_array($manifest) && (($manifest['tipe'] ?? '') === 'backup-admin');
        $files = 0;
        $oldName = null;
        if (is_dir($z['uploads']) || $isFull) {
            if (!is_dir($z['uploads'])) @mkdir($z['uploads'], 0700, true);
            $files = count(bk_collect_uploads($z['uploads']));
            try {
                $oldName = bk_swap_uploads($z['uploads']);
            } catch (Throwable $e) {
                bk_rmtree($z['tmp']);
                error_log('[backup-restore] uploads: ' . $e->getMessage());
                json_err($e->getMessage(), 500);
            }
        }
        bk_rmtree($z['tmp']);
        $msg = 'Database dan ' . $files . ' dokumen berhasil dipulihkan.';
        if ($oldName) $msg .= ' Folder dokumen lama disimpan sebagai ' . $oldName . '.';
        kirim_notifikasi('admin', 'Database dipulihkan', 'Backup ' . ($name ?: '(unggahan)') . ' berhasil dipulihkan.', 'success');
        json_ok(['message' => $msg, 'dokumen' => $files, 'folder_lama' => $oldName]);
    }

    if (filesize($path) > BK_MAX_SQL) {
        json_err('Ukuran file SQL terlalu besar (maks ' . round(BK_MAX_SQL / 1048576) . ' MB).', 413);
    }
    $sql = @file_get_contents($path);
    if ($sql === false || $sql === '') json_err('File backup kosong atau tidak dapat dibaca.', 422);
    if (!bk_validate_sql($sql)) json_err('File bukan backup database SDMPKS yang valid.', 422);
    try {
        bk_restore_sql($sql);
    } catch (Throwable $e) {
        error_log('[backup-restore] ' . $e->getMessage());
        json_err('Gagal memulihkan database: ' . $e->getMessage(), 500);
    }
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

if ($act === 'le_download') {
    guard_role('lembaga');
    $lid = (int)$u['lembaga_id'];
    $st = pdo()->prepare('SELECT nama_lembaga FROM lembaga WHERE id = ?');
    $st->execute([$lid]);
    $nama = (string)($st->fetchColumn() ?: '');
    $z = bk_le_create_zip($lid, $nama);
    header('Content-Type: application/zip');
    header('Content-Disposition: attachment; filename="' . $z['nama'] . '"');
    header('Content-Length: ' . filesize($z['path']));
    header('X-Content-Type-Options: nosniff');
    readfile($z['path']);
    @unlink($z['path']);
    exit;
}

if ($act === 'le_restore') {
    guard_role('lembaga');
    $lid = (int)$u['lembaga_id'];
    $path = bk_uploaded_file();
    $uploadedName = (string)($_FILES['file']['name'] ?? '');
    $ext = strtolower(pathinfo($uploadedName, PATHINFO_EXTENSION));
    $tmp = null;
    $uploadsSource = null;
    if ($ext === 'zip') {
        if (filesize($path) > BK_MAX_RESTORE) {
            json_err('Ukuran file terlalu besar (maks ' . round(BK_MAX_RESTORE / 1048576) . ' MB).', 413);
        }
        $z = bk_zip_extract($path, 'data.json');
        $tmp = $z['tmp'];
        if (filesize($z['main']) > BK_MAX_JSON) {
            bk_rmtree($tmp);
            json_err('Data di dalam ZIP terlalu besar (maks ' . round(BK_MAX_JSON / 1048576) . ' MB).', 413);
        }
        $raw = @file_get_contents($z['main']);
        $uploadsSource = is_dir($z['uploads']) ? $z['uploads'] : null;
    } else {
        if (filesize($path) > BK_MAX_JSON) {
            json_err('Ukuran file terlalu besar (maks ' . round(BK_MAX_JSON / 1048576) . ' MB).', 413);
        }
        $raw = @file_get_contents($path);
    }
    $d = json_decode((string)$raw, true);
    if (!is_array($d) || ($d['tipe'] ?? '') !== 'backup-lembaga') {
        if ($tmp) bk_rmtree($tmp);
        json_err('File bukan backup data kelembagaan SDMPKS yang valid.', 422);
    }
    if ((int)($d['lembaga_id'] ?? 0) !== $lid) {
        if ($tmp) bk_rmtree($tmp);
        json_err('Backup ini milik kelembagaan lain dan tidak dapat dipulihkan.', 403);
    }
    if (!isset($d['data']['pekebun']) || !isset($d['data']['surat']) || !isset($d['data']['counters'])) {
        if ($tmp) bk_rmtree($tmp);
        json_err('Isi file backup tidak lengkap.', 422);
    }
    try {
        $res = bk_le_restore($d, $lid, $uploadsSource);
    } catch (Throwable $e) {
        if ($tmp) bk_rmtree($tmp);
        error_log('[backup-le-restore] ' . $e->getMessage());
        json_err('Gagal memulihkan data kelembagaan: ' . $e->getMessage(), 500);
    }
    if ($tmp) bk_rmtree($tmp);
    $sum = $res['diimpor']['pekebun'] + $res['diimpor']['surat'] + $res['diimpor']['counters'] + $res['diimpor']['dokumen'];
    $msg = $sum . ' data berhasil dipulihkan.';
    if ($res['diimpor']['dokumen'] > 0) $msg .= ' ' . $res['diimpor']['dokumen'] . ' dokumen dipulihkan.';
    json_ok(['diimpor' => $res['diimpor'], 'dilewati' => $res['dilewati'], 'message' => $msg]);
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
