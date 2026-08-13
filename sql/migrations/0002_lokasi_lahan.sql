-- ============================================================
-- SDMPKS - Migration 0002: Lokasi Lahan pekebun
-- Menambah kolom lokasi lahan (independen dari alamat pekebun)
-- Idempotent: aman dijalankan berulang kali.
-- ============================================================

ALTER TABLE `pekebun`
  ADD COLUMN IF NOT EXISTS `lahan_provinsi` varchar(120) NOT NULL DEFAULT '' AFTER `kecamatan`,
  ADD COLUMN IF NOT EXISTS `lahan_kabupaten` varchar(120) NOT NULL DEFAULT '' AFTER `lahan_provinsi`,
  ADD COLUMN IF NOT EXISTS `lahan_kecamatan` varchar(120) NOT NULL DEFAULT '' AFTER `lahan_kabupaten`,
  ADD COLUMN IF NOT EXISTS `lahan_desa` varchar(120) NOT NULL DEFAULT '' AFTER `lahan_kecamatan`;