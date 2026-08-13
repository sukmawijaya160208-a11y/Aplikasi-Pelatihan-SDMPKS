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
        if ($val === '' || $val === '-1' || $val === '0') return 0;
        if (preg_match('/^(\d+(?:\.\d+)?)\s*([kKmMgG])?$/', $val, $m)) {
            $num = (float)$m[1];
            $unit = strtolower($m[2] ?? '');
            switch ($unit) {
                case 'g': return (int)($num * 1024 * 1024 * 1024);
                case 'm': return (int)($num * 1024 * 1024);
                case 'k': return (int)($num * 1024);
                default:  return (int)$num;
            }
        }
        return 0; // format tak dikenal -> dianggap "tidak diketahui"
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
        'sapi' => (string)php_sapi_name(),
        // Hanya nama platform (tanpa versi) agar versi web server tidak bocor.
        'server_software' => sd_server_name(),
        'memory_limit' => (string)ini_get('memory_limit'),
    ]);
}

json_err('Aksi tidak dikenal.', 404);