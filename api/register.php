<?php
// ============================================================
// SDMPKS - API Pendaftaran Akun Lembaga Pekebun (publik)
// act: register
// Nomor HP menjadi username akun lembaga yang terdaftar.
// ============================================================
require_once __DIR__ . '/db.php';

$act = $_GET['act'] ?? '';

if ($act === 'register') {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') json_err('Metode tidak diizinkan.', 405);

    // Anti spam pendaftaran: maksimal 5 pendaftaran per 60 menit per IP.
    $rlKey = 'register:' . sd_client_ip();
    $sisa = rate_limit_hit($rlKey, 5, 3600, 3600);
    if ($sisa > 0) {
        json_err('Terlalu banyak pendaftaran dari perangkat ini. Coba lagi dalam ' . ceil($sisa / 60) . ' menit.', 429, 'rate_limited');
    }

    $d = body();

    $hp = preg_replace('/\D/', '', trim((string)($d['no_hp'] ?? '')));
    $password = (string)($d['password'] ?? '');
    $namaLembaga = trim((string)($d['nama_lembaga'] ?? ''));
    $jenis = trim((string)($d['jenis_lembaga'] ?? 'KOPERASI UNIT DESA (KUD)'));
    $singkatan = trim((string)($d['singkatan'] ?? ''));
    $ketua = trim((string)($d['ketua'] ?? ''));
    $jabatan = trim((string)($d['jabatan'] ?? ''));
    $alamat = trim((string)($d['alamat'] ?? ''));
    $tempat = trim((string)($d['tempat'] ?? ''));
    $kode = trim((string)($d['kode_surat'] ?? ''));
    $tahun = trim((string)($d['tahun_anggaran'] ?? date('Y')));
    $kepalaDesa = trim((string)($d['kepala_desa'] ?? ''));

    if ($namaLembaga === '') json_err('Nama kelembagaan wajib diisi.', 422, 'nama_wajib');
    if ($jenis === '') $jenis = 'KOPERASI UNIT DESA (KUD)';
    if (!preg_match('/^08\d{8,12}$/', $hp)) {
        json_err('Nomor HP tidak valid. Gunakan format 08xxxxxxxxxx.', 422, 'no_hp_invalid');
    }
    if (strlen($password) < 8) json_err('Password minimal 8 karakter.', 422, 'password_pendek');
    if (!preg_match('/^\d{4}$/', $tahun)) json_err('Tahun anggaran tidak valid.', 422, 'tahun_invalid');

    $chk = pdo()->prepare('SELECT id FROM users WHERE username = ?');
    $chk->execute([$hp]);
    if ($chk->fetch()) {
        json_err('Nomor HP ' . $hp . ' sudah terdaftar. Gunakan nomor lain atau masuk dengan akun yang ada.', 422, 'hp_terpakai');
    }

    $chk2 = pdo()->prepare('SELECT id FROM lembaga WHERE nama_lembaga = ?');
    $chk2->execute([$namaLembaga]);
    if ($chk2->fetch()) {
        json_err('Nama kelembagaan "' . $namaLembaga . '" sudah terdaftar.', 422, 'lembaga_terdaftar');
    }

    try {
        pdo()->beginTransaction();
        $st = pdo()->prepare(
            'INSERT INTO lembaga (jenis_lembaga, singkatan, nama_lembaga, ketua, jabatan, alamat, tempat, kode_surat, tahun_anggaran, kepala_desa, batas_usulan)
             VALUES (?,?,?,?,?,?,?,?,?,?,NULL)'
        );
        $st->execute([$jenis, $singkatan, $namaLembaga, $ketua, $jabatan, $alamat, $tempat, $kode, $tahun, $kepalaDesa]);
        $lembagaId = (int)pdo()->lastInsertId();

        $us = pdo()->prepare('INSERT INTO users (username, password, nama, role, lembaga_id, aktif) VALUES (?,?,?,?,?,0)');
        $us->execute([$hp, password_hash($password, PASSWORD_DEFAULT), $namaLembaga, 'lembaga', $lembagaId]);
        pdo()->commit();
    } catch (Throwable $e) {
        if (pdo()->inTransaction()) pdo()->rollBack();
        json_err('Pendaftaran gagal. Silakan coba lagi.', 500);
    }

    kirim_notifikasi('admin', 'Pendaftaran lembaga baru', 'Lembaga "' . $namaLembaga . '" (No. HP ' . $hp . ') baru terdaftar dan menunggu persetujuan Administrator.', 'info', null);
    json_ok(['lembaga_id' => $lembagaId, 'username' => $hp, 'nama' => $namaLembaga]);
}

json_err('Aksi tidak dikenal.', 404);
