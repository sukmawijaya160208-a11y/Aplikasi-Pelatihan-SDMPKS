-- MariaDB dump 10.19  Distrib 10.4.32-MariaDB, for Win64 (AMD64)
--
-- Host: localhost    Database: sdmpks_db
-- ------------------------------------------------------
-- Server version	10.4.32-MariaDB

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `counters`
--

DROP TABLE IF EXISTS `counters`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `counters` (
  `lembaga_id` int(11) NOT NULL,
  `jenis` varchar(20) NOT NULL,
  `nilai` int(11) NOT NULL DEFAULT 0,
  PRIMARY KEY (`lembaga_id`,`jenis`),
  CONSTRAINT `fk_counters_lembaga` FOREIGN KEY (`lembaga_id`) REFERENCES `lembaga` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `dokumen`
--

DROP TABLE IF EXISTS `dokumen`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `dokumen` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `pekebun_id` int(11) NOT NULL,
  `nama_asli` varchar(255) NOT NULL,
  `file_name` varchar(255) NOT NULL,
  `tipe` varchar(80) NOT NULL DEFAULT 'application/pdf',
  `ukuran` int(11) NOT NULL DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `fk_dokumen_pekebun` (`pekebun_id`),
  CONSTRAINT `fk_dokumen_pekebun` FOREIGN KEY (`pekebun_id`) REFERENCES `pekebun` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=43 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `lembaga`
--

DROP TABLE IF EXISTS `lembaga`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `lembaga` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `jenis_lembaga` varchar(120) NOT NULL DEFAULT 'KOPERASI UNIT DESA (KUD)',
  `singkatan` varchar(80) NOT NULL DEFAULT '',
  `nama_lembaga` varchar(180) NOT NULL,
  `ketua` varchar(120) NOT NULL DEFAULT '',
  `jabatan` varchar(120) NOT NULL DEFAULT '',
  `ketua_hp` varchar(20) NOT NULL DEFAULT '',
  `alamat` varchar(255) NOT NULL DEFAULT '',
  `tempat` varchar(120) NOT NULL DEFAULT '',
  `kode_surat` varchar(80) NOT NULL DEFAULT 'KUD-SS/MURA',
  `kode_surat_desa` varchar(80) NOT NULL DEFAULT '',
  `tahun_anggaran` varchar(10) NOT NULL DEFAULT '2025',
  `batas_usulan` datetime DEFAULT NULL,
  `kepala_desa` varchar(120) NOT NULL DEFAULT '',
  `nama_desa` varchar(120) NOT NULL DEFAULT '',
  `kepala_desa_hp` varchar(20) NOT NULL DEFAULT '',
  `desa_alamat` varchar(255) NOT NULL DEFAULT '',
  `logo` mediumtext DEFAULT NULL,
  `logo_desa` mediumtext DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=46 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `notifikasi`
--

DROP TABLE IF EXISTS `notifikasi`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `notifikasi` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) DEFAULT NULL,
  `role_target` varchar(20) DEFAULT NULL,
  `judul` varchar(180) NOT NULL,
  `pesan` text DEFAULT NULL,
  `tipe` varchar(12) NOT NULL DEFAULT 'info',
  `link` varchar(120) DEFAULT NULL,
  `dibaca` tinyint(1) NOT NULL DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_notif_role_dibaca` (`role_target`,`dibaca`),
  KEY `idx_notif_user_dibaca` (`user_id`,`dibaca`),
  CONSTRAINT `fk_notif_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=162 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `pekebun`
--

DROP TABLE IF EXISTS `pekebun`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `pekebun` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `lembaga_id` int(11) NOT NULL,
  `nama` varchar(150) NOT NULL,
  `nik` varchar(16) NOT NULL,
  `no_kk` varchar(20) NOT NULL DEFAULT '',
  `jk` enum('LAKI-LAKI','PEREMPUAN') NOT NULL,
  `tempat_lahir` varchar(100) NOT NULL DEFAULT '',
  `tanggal_lahir` date DEFAULT NULL,
  `jenis_pelatihan` varchar(80) NOT NULL DEFAULT '',
  `jalur` varchar(120) NOT NULL DEFAULT '',
  `alamat` text DEFAULT NULL,
  `hp` varchar(20) NOT NULL DEFAULT '',
  `desa` varchar(120) NOT NULL DEFAULT '',
  `provinsi` varchar(120) NOT NULL DEFAULT '',
  `kabupaten` varchar(120) NOT NULL DEFAULT '',
  `kecamatan` varchar(120) NOT NULL DEFAULT '',
  `luas_lahan` decimal(12,2) NOT NULL DEFAULT 0.00,
  `no_shm` varchar(40) NOT NULL DEFAULT '',
  `pemilik_sebelumnya` varchar(120) NOT NULL DEFAULT '',
  `kepala_desa` varchar(120) NOT NULL DEFAULT '',
  `agama` varchar(100) NOT NULL DEFAULT '',
  `pekerjaan` varchar(100) NOT NULL DEFAULT '',
  `jalan_rt_rw` varchar(120) NOT NULL DEFAULT '',
  `nib` varchar(80) NOT NULL DEFAULT '',
  `status_tanah` varchar(100) NOT NULL DEFAULT '',
  `dipergunakan` varchar(150) NOT NULL DEFAULT '',
  `batas_utara` varchar(120) NOT NULL DEFAULT '',
  `batas_timur` varchar(120) NOT NULL DEFAULT '',
  `batas_selatan` varchar(120) NOT NULL DEFAULT '',
  `batas_barat` varchar(120) NOT NULL DEFAULT '',
  `tahun_kuasai` varchar(10) NOT NULL DEFAULT '',
  `perolehan_dari` varchar(120) NOT NULL DEFAULT '',
  `perolehan_sejak` varchar(10) NOT NULL DEFAULT '',
  `saksi1_nama` varchar(150) NOT NULL DEFAULT '',
  `saksi1_umur` varchar(10) NOT NULL DEFAULT '',
  `saksi1_pekerjaan` varchar(100) NOT NULL DEFAULT '',
  `saksi1_alamat` varchar(200) NOT NULL DEFAULT '',
  `saksi2_nama` varchar(150) NOT NULL DEFAULT '',
  `saksi2_umur` varchar(10) NOT NULL DEFAULT '',
  `saksi2_pekerjaan` varchar(100) NOT NULL DEFAULT '',
  `saksi2_alamat` varchar(200) NOT NULL DEFAULT '',
  `status` enum('draft','diajukan','disetujui','dikembalikan') NOT NULL DEFAULT 'draft',
  `tgl_input` datetime NOT NULL DEFAULT current_timestamp(),
  `tgl_diajukan` datetime DEFAULT NULL,
  `tgl_verifikasi` datetime DEFAULT NULL,
  `verifikator` varchar(120) DEFAULT NULL,
  `alasan` text DEFAULT NULL,
  `riwayat` mediumtext DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `nik` (`nik`),
  KEY `idx_pekebun_lembaga_status` (`lembaga_id`,`status`),
  KEY `idx_pekebun_status` (`status`),
  KEY `idx_pekebun_tgl_input` (`tgl_input`),
  KEY `idx_pekebun_nik` (`nik`),
  CONSTRAINT `fk_pekebun_lembaga` FOREIGN KEY (`lembaga_id`) REFERENCES `lembaga` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=217 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `permissions`
--

DROP TABLE IF EXISTS `permissions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `permissions` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `kode` varchar(60) NOT NULL,
  `nama` varchar(80) NOT NULL,
  `kelompok` varchar(40) NOT NULL DEFAULT '',
  `deskripsi` varchar(255) NOT NULL DEFAULT '',
  PRIMARY KEY (`id`),
  UNIQUE KEY `kode` (`kode`)
) ENGINE=InnoDB AUTO_INCREMENT=57 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `role_permissions`
--

DROP TABLE IF EXISTS `role_permissions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `role_permissions` (
  `role_id` int(11) NOT NULL,
  `permission_id` int(11) NOT NULL,
  PRIMARY KEY (`role_id`,`permission_id`),
  KEY `fk_rp_perm` (`permission_id`),
  CONSTRAINT `fk_rp_perm` FOREIGN KEY (`permission_id`) REFERENCES `permissions` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_rp_role` FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `roles`
--

DROP TABLE IF EXISTS `roles`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `roles` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `kode` varchar(20) NOT NULL,
  `nama` varchar(60) NOT NULL,
  `deskripsi` varchar(255) NOT NULL DEFAULT '',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `kode` (`kode`)
) ENGINE=InnoDB AUTO_INCREMENT=10 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `surat`
--

DROP TABLE IF EXISTS `surat`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `surat` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `lembaga_id` int(11) NOT NULL,
  `pekebun_id` int(11) DEFAULT NULL,
  `jenis` varchar(20) NOT NULL,
  `jenis_label` varchar(180) NOT NULL DEFAULT '',
  `no_surat` varchar(120) NOT NULL DEFAULT '',
  `nama` varchar(150) NOT NULL DEFAULT '',
  `tanggal` date DEFAULT NULL,
  `tanggal_label` varchar(60) NOT NULL DEFAULT '',
  `html` mediumtext NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_surat_lembaga_jenis` (`lembaga_id`,`jenis`),
  KEY `idx_surat_nama` (`nama`),
  CONSTRAINT `fk_surat_lembaga` FOREIGN KEY (`lembaga_id`) REFERENCES `lembaga` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=137 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `users` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `username` varchar(60) NOT NULL,
  `password` varchar(255) NOT NULL,
  `nama` varchar(120) NOT NULL DEFAULT '',
  `role` enum('admin','dinas','lembaga') NOT NULL,
  `lembaga_id` int(11) DEFAULT NULL,
  `aktif` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `username` (`username`),
  KEY `fk_users_lembaga` (`lembaga_id`),
  CONSTRAINT `fk_users_lembaga` FOREIGN KEY (`lembaga_id`) REFERENCES `lembaga` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=116 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Temporary table structure for view `usulan`
--

DROP TABLE IF EXISTS `usulan`;
/*!50001 DROP VIEW IF EXISTS `usulan`*/;
SET @saved_cs_client     = @@character_set_client;
SET character_set_client = utf8;
/*!50001 CREATE VIEW `usulan` AS SELECT
 1 AS `id`,
  1 AS `lembaga_id`,
  1 AS `nama`,
  1 AS `nik`,
  1 AS `jk`,
  1 AS `alamat`,
  1 AS `hp`,
  1 AS `desa`,
  1 AS `kepala_desa`,
  1 AS `status`,
  1 AS `tgl_input`,
  1 AS `tgl_diajukan`,
  1 AS `tgl_verifikasi`,
  1 AS `verifikator`,
  1 AS `alasan`,
  1 AS `riwayat`,
  1 AS `lembaga_nama` */;
SET character_set_client = @saved_cs_client;

--
-- Final view structure for view `usulan`
--

/*!50001 DROP VIEW IF EXISTS `usulan`*/;
/*!50001 SET @saved_cs_client          = @@character_set_client */;
/*!50001 SET @saved_cs_results         = @@character_set_results */;
/*!50001 SET @saved_col_connection     = @@collation_connection */;
/*!50001 SET character_set_client      = utf8mb4 */;
/*!50001 SET character_set_results     = utf8mb4 */;
/*!50001 SET collation_connection      = utf8mb4_general_ci */;
/*!50001 CREATE ALGORITHM=UNDEFINED */
/*!50013 DEFINER=`root`@`localhost` SQL SECURITY DEFINER */
/*!50001 VIEW `usulan` AS select `p`.`id` AS `id`,`p`.`lembaga_id` AS `lembaga_id`,`p`.`nama` AS `nama`,`p`.`nik` AS `nik`,`p`.`jk` AS `jk`,`p`.`alamat` AS `alamat`,`p`.`hp` AS `hp`,`p`.`desa` AS `desa`,`p`.`kepala_desa` AS `kepala_desa`,`p`.`status` AS `status`,`p`.`tgl_input` AS `tgl_input`,`p`.`tgl_diajukan` AS `tgl_diajukan`,`p`.`tgl_verifikasi` AS `tgl_verifikasi`,`p`.`verifikator` AS `verifikator`,`p`.`alasan` AS `alasan`,`p`.`riwayat` AS `riwayat`,coalesce(`l`.`nama_lembaga`,'') AS `lembaga_nama` from (`pekebun` `p` left join `lembaga` `l` on(`l`.`id` = `p`.`lembaga_id`)) */;
/*!50001 SET character_set_client      = @saved_cs_client */;
/*!50001 SET character_set_results     = @saved_cs_results */;
/*!50001 SET collation_connection      = @saved_col_connection */;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-08-05 20:38:59

-- ============================================================
-- SDMPKS - Data Awal (Seed)
-- Roles, permissions, role_permissions, dan akun admin bawaan.
-- Import ke database yang SUDAH dibuat:  mysql sdmpks_db < schema.sql
-- Data pekebun/lembaga/surat TIDAK disertakan (data produksi).
-- ============================================================

INSERT INTO roles (id, kode, nama) VALUES
(1, 'admin', 'Admin Aplikasi'),
(2, 'dinas', 'Dinas Perkebunan'),
(3, 'lembaga', 'Lembaga Pekebun');

INSERT INTO permissions (id, kode, nama) VALUES
(1, 'dashboard.lihat', 'Lihat Dashboard'),
(2, 'data.lihat', 'Lihat Data Pekebun'),
(3, 'data.tambah', 'Tambah Data Pekebun'),
(4, 'data.ubah', 'Ubah Data Pekebun'),
(5, 'data.hapus', 'Hapus Data Pekebun'),
(6, 'data.import', 'Impor Data Excel'),
(7, 'usulan.ajukan', 'Ajukan Usulan'),
(8, 'usulan.setujui', 'Setujui Usulan'),
(9, 'usulan.kembalikan', 'Kembalikan Usulan'),
(10, 'usulan.override', 'Override Status (Darurat)'),
(11, 'usulan.riwayat', 'Lihat Riwayat Usulan'),
(12, 'dokumen.unggah', 'Unggah Dokumen PDF'),
(13, 'dokumen.hapus', 'Hapus Dokumen PDF'),
(14, 'surat.tambah', 'Tambah Surat'),
(15, 'surat.hapus', 'Hapus Surat'),
(16, 'lembaga.kelola', 'Kelola Kelembagaan'),
(17, 'akun.kelola', 'Kelola Akun Pengguna'),
(18, 'pengaturan.ubah', 'Ubah Pengaturan Lembaga'),
(55, 'usulan.batas', 'Mengatur Batas Waktu Usulan'),
(56, 'usulan.batalkan', 'Membatalkan Usulan Disetujui');

INSERT INTO role_permissions (role_id, permission_id) VALUES
(1,1),(1,2),(1,3),(1,4),(1,5),(1,6),(1,7),(1,8),(1,9),(1,10),(1,11),(1,12),(1,13),(1,14),(1,15),(1,16),(1,17),(1,18),(1,55),(1,56),(2,1),(2,2),(2,8),(2,9),(2,11),(2,55),(2,56),(3,1),(3,2),(3,3),(3,4),(3,5),(3,6),(3,7),(3,11),(3,12),(3,13),(3,14),(3,15),(3,18);

-- Akun admin bawaan (password: admin123) - WAJIB GANTI setelah login pertama
INSERT INTO users (username, password, nama, role, aktif) VALUES
('admin', '$(2y$10$nRmSRBeEsI8MNZPy/UTH.unbJGXzFyjAd1xqm4okCJhkI9Miebjli)', 'Administrator Aplikasi', 'admin', 1);
