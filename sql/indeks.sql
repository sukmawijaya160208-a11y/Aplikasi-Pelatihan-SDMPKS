-- ============================================================
-- SDMPKS - Index optimasi (idempotent, aman dijalankan ulang)
-- ============================================================
-- Setiap index dibuat HANYA jika belum ada (via dynamic SQL),
-- sehingga skrip ini boleh dijalankan berulang kali.

-- pekebun
SET @s := (SELECT IF(COUNT(*) = 0,
  'ALTER TABLE pekebun ADD INDEX idx_pekebun_lembaga_status (lembaga_id, status)',
  'SELECT ''idx_pekebun_lembaga_status sudah ada''')
FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = 'pekebun' AND index_name = 'idx_pekebun_lembaga_status');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

SET @s := (SELECT IF(COUNT(*) = 0,
  'ALTER TABLE pekebun ADD INDEX idx_pekebun_status (status)',
  'SELECT ''idx_pekebun_status sudah ada''')
FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = 'pekebun' AND index_name = 'idx_pekebun_status');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

SET @s := (SELECT IF(COUNT(*) = 0,
  'ALTER TABLE pekebun ADD INDEX idx_pekebun_tgl_input (tgl_input)',
  'SELECT ''idx_pekebun_tgl_input sudah ada''')
FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = 'pekebun' AND index_name = 'idx_pekebun_tgl_input');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

SET @s := (SELECT IF(COUNT(*) = 0,
  'ALTER TABLE pekebun ADD INDEX idx_pekebun_nik (nik)',
  'SELECT ''idx_pekebun_nik sudah ada''')
FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = 'pekebun' AND index_name = 'idx_pekebun_nik');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

-- surat
SET @s := (SELECT IF(COUNT(*) = 0,
  'ALTER TABLE surat ADD INDEX idx_surat_lembaga_jenis (lembaga_id, jenis)',
  'SELECT ''idx_surat_lembaga_jenis sudah ada''')
FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = 'surat' AND index_name = 'idx_surat_lembaga_jenis');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

SET @s := (SELECT IF(COUNT(*) = 0,
  'ALTER TABLE surat ADD INDEX idx_surat_nama (nama)',
  'SELECT ''idx_surat_nama sudah ada''')
FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = 'surat' AND index_name = 'idx_surat_nama');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

-- notifikasi
SET @s := (SELECT IF(COUNT(*) = 0,
  'ALTER TABLE notifikasi ADD INDEX idx_notif_role_dibaca (role_target, dibaca)',
  'SELECT ''idx_notif_role_dibaca sudah ada''')
FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = 'notifikasi' AND index_name = 'idx_notif_role_dibaca');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

SET @s := (SELECT IF(COUNT(*) = 0,
  'ALTER TABLE notifikasi ADD INDEX idx_notif_user_dibaca (user_id, dibaca)',
  'SELECT ''idx_notif_user_dibaca sudah ada''')
FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = 'notifikasi' AND index_name = 'idx_notif_user_dibaca');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;
