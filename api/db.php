<?php
// ============================================================
// SDMPKS - Koneksi PDO & Helper API
// ============================================================
require_once __DIR__ . '/config.php';

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');

function pdo(): PDO
{
    static $pdo = null;
    if ($pdo === null) {
        $dsn = 'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=utf8mb4';
        $pdo = new PDO($dsn, DB_USER, DB_PASS, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ]);
    }
    return $pdo;
}

function json_out($data, int $code = 200): void
{
    http_response_code($code);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function json_ok($data = null): void
{
    json_out($data === null ? ['ok' => true] : array_merge(['ok' => true], is_array($data) ? $data : ['data' => $data]));
}

function json_err(string $msg, int $code = 400, string $errCode = '', array $detail = []): void
{
    $out = ['ok' => false, 'error' => $msg];
    if ($errCode !== '') $out['code'] = $errCode;
    if ($detail) $out['detail'] = $detail;
    json_out($out, $code);
}

function body(): array
{
    $raw = file_get_contents('php://input');
    $d = json_decode($raw, true);
    return is_array($d) ? $d : [];
}

function current_user(): ?array
{
    return isset($_SESSION['user']) && is_array($_SESSION['user']) ? $_SESSION['user'] : null;
}

/** Guard: wajib login; jika $roles diisi, wajib salah satu role tersebut. */
function guard_role(...$roles): array
{
    $u = current_user();
    if (!$u) json_err('Sesi berakhir. Silakan masuk kembali.', 401);
    if ($roles && !in_array($u['role'], $roles, true)) {
        json_err('Anda tidak memiliki izin untuk aksi ini.', 403);
    }
    return $u;
}

/* ============================================================
   RBAC (Role-Based Access Control)
   Izin diambil dari tabel roles -> role_permissions -> permissions.
   Fallback: bila tabel belum tersedia/terisi, gunakan pemetaan statis
   agar aplikasi tidak pernah kehilangan izin (jaring pengaman migrasi).
   ============================================================ */

function fallback_permissions(string $role): array
{
    $all = [
        'dashboard.lihat', 'data.lihat', 'data.tambah', 'data.ubah', 'data.hapus', 'data.import',
        'usulan.ajukan', 'usulan.setujui', 'usulan.kembalikan', 'usulan.override', 'usulan.riwayat', 'usulan.batas', 'usulan.batalkan',
        'dokumen.unggah', 'dokumen.hapus', 'surat.tambah', 'surat.hapus',
        'lembaga.kelola', 'akun.kelola', 'pengaturan.ubah',
    ];
    if ($role === 'admin') return $all;
    if ($role === 'dinas') return ['dashboard.lihat', 'data.lihat', 'usulan.setujui', 'usulan.kembalikan', 'usulan.riwayat', 'usulan.batas', 'usulan.batalkan'];
    return [
        'dashboard.lihat', 'data.lihat', 'data.tambah', 'data.ubah', 'data.hapus', 'data.import',
        'usulan.ajukan', 'usulan.riwayat', 'dokumen.unggah', 'dokumen.hapus',
        'surat.tambah', 'surat.hapus', 'pengaturan.ubah',
    ];
}

function user_permissions(): array
{
    static $cache = [];
    $u = current_user();
    if (!$u) return [];
    if (isset($cache[$u['id']])) return $cache[$u['id']];
    $perms = [];
    try {
        $st = pdo()->prepare(
            'SELECT p.kode FROM permissions p
             JOIN role_permissions rp ON rp.permission_id = p.id
             JOIN roles r ON r.id = rp.role_id
             WHERE r.kode = ?'
        );
        $st->execute([$u['role']]);
        $perms = $st->fetchAll(PDO::FETCH_COLUMN);
    } catch (Throwable $e) {
        $perms = [];
    }
    if (!$perms) $perms = fallback_permissions($u['role']);
    $cache[$u['id']] = $perms;
    return $perms;
}

function user_can(string $perm): bool
{
    return in_array($perm, user_permissions(), true);
}

/** Guard berbasis izin: wajib login + punya izin $perm. */
function can(string $perm): array
{
    $u = guard_role();
    if (!user_can($perm)) json_err('Anda tidak memiliki izin untuk aksi ini.', 403);
    return $u;
}

/* ============================================================
   NOTIFIKASI (near real-time via polling)
   ============================================================ */

/**
 * Kirim notifikasi. Jika $userId diberikan -> personal;
 * jika tidak -> broadcast ke semua user dengan role $roleTarget.
 * Gagal diam-diam agar tidak mengganggu alur utama.
 */
function kirim_notifikasi(string $roleTarget, string $judul, string $pesan = '', string $tipe = 'info', ?string $link = null, ?int $userId = null): void
{
    try {
        $st = pdo()->prepare('INSERT INTO notifikasi (user_id, role_target, judul, pesan, tipe, link) VALUES (?,?,?,?,?,?)');
        if ($userId !== null) {
            $st->execute([$userId, null, $judul, $pesan, $tipe, $link]);
        } else {
            $st->execute([null, $roleTarget, $judul, $pesan, $tipe, $link]);
        }
    } catch (Throwable $e) {
        // abaikan
    }
}

/** Kirim notifikasi ke semua akun lembaga pemilik usulan. */
function kirim_notifikasi_lembaga(int $lembagaId, string $judul, string $pesan = '', string $tipe = 'info', ?string $link = null): void
{
    try {
        $st = pdo()->prepare('SELECT id FROM users WHERE lembaga_id = ? AND role = "lembaga" AND aktif = 1');
        $st->execute([$lembagaId]);
        foreach ($st->fetchAll(PDO::FETCH_COLUMN) as $uid) {
            kirim_notifikasi('lembaga', $judul, $pesan, $tipe, $link, (int)$uid);
        }
    } catch (Throwable $e) {
        // abaikan
    }
}

function db_err_msg(string $fallback): string
{
    return $fallback . ' Silakan coba lagi.';
}
