<?php
// ============================================================
// SDMPKS - API Pengaturan Kelembagaan (kop surat, logo)
// act: get | save | logo
// Scope: lembaga -> miliknya; admin -> pilih lembaga_id
// ============================================================
require_once __DIR__ . '/db.php';

$act = $_GET['act'] ?? '';

function settings_lembaga_id(): int
{
    $u = guard_role('admin', 'dinas', 'lembaga');
    if ($u['role'] === 'lembaga') return (int)$u['lembaga_id'];
    $id = (int)($_GET['lembaga_id'] ?? 0);
    if ($id <= 0) json_err('Pilih kelembagaan terlebih dahulu.', 422);
    return $id;
}

function can_ubah_pengaturan(): void
{
    // RBAC: hanya lembaga (pengaturannya sendiri) & admin yang dapat mengubah pengaturan.
    can('pengaturan.ubah');
}

function norm_desa_nama(string $v): string
{
    $v = trim((string)preg_replace('/\s+/', ' ', $v));
    $v = (string)preg_replace('/^desa\s+/i', '', $v);
    return trim($v);
}

function norm_desa_teks(string $v): string
{
    return trim((string)preg_replace('/\s+/', ' ', $v));
}

/** Daftar profil desa milik satu lembaga, default paling atas. */
function settings_desa_list(int $id): array
{
    try {
        $st = pdo()->prepare(
            'SELECT id, lembaga_id, nama_desa, kecamatan, kabupaten, kepala_desa,
                    kepala_desa_hp, desa_alamat, kode_surat_desa, logo_desa, is_default
             FROM lembaga_desa WHERE lembaga_id = ?
             ORDER BY is_default DESC, nama_desa ASC, id ASC'
        );
        $st->execute([$id]);
        $rows = $st->fetchAll() ?: [];
    } catch (Throwable $e) {
        // Tabel belum dimigrasi: anggap belum ada profil desa.
        return [];
    }
    foreach ($rows as &$r) {
        $r['id'] = (int)$r['id'];
        $r['lembaga_id'] = (int)$r['lembaga_id'];
        $r['is_default'] = (int)$r['is_default'];
    }
    unset($r);
    return $rows;
}

/**
 * Validasi + simpan daftar profil desa (pengganti penuh per lembaga).
 * Mengembalikan profil default. Wajib: nama, kecamatan, kabupaten, kepala desa.
 */
function save_desa_daftar(int $id, $list): array
{
    if (!is_array($list)) json_err('Daftar desa tidak valid.', 422);
    $clean = [];
    $seen = [];
    foreach ($list as $item) {
        if (!is_array($item)) continue;
        $nama = norm_desa_nama((string)($item['nama_desa'] ?? ''));
        $kec = norm_desa_teks((string)($item['kecamatan'] ?? ''));
        $kab = norm_desa_teks((string)($item['kabupaten'] ?? ''));
        $kepala = norm_desa_teks((string)($item['kepala_desa'] ?? ''));
        $hp = norm_desa_teks((string)($item['kepala_desa_hp'] ?? ''));
        $alamat = trim((string)($item['desa_alamat'] ?? ''));
        $kode = norm_desa_teks((string)($item['kode_surat_desa'] ?? ''));
        $did = (int)($item['id'] ?? 0);
        $isDef = !empty($item['is_default']) ? 1 : 0;
        if ($nama === '' && $kec === '' && $kab === '' && $kepala === '' && $hp === '' && trim($alamat) === '' && $kode === '') {
            continue; // baris kosong dilewati
        }
        if ($nama === '' || $kec === '' || $kab === '' || $kepala === '') {
            json_err('Profil desa "' . ($nama !== '' ? $nama : '(tanpa nama)') . '" belum lengkap. Nama desa, kecamatan, kabupaten, dan kepala desa wajib diisi.', 422);
        }
        $key = mb_strtolower($nama);
        if (isset($seen[$key])) json_err('Nama desa "' . $nama . '" ganda dalam daftar.', 422);
        $seen[$key] = true;
        $clean[] = [
            'id' => $did, 'nama_desa' => $nama, 'kecamatan' => $kec, 'kabupaten' => $kab,
            'kepala_desa' => $kepala, 'kepala_desa_hp' => $hp, 'desa_alamat' => $alamat,
            'kode_surat_desa' => $kode, 'is_default' => $isDef,
        ];
    }
    if (!$clean) json_err('Minimal satu profil desa wajib diisi (nama, kecamatan, kabupaten, kepala desa).', 422);
    if (count($clean) > 50) json_err('Maksimal 50 profil desa per kelembagaan.', 422);

    $defIdx = 0;
    foreach ($clean as $i => $c) {
        if ((int)$c['is_default'] === 1) { $defIdx = $i; break; }
    }
    foreach ($clean as $i => $c) {
        $clean[$i]['is_default'] = ($i === $defIdx) ? 1 : 0;
    }

    $ex = pdo()->prepare('SELECT id FROM lembaga_desa WHERE lembaga_id = ?');
    $ex->execute([$id]);
    $existing = [];
    foreach ($ex->fetchAll(PDO::FETCH_COLUMN) ?: [] as $eid) {
        $existing[(int)$eid] = true;
    }

    $keep = [];
    $up = pdo()->prepare(
        'UPDATE lembaga_desa SET nama_desa=?, kecamatan=?, kabupaten=?, kepala_desa=?,
                kepala_desa_hp=?, desa_alamat=?, kode_surat_desa=?, is_default=? WHERE id=? AND lembaga_id=?'
    );
    $ins = pdo()->prepare(
        'INSERT INTO lembaga_desa (lembaga_id, nama_desa, kecamatan, kabupaten, kepala_desa,
                kepala_desa_hp, desa_alamat, kode_surat_desa, is_default)
         VALUES (?,?,?,?,?,?,?,?,?)'
    );
    foreach ($clean as $c) {
        if ($c['id'] > 0 && isset($existing[$c['id']])) {
            $up->execute([$c['nama_desa'], $c['kecamatan'], $c['kabupaten'], $c['kepala_desa'],
                $c['kepala_desa_hp'], $c['desa_alamat'], $c['kode_surat_desa'], $c['is_default'], $c['id'], $id]);
            $keep[] = $c['id'];
            if ($c['is_default'] === 1) $def = $c + ['id' => $c['id']];
        } else {
            $ins->execute([$id, $c['nama_desa'], $c['kecamatan'], $c['kabupaten'], $c['kepala_desa'],
                $c['kepala_desa_hp'], $c['desa_alamat'], $c['kode_surat_desa'], $c['is_default']]);
            $nid = (int)pdo()->lastInsertId();
            $keep[] = $nid;
            if ($c['is_default'] === 1) $def = $c + ['id' => $nid];
        }
    }
    if ($keep) {
        $ph = implode(',', array_fill(0, count($keep), '?'));
        $del = pdo()->prepare("DELETE FROM lembaga_desa WHERE lembaga_id = ? AND id NOT IN ($ph)");
        $del->execute(array_merge([$id], $keep));
    }
    if (!isset($def)) {
        $def = $clean[0] + ['id' => $keep[0]];
    }

    // Sinkron kolom tunggal lama ke profil default (kompatibilitas mundur).
    $prof = pdo()->prepare('SELECT logo_desa FROM lembaga_desa WHERE id = ? AND lembaga_id = ?');
    $prof->execute([$def['id'], $id]);
    $logoDesa = $prof->fetchColumn();
    pdo()->prepare(
        'UPDATE lembaga SET kepala_desa=?, nama_desa=?, kepala_desa_hp=?, desa_alamat=?,
                kode_surat_desa=?, logo_desa=? WHERE id=?'
    )->execute([$def['kepala_desa'], $def['nama_desa'], $def['kepala_desa_hp'],
        $def['desa_alamat'], $def['kode_surat_desa'], $logoDesa !== false ? $logoDesa : null, $id]);

    return $def;
}

if ($act === 'get') {
    $id = settings_lembaga_id();
    $st = pdo()->prepare('SELECT * FROM lembaga WHERE id = ?');
    $st->execute([$id]);
    $row = $st->fetch();
    if (!$row) json_err('Kelembagaan tidak ditemukan.', 404);
    $row['desa_daftar'] = settings_desa_list($id);
    unset($row['created_at'], $row['updated_at']);
    json_ok(['settings' => $row]);
}

if ($act === 'save') {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') json_err('Metode tidak diizinkan.', 405);
    can_ubah_pengaturan();
    $id = settings_lembaga_id();
    $d = body();
    $nama = trim((string)($d['nama_lembaga'] ?? ''));
    if ($nama === '') json_err('Nama kelembagaan wajib diisi.');
    $fields = [
        trim((string)($d['jenis_lembaga'] ?? 'KOPERASI UNIT DESA (KUD)')),
        trim((string)($d['singkatan'] ?? '')),
        $nama,
        trim((string)($d['ketua'] ?? '')),
        trim((string)($d['jabatan'] ?? '')),
        trim((string)($d['ketua_hp'] ?? '')),
        trim((string)($d['alamat'] ?? '')),
        trim((string)($d['tempat'] ?? '')),
        trim((string)($d['kode_surat'] ?? 'KUD-SS/MURA')),
        trim((string)($d['kode_surat_desa'] ?? '')),
        trim((string)($d['tahun_anggaran'] ?? date('Y'))),
        trim((string)($d['kepala_desa'] ?? '')),
        trim((string)($d['nama_desa'] ?? '')),
        trim((string)($d['kepala_desa_hp'] ?? '')),
        trim((string)($d['desa_alamat'] ?? '')),
        $id,
    ];
    if (isset($d['desa_daftar']) && is_array($d['desa_daftar'])) {
        try {
            pdo()->beginTransaction();
            pdo()->prepare(
                'UPDATE lembaga SET jenis_lembaga=?, singkatan=?, nama_lembaga=?, ketua=?, jabatan=?, ketua_hp=?, alamat=?, tempat=?, kode_surat=?, kode_surat_desa=?, tahun_anggaran=?, kepala_desa=?, nama_desa=?, kepala_desa_hp=?, desa_alamat=? WHERE id=?'
            )->execute($fields);
            save_desa_daftar($id, $d['desa_daftar']);
            pdo()->commit();
        } catch (Throwable $e) {
            if (pdo()->inTransaction()) pdo()->rollBack();
            if (stripos($e->getMessage(), 'lembaga_desa') !== false) {
                json_err('Tabel profil desa belum tersedia. Jalankan migrasi sql/migrations/0003_lembaga_desa.sql terlebih dahulu.', 500);
            }
            json_err('Gagal menyimpan pengaturan desa.', 500);
        }
        json_ok();
    }
    $st = pdo()->prepare(
        'UPDATE lembaga SET jenis_lembaga=?, singkatan=?, nama_lembaga=?, ketua=?, jabatan=?, ketua_hp=?, alamat=?, tempat=?, kode_surat=?, kode_surat_desa=?, tahun_anggaran=?, kepala_desa=?, nama_desa=?, kepala_desa_hp=?, desa_alamat=? WHERE id=?'
    );
    $st->execute($fields);
    json_ok();
}

if ($act === 'save_batas') {
    // Dinas/Admin: menetapkan batas waktu pengajuan usulan (per kelembagaan).
    // Batas waktu lewat -> lembaga terkunci otomatis (tidak bisa ajukan usulan).
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') json_err('Metode tidak diizinkan.', 405);
    $u = can('usulan.batas');
    $id = (int)($_GET['lembaga_id'] ?? 0);
    if ($id <= 0) json_err('Pilih kelembagaan terlebih dahulu.', 422);
    $st = pdo()->prepare('SELECT id FROM lembaga WHERE id = ?');
    $st->execute([$id]);
    if (!$st->fetch()) json_err('Kelembagaan tidak ditemukan.', 404);
    $d = body();
    $batas = trim((string)($d['batas_usulan'] ?? ''));
    $insert = null;
    if ($batas !== '') {
        if (!preg_match('/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/', $batas)) {
            json_err('Format batas waktu tidak valid.', 422, 'batas_format');
        }
        $insert = date('Y-m-d H:i:s', strtotime(str_replace('T', ' ', $batas)));
    }
    pdo()->prepare('UPDATE lembaga SET batas_usulan = ? WHERE id = ?')->execute([$insert, $id]);
    json_ok(['batas_usulan' => $insert]);
}

if ($act === 'logo') {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') json_err('Metode tidak diizinkan.', 405);
    can_ubah_pengaturan();
    $u = guard_role('admin', 'lembaga');
    $id = settings_lembaga_id();
    if ($u['role'] === 'lembaga') $id = (int)$u['lembaga_id'];
    $d = body();
    $logo = (string)($d['logo'] ?? '');
    $logo = substr($logo, 0, 2 * 1024 * 1024);
    $desaId = (int)($d['desa_id'] ?? 0);
    if ((string)($d['jenis'] ?? '') === 'desa' && $desaId > 0) {
        $chk = pdo()->prepare('SELECT id FROM lembaga_desa WHERE id = ? AND lembaga_id = ?');
        $chk->execute([$desaId, $id]);
        if (!$chk->fetch()) json_err('Profil desa tidak ditemukan.', 404);
        pdo()->prepare('UPDATE lembaga_desa SET logo_desa = ? WHERE id = ?')
            ->execute([$logo !== '' ? $logo : null, $desaId]);
        json_ok();
    }
    $kolom = (string)($d['jenis'] ?? '') === 'desa' ? 'logo_desa' : 'logo';
    $st = pdo()->prepare("UPDATE lembaga SET $kolom = ? WHERE id = ?");
    $st->execute([$logo !== '' ? $logo : null, $id]);
    json_ok();
}

json_err('Aksi tidak dikenal.', 404);
