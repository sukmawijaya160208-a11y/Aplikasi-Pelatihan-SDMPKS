<?php
// ============================================================
// SDMPKS - API Data Pekebun
// act: list | save | delete | detail
// Scope: lembaga -> miliknya; admin -> semua (filter lembaga_id)
// ============================================================
require_once __DIR__ . '/db.php';

$act = $_GET['act'] ?? '';

function scope_lembaga_id(): int
{
    $u = can('data.lihat');
    if ($u['role'] === 'lembaga') return (int)$u['lembaga_id'];
    return 0; // admin: 0 = semua
}

function can_edit(int $id, ?array &$row): void
{
    $st = pdo()->prepare('SELECT * FROM pekebun WHERE id = ?');
    $st->execute([$id]);
    $row = $st->fetch();
    if (!$row) json_err('Data pekebun tidak ditemukan.', 404);
    $u = current_user();
    if ($u['role'] === 'lembaga' && (int)$row['lembaga_id'] !== (int)$u['lembaga_id']) {
        json_err('Anda tidak memiliki izin atas data ini.', 403);
    }
}

if ($act === 'list') {
    $scope = scope_lembaga_id();
    $q = trim((string)($_GET['search'] ?? ''));
    $jk = trim((string)($_GET['jk'] ?? ''));
    $status = trim((string)($_GET['status'] ?? ''));
    $duplikat = trim((string)($_GET['duplikat'] ?? ''));
    $lembagaId = (int)($_GET['lembaga_id'] ?? 0);

    $sql = 'SELECT p.id, p.lembaga_id, p.nama, p.nik, p.no_kk, p.jk, p.tempat_lahir, p.tanggal_lahir,
                   p.jenis_pelatihan, p.jalur, p.alamat, p.hp, p.desa, p.provinsi, p.kabupaten, p.kecamatan,
                   p.kepala_desa, p.agama, p.pekerjaan, p.jalan_rt_rw, p.nib, p.status_tanah, p.dipergunakan,
                   p.batas_utara, p.batas_timur, p.batas_selatan, p.batas_barat, p.tahun_kuasai, p.perolehan_dari,
                   p.perolehan_sejak, p.saksi1_nama, p.saksi1_umur, p.saksi1_pekerjaan, p.saksi1_alamat,
                   p.saksi2_nama, p.saksi2_umur, p.saksi2_pekerjaan, p.saksi2_alamat, p.luas_lahan, p.no_shm,
                   p.pemilik_sebelumnya, p.status, p.tgl_input, p.tgl_diajukan, p.tgl_verifikasi,
                   p.verifikator, p.alasan,
                   CASE WHEN p.no_kk <> "" AND EXISTS (
                       SELECT 1 FROM pekebun d
                       WHERE d.id <> p.id AND d.nik = p.nik AND d.no_kk = p.no_kk AND d.no_kk <> ""
                   ) THEN 1 ELSE 0 END AS duplikat,
                   COALESCE(l.nama_lembaga, "") AS lembaga_nama
            FROM pekebun p LEFT JOIN lembaga l ON l.id = p.lembaga_id
            WHERE 1=1';
    $params = [];
    if ($scope > 0) {
        $sql .= ' AND p.lembaga_id = ?';
        $params[] = $scope;
    } elseif ($lembagaId > 0) {
        $sql .= ' AND p.lembaga_id = ?';
        $params[] = $lembagaId;
    }
    if ($q !== '') {
        $sql .= ' AND (p.nama LIKE ? OR p.nik LIKE ?)';
        $params[] = "%$q%";
        $params[] = "%$q%";
    }
    if ($jk !== '') {
        $sql .= ' AND p.jk = ?';
        $params[] = $jk;
    }
    if ($status !== '') {
        $sql .= ' AND p.status = ?';
        $params[] = $status;
    }
    if ($duplikat === '1') {
        $sql .= ' AND p.no_kk <> "" AND EXISTS (
            SELECT 1 FROM pekebun d
            WHERE d.id <> p.id AND d.nik = p.nik AND d.no_kk = p.no_kk AND d.no_kk <> ""
        )';
    }
    $sql .= ' ORDER BY p.id DESC LIMIT 5000';
    $st = pdo()->prepare($sql);
    $st->execute($params);
    json_ok(['rows' => $st->fetchAll()]);
}

if ($act === 'detail') {
    $id = (int)($_GET['id'] ?? 0);
    can('data.lihat');
    can_edit($id, $row);
    json_ok(['row' => $row]);
}

if ($act === 'save') {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') json_err('Metode tidak diizinkan.', 405);
    $d = body();
    $id = (int)($d['id'] ?? 0);
    // RBAC: lembaga (data sendiri, terkunci saat diproses) & admin (full + override).
    // Dinas Perkebunan: verifikator pasif, TIDAK BOLEH tambah/ubah/hapus.
    $u = $id > 0 ? can('data.ubah') : can('data.tambah');
    $isAdminOverride = ($u['role'] === 'admin');

    $nama = trim((string)($d['nama'] ?? ''));
    $nik = preg_replace('/\D/', '', (string)($d['nik'] ?? ''));
    $jk = strtoupper(trim((string)($d['jk'] ?? '')));
    $noKk = substr(preg_replace('/\D/', '', (string)($d['no_kk'] ?? '')), 0, 20);
    $tempatLahir = trim((string)($d['tempat_lahir'] ?? ''));
    $tanggalLahir = trim((string)($d['tanggal_lahir'] ?? ''));
    $tanggalLahir = ($tanggalLahir !== '' && preg_match('/^\d{4}-\d{2}-\d{2}$/', $tanggalLahir)) ? $tanggalLahir : null;
    $jenisPelatihan = trim((string)($d['jenis_pelatihan'] ?? ''));
    $jalur = trim((string)($d['jalur'] ?? ''));
    $provinsi = trim((string)($d['provinsi'] ?? ''));
    $kabupaten = trim((string)($d['kabupaten'] ?? ''));
    $kecamatan = trim((string)($d['kecamatan'] ?? ''));
    $desa = trim((string)($d['desa'] ?? ''));
    $alamat = trim((string)($d['alamat'] ?? ''));
    if ($alamat === '' && $desa !== '') {
        $parts = [];
        if ($desa !== '') $parts[] = 'Desa ' . preg_replace('/^Desa\s+/i', '', $desa);
        if ($kecamatan !== '') $parts[] = 'Kecamatan ' . preg_replace('/^Kecamatan\s+/i', '', $kecamatan);
        if ($kabupaten !== '') $parts[] = 'Kabupaten ' . preg_replace('/^(Kabupaten|Kota)\s+/i', '', $kabupaten);
        if ($provinsi !== '') $parts[] = 'Provinsi ' . preg_replace('/^Provinsi\s+/i', '', $provinsi);
        $alamat = implode(', ', $parts);
    }
    $hp = trim((string)($d['hp'] ?? ''));
    $kepalaDesa = trim((string)($d['kepala_desa'] ?? ''));
    $luasLahan = str_replace(',', '.', trim((string)($d['luas_lahan'] ?? '')));
    if ($luasLahan === '' || !is_numeric($luasLahan)) $luasLahan = '0';
    $luasLahan = number_format((float)$luasLahan, 2, '.', '');
    $noShm = trim((string)($d['no_shm'] ?? ''));
    $pemilikSebelumnya = trim((string)($d['pemilik_sebelumnya'] ?? ''));
    $agama = trim((string)($d['agama'] ?? ''));
    $pekerjaan = trim((string)($d['pekerjaan'] ?? ''));
    $jalanRtRw = trim((string)($d['jalan_rt_rw'] ?? ''));
    $nib = trim((string)($d['nib'] ?? ''));
    $statusTanah = trim((string)($d['status_tanah'] ?? ''));
    $dipergunakan = trim((string)($d['dipergunakan'] ?? ''));
    $batasUtara = trim((string)($d['batas_utara'] ?? ''));
    $batasTimur = trim((string)($d['batas_timur'] ?? ''));
    $batasSelatan = trim((string)($d['batas_selatan'] ?? ''));
    $batasBarat = trim((string)($d['batas_barat'] ?? ''));
    $tahunKuasai = trim((string)($d['tahun_kuasai'] ?? ''));
    $perolehanDari = trim((string)($d['perolehan_dari'] ?? ''));
    $perolehanSejak = trim((string)($d['perolehan_sejak'] ?? ''));
    $saksi1Nama = trim((string)($d['saksi1_nama'] ?? ''));
    $saksi1Umur = trim((string)($d['saksi1_umur'] ?? ''));
    $saksi1Pekerjaan = trim((string)($d['saksi1_pekerjaan'] ?? ''));
    $saksi1Alamat = trim((string)($d['saksi1_alamat'] ?? ''));
    $saksi2Nama = trim((string)($d['saksi2_nama'] ?? ''));
    $saksi2Umur = trim((string)($d['saksi2_umur'] ?? ''));
    $saksi2Pekerjaan = trim((string)($d['saksi2_pekerjaan'] ?? ''));
    $saksi2Alamat = trim((string)($d['saksi2_alamat'] ?? ''));

    if ($nama === '') json_err('Nama wajib diisi.');
    if (!preg_match('/^\d{16}$/', $nik)) json_err('NIK harus 16 digit angka.');
    if (!in_array($jk, ['LAKI-LAKI', 'PEREMPUAN'], true)) json_err('Jenis kelamin tidak valid.');
    if ($alamat === '') json_err('Alamat wajib diisi.');
    $digits = preg_replace('/\D/', '', $hp);
    if (strlen($digits) < 10 || strlen($digits) > 15) json_err('Nomor handphone tidak valid (minimal 10 digit).');

    $st = pdo()->prepare('SELECT id FROM pekebun WHERE nik = ? AND id <> ?');
    $st->execute([$nik, $id]);
    if ($st->fetch()) json_err('NIK ' . $nik . ' sudah terdaftar pada data lain.');

    if ($id > 0) {
        $old = null;
        can_edit($id, $old);
        if (!$isAdminOverride && in_array($old['status'], ['diajukan', 'disetujui'], true)) {
            json_err('Berkas sedang diproses (menunggu verifikasi / disetujui) dan tidak dapat diubah.');
        }
        $st = pdo()->prepare(
            'UPDATE pekebun SET nama=?, nik=?, no_kk=?, jk=?, tempat_lahir=?, tanggal_lahir=?, jenis_pelatihan=?, jalur=?, alamat=?, hp=?, desa=?, provinsi=?, kabupaten=?, kecamatan=?, luas_lahan=?, no_shm=?, pemilik_sebelumnya=?, kepala_desa=?, agama=?, pekerjaan=?, jalan_rt_rw=?, nib=?, status_tanah=?, dipergunakan=?, batas_utara=?, batas_timur=?, batas_selatan=?, batas_barat=?, tahun_kuasai=?, perolehan_dari=?, perolehan_sejak=?, saksi1_nama=?, saksi1_umur=?, saksi1_pekerjaan=?, saksi1_alamat=?, saksi2_nama=?, saksi2_umur=?, saksi2_pekerjaan=?, saksi2_alamat=? WHERE id=?'
        );
        $st->execute([$nama, $nik, $noKk, $jk, $tempatLahir, $tanggalLahir, $jenisPelatihan, $jalur, $alamat, $hp, $desa, $provinsi, $kabupaten, $kecamatan, $luasLahan, $noShm, $pemilikSebelumnya, $kepalaDesa, $agama, $pekerjaan, $jalanRtRw, $nib, $statusTanah, $dipergunakan, $batasUtara, $batasTimur, $batasSelatan, $batasBarat, $tahunKuasai, $perolehanDari, $perolehanSejak, $saksi1Nama, $saksi1Umur, $saksi1Pekerjaan, $saksi1Alamat, $saksi2Nama, $saksi2Umur, $saksi2Pekerjaan, $saksi2Alamat, $id]);
        if ($isAdminOverride) {
            $riwayat = json_decode((string)($old['riwayat'] ?? '[]'), true) ?: [];
            $riwayat[] = ['aksi' => 'diperbarui', 'tgl' => date('Y-m-d H:i:s'), 'oleh' => $u['nama'] ?: 'Administrator'];
            pdo()->prepare('UPDATE pekebun SET riwayat = ? WHERE id = ?')
                ->execute([json_encode($riwayat, JSON_UNESCAPED_UNICODE), $id]);
        }
        json_ok(['id' => $id]);
    } else {
        if ($u['role'] === 'lembaga') {
            $lembagaId = (int)$u['lembaga_id'];
        } else {
            $lembagaId = (int)($d['lembaga_id'] ?? 0);
            if ($lembagaId <= 0) json_err('Pilih kelembagaan pemilik data.');
        }
        $st = pdo()->prepare(
            'INSERT INTO pekebun (lembaga_id, nama, nik, no_kk, jk, tempat_lahir, tanggal_lahir, jenis_pelatihan, jalur, alamat, hp, desa, provinsi, kabupaten, kecamatan, luas_lahan, no_shm, pemilik_sebelumnya, kepala_desa, agama, pekerjaan, jalan_rt_rw, nib, status_tanah, dipergunakan, batas_utara, batas_timur, batas_selatan, batas_barat, tahun_kuasai, perolehan_dari, perolehan_sejak, saksi1_nama, saksi1_umur, saksi1_pekerjaan, saksi1_alamat, saksi2_nama, saksi2_umur, saksi2_pekerjaan, saksi2_alamat)
             VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)'
        );
        $st->execute([$lembagaId, $nama, $nik, $noKk, $jk, $tempatLahir, $tanggalLahir, $jenisPelatihan, $jalur, $alamat, $hp, $desa, $provinsi, $kabupaten, $kecamatan, $luasLahan, $noShm, $pemilikSebelumnya, $kepalaDesa, $agama, $pekerjaan, $jalanRtRw, $nib, $statusTanah, $dipergunakan, $batasUtara, $batasTimur, $batasSelatan, $batasBarat, $tahunKuasai, $perolehanDari, $perolehanSejak, $saksi1Nama, $saksi1Umur, $saksi1Pekerjaan, $saksi1Alamat, $saksi2Nama, $saksi2Umur, $saksi2Pekerjaan, $saksi2Alamat]);
        json_ok(['id' => (int)pdo()->lastInsertId()]);
    }
}

if ($act === 'delete') {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') json_err('Metode tidak diizinkan.', 405);
    $u = can('data.hapus');
    $isAdminOverride = ($u['role'] === 'admin');
    $d = body();
    $id = (int)($d['id'] ?? 0);
    $old = null;
    can_edit($id, $old);
    if (!$isAdminOverride && in_array($old['status'], ['diajukan', 'disetujui'], true)) {
        json_err('Berkas sedang diproses (menunggu verifikasi / disetujui) dan tidak dapat dihapus.');
    }
    $st = pdo()->prepare('DELETE FROM pekebun WHERE id = ?');
    $st->execute([$id]);
    $dir = __DIR__ . '/../uploads/pekebun/' . $id;
    if (is_dir($dir)) {
        foreach (glob($dir . '/*') ?: [] as $f) {
            if (is_file($f)) @unlink($f);
        }
        @rmdir($dir);
    }
    json_ok();
}

if ($act === 'import') {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') json_err('Metode tidak diizinkan.', 405);
    $u = can('data.import');
    $d = body();
    $rows = is_array($d['rows'] ?? null) ? $d['rows'] : [];
    if ($u['role'] === 'lembaga') {
        $lembagaId = (int)$u['lembaga_id'];
    } else {
        $lembagaId = (int)($d['lembaga_id'] ?? 0);
        if ($lembagaId <= 0) json_err('Pilih kelembagaan pemilik data.');
    }
    $existing = array_flip(pdo()->query('SELECT nik FROM pekebun')->fetchAll(PDO::FETCH_COLUMN));
    $ins = pdo()->prepare(
        'INSERT INTO pekebun (lembaga_id, nama, nik, no_kk, jk, tempat_lahir, tanggal_lahir, jenis_pelatihan, jalur, alamat, hp, desa, provinsi, kabupaten, kecamatan, luas_lahan, no_shm, pemilik_sebelumnya, kepala_desa, agama, pekerjaan, jalan_rt_rw, nib, status_tanah, dipergunakan, batas_utara, batas_timur, batas_selatan, batas_barat, tahun_kuasai, perolehan_dari, perolehan_sejak, saksi1_nama, saksi1_umur, saksi1_pekerjaan, saksi1_alamat, saksi2_nama, saksi2_umur, saksi2_pekerjaan, saksi2_alamat) VALUES (' . implode(',', array_fill(0, 40, '?')) . ')'
    );
    $ok = 0;
    $skip = 0;
    foreach ($rows as $r) {
        if (!is_array($r)) { $skip++; continue; }
        $nama = trim((string)($r['nama'] ?? ''));
        $nik = preg_replace('/\D/', '', (string)($r['nik'] ?? ''));
        $jk = strtoupper(trim((string)($r['jk'] ?? '')));
        if ($jk === 'LAKI LAKI' || $jk === 'LAKI-LAKI') $jk = 'LAKI-LAKI';
        if ($jk === 'PEREMPUAN') $jk = 'PEREMPUAN';
        $noKk = substr(preg_replace('/\D/', '', (string)($r['no_kk'] ?? '')), 0, 20);
        $tempatLahir = trim((string)($r['tempat_lahir'] ?? ''));
        $tanggalLahir = trim((string)($r['tanggal_lahir'] ?? ''));
        $tanggalLahir = ($tanggalLahir !== '' && preg_match('/^\d{4}-\d{2}-\d{2}$/', $tanggalLahir)) ? $tanggalLahir : null;
        $jenisPelatihan = trim((string)($r['jenis_pelatihan'] ?? ''));
        $jalur = trim((string)($r['jalur'] ?? ''));
        $provinsi = trim((string)($r['provinsi'] ?? ''));
        $kabupaten = trim((string)($r['kabupaten'] ?? ''));
        $kecamatan = trim((string)($r['kecamatan'] ?? ''));
        $alamat = trim((string)($r['alamat'] ?? ''));
        $desa = trim((string)($r['desa'] ?? ''));
        if ($alamat === '' && $desa !== '') {
            $parts = [];
            if ($desa !== '') $parts[] = 'Desa ' . preg_replace('/^Desa\s+/i', '', $desa);
            if ($kecamatan !== '') $parts[] = 'Kecamatan ' . preg_replace('/^Kecamatan\s+/i', '', $kecamatan);
            if ($kabupaten !== '') $parts[] = 'Kabupaten ' . preg_replace('/^(Kabupaten|Kota)\s+/i', '', $kabupaten);
            if ($provinsi !== '') $parts[] = 'Provinsi ' . preg_replace('/^Provinsi\s+/i', '', $provinsi);
            $alamat = implode(', ', $parts);
        }
        $hp = trim((string)($r['hp'] ?? ''));
        $kepalaDesa = trim((string)($r['kepala_desa'] ?? ''));
        $luas = str_replace(',', '.', trim((string)($r['luas_lahan'] ?? '')));
        if ($luas === '' || !is_numeric($luas)) $luas = '0';
        $luas = number_format((float)$luas, 2, '.', '');
        $noShm = trim((string)($r['no_shm'] ?? ''));
        $pemilikSebelumnya = trim((string)($r['pemilik_sebelumnya'] ?? ''));
        $agama = trim((string)($r['agama'] ?? ''));
        $pekerjaan = trim((string)($r['pekerjaan'] ?? ''));
        $jalanRtRw = trim((string)($r['jalan_rt_rw'] ?? ''));
        $nib = trim((string)($r['nib'] ?? ''));
        $statusTanah = trim((string)($r['status_tanah'] ?? ''));
        $dipergunakan = trim((string)($r['dipergunakan'] ?? ''));
        $batasUtara = trim((string)($r['batas_utara'] ?? ''));
        $batasTimur = trim((string)($r['batas_timur'] ?? ''));
        $batasSelatan = trim((string)($r['batas_selatan'] ?? ''));
        $batasBarat = trim((string)($r['batas_barat'] ?? ''));
        $tahunKuasai = trim((string)($r['tahun_kuasai'] ?? ''));
        $perolehanDari = trim((string)($r['perolehan_dari'] ?? ''));
        $perolehanSejak = trim((string)($r['perolehan_sejak'] ?? ''));
        $s1Nama = trim((string)($r['saksi1_nama'] ?? ''));
        $s1Umur = trim((string)($r['saksi1_umur'] ?? ''));
        $s1Pekerjaan = trim((string)($r['saksi1_pekerjaan'] ?? ''));
        $s1Alamat = trim((string)($r['saksi1_alamat'] ?? ''));
        $s2Nama = trim((string)($r['saksi2_nama'] ?? ''));
        $s2Umur = trim((string)($r['saksi2_umur'] ?? ''));
        $s2Pekerjaan = trim((string)($r['saksi2_pekerjaan'] ?? ''));
        $s2Alamat = trim((string)($r['saksi2_alamat'] ?? ''));
        if ($nama === '' && $nik === '' && $noKk === '') continue;
        if ($nama === '' || !preg_match('/^\d{16}$/', $nik) || !preg_match('/^\d{16}$/', $noKk) ||
            !in_array($jk, ['LAKI-LAKI', 'PEREMPUAN'], true) ||
            $jenisPelatihan === '' || $jalur === '' || $provinsi === '' || $kabupaten === '' ||
            $kecamatan === '' || $desa === '' || $kepalaDesa === '') { $skip++; continue; }
        if (isset($existing[$nik])) { $skip++; continue; }
        $ins->execute([$lembagaId, $nama, $nik, $noKk, $jk, $tempatLahir, $tanggalLahir, $jenisPelatihan, $jalur, $alamat, $hp, $desa, $provinsi, $kabupaten, $kecamatan, $luas, $noShm, $pemilikSebelumnya, $kepalaDesa, $agama, $pekerjaan, $jalanRtRw, $nib, $statusTanah, $dipergunakan, $batasUtara, $batasTimur, $batasSelatan, $batasBarat, $tahunKuasai, $perolehanDari, $perolehanSejak, $s1Nama, $s1Umur, $s1Pekerjaan, $s1Alamat, $s2Nama, $s2Umur, $s2Pekerjaan, $s2Alamat]);
        $existing[$nik] = true;
        $ok++;
    }
    json_ok(['ok_count' => $ok, 'skip_count' => $skip]);
}

json_err('Aksi tidak dikenal.', 404);
