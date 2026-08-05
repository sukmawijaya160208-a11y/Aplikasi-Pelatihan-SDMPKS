<?php
// ============================================================
// SDMPKS - API Notifikasi (near real-time via polling)
// act: list | count | baca
// Scope: notifikasi broadcast (role_target) atau personal (user_id)
// ============================================================
require_once __DIR__ . '/db.php';

$act = $_GET['act'] ?? '';

function notif_scope_sql(): array
{
    $u = guard_role();
    return ['(role_target = ? OR user_id = ?)', [$u['role'], $u['id']]];
}

if ($act === 'list') {
    $u = guard_role();
    try {
        $st = pdo()->prepare(
            'SELECT * FROM notifikasi WHERE role_target = ? OR user_id = ? ORDER BY id DESC LIMIT 50'
        );
        $st->execute([$u['role'], $u['id']]);
        $rows = $st->fetchAll();
        foreach ($rows as &$r) {
            $r['waktu_label'] = waktu_relatif((string)$r['created_at']);
        }
        unset($r);
    } catch (Throwable $e) {
        $rows = [];
    }
    json_ok(['rows' => $rows]);
}

if ($act === 'count') {
    $u = guard_role();
    try {
        $st = pdo()->prepare(
            'SELECT COUNT(*) FROM notifikasi WHERE (role_target = ? OR user_id = ?) AND dibaca = 0'
        );
        $st->execute([$u['role'], $u['id']]);
        $unread = (int)$st->fetchColumn();
    } catch (Throwable $e) {
        $unread = 0;
    }
    json_ok(['unread' => $unread]);
}

if ($act === 'baca') {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') json_err('Metode tidak diizinkan.', 405);
    $u = guard_role();
    $d = body();
    $id = (int)($d['id'] ?? 0);
    try {
        if ($id > 0) {
            $st = pdo()->prepare('UPDATE notifikasi SET dibaca = 1 WHERE id = ? AND (role_target = ? OR user_id = ?)');
            $st->execute([$id, $u['role'], $u['id']]);
        } else {
            $st = pdo()->prepare('UPDATE notifikasi SET dibaca = 1 WHERE (role_target = ? OR user_id = ?) AND dibaca = 0');
            $st->execute([$u['role'], $u['id']]);
        }
    } catch (Throwable $e) {
        // abaikan
    }
    json_ok();
}

function waktu_relatif(string $tgl): string
{
    $d = strtotime($tgl);
    if (!$d) return '';
    $diff = time() - $d;
    if ($diff < 60) return 'baru saja';
    if ($diff < 3600) return floor($diff / 60) . ' mnt lalu';
    if ($diff < 86400) return floor($diff / 3600) . ' jam lalu';
    if ($diff < 172800) return 'kemarin';
    return date('d M Y, H:i', $d);
}

json_err('Aksi tidak dikenal.', 404);
