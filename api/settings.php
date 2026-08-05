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

if ($act === 'get') {
    $id = settings_lembaga_id();
    $st = pdo()->prepare('SELECT * FROM lembaga WHERE id = ?');
    $st->execute([$id]);
    $row = $st->fetch();
    if (!$row) json_err('Kelembagaan tidak ditemukan.', 404);
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
    $st = pdo()->prepare(
        'UPDATE lembaga SET jenis_lembaga=?, singkatan=?, nama_lembaga=?, ketua=?, jabatan=?, ketua_hp=?, alamat=?, tempat=?, kode_surat=?, kode_surat_desa=?, tahun_anggaran=?, kepala_desa=?, nama_desa=?, kepala_desa_hp=?, desa_alamat=? WHERE id=?'
    );
    $st->execute([
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
    ]);
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
    $kolom = (string)($d['jenis'] ?? '') === 'desa' ? 'logo_desa' : 'logo';
    $st = pdo()->prepare("UPDATE lembaga SET $kolom = ? WHERE id = ?");
    $st->execute([$logo !== '' ? $logo : null, $id]);
    json_ok();
}

json_err('Aksi tidak dikenal.', 404);
