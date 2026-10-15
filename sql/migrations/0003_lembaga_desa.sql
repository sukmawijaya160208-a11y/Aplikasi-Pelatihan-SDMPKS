-- ============================================================
-- SDMPKS - Migration 0003: Profil multi-desa per kelembagaan
-- Satu lembaga bisa punya lebih dari satu desa, masing-masing
-- dengan profil lengkap (kecamatan, kabupaten, kepala desa,
-- alamat, kode surat, logo).
-- Idempotent: aman dijalankan berulang kali.
-- ============================================================

CREATE TABLE IF NOT EXISTS `lembaga_desa` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `lembaga_id` int(11) NOT NULL,
  `nama_desa` varchar(120) NOT NULL DEFAULT '',
  `kecamatan` varchar(120) NOT NULL DEFAULT '',
  `kabupaten` varchar(120) NOT NULL DEFAULT '',
  `kepala_desa` varchar(120) NOT NULL DEFAULT '',
  `kepala_desa_hp` varchar(20) NOT NULL DEFAULT '',
  `desa_alamat` varchar(255) NOT NULL DEFAULT '',
  `kode_surat_desa` varchar(80) NOT NULL DEFAULT '',
  `logo_desa` mediumtext DEFAULT NULL,
  `is_default` tinyint(1) NOT NULL DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_lembaga_desa` (`lembaga_id`,`nama_desa`),
  KEY `idx_lembaga_desa_lembaga` (`lembaga_id`),
  CONSTRAINT `fk_lembaga_desa_lembaga` FOREIGN KEY (`lembaga_id`) REFERENCES `lembaga` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Backfill: satu profil default dari kolom desa lama bila ada.
INSERT INTO `lembaga_desa`
  (`lembaga_id`, `nama_desa`, `kecamatan`, `kabupaten`, `kepala_desa`,
   `kepala_desa_hp`, `desa_alamat`, `kode_surat_desa`, `logo_desa`, `is_default`)
SELECT l.`id`, TRIM(l.`nama_desa`), '', '', TRIM(l.`kepala_desa`),
       TRIM(l.`kepala_desa_hp`), TRIM(l.`desa_alamat`), TRIM(l.`kode_surat_desa`),
       l.`logo_desa`, 1
FROM `lembaga` l
WHERE TRIM(l.`nama_desa`) <> ''
  AND NOT EXISTS (SELECT 1 FROM `lembaga_desa` d WHERE d.`lembaga_id` = l.`id`);

-- Rapikan spasi nama agar urutan abjad konsisten.
UPDATE `pekebun` SET `nama` = TRIM(`nama`) WHERE `nama` <> TRIM(`nama`);
