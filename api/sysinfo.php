<?php
// ============================================================
// SDMPKS - API Info Sistem (konfigurasi PHP yang relevan)
// act: upload_limits (nilai batas unggah untuk pre-check klien)
// ============================================================
require_once __DIR__ . '/db.php';

$act = $_GET['act'] ?? '';

if ($act === 'upload_limits') {
    $u = guard_role();

    function sdk_bytes(string $val): int
    {
        $val = trim($val);
        if ($val === '') return 0;
        $unit = strtolower(substr($val, -1));
        $num = (float)$val;
        switch ($unit) {
            case 'g': return (int)($num * 1024 * 1024 * 1024);
            case 'm': return (int)($num * 1024 * 1024);
            case 'k': return (int)($num * 1024);
            default:  return (int)$num;
        }
    }

    $up = (string)ini_get('upload_max_filesize');
    $post = (string)ini_get('post_max_size');

    json_ok([
        'upload_max_filesize' => $up,
        'upload_max_filesize_byte' => sdk_bytes($up),
        'post_max_size' => $post,
        'post_max_size_byte' => sdk_bytes($post),
        'max_file_uploads' => (string)ini_get('max_file_uploads'),
        'max_upload_app' => 5 * 1024 * 1024,
    ]);
}

json_err('Aksi tidak dikenal.', 404);