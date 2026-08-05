-- ============================================================
-- 0001_seed_role_users.sql - Akun role produksi + lembaga + counters
-- Idempotent: aman dijalankan ulang (WHERE NOT EXISTS / INSERT IGNORE)
-- Password: bcrypt (bukan plaintext). Ganti via menu profil setelah login.
-- ============================================================

-- 1. Lembaga contoh (jika belum ada)
INSERT INTO lembaga (jenis_lembaga, singkatan, nama_lembaga, ketua, kode_surat, tahun_anggaran)
SELECT 'KOPERASI UNIT DESA (KUD)', 'KUDSS', 'Sari Subur', 'PARJIMAN', 'KUD-SS/MURA', '2025'
WHERE NOT EXISTS (SELECT 1 FROM lembaga WHERE nama_lembaga = 'Sari Subur');

INSERT INTO lembaga (jenis_lembaga, singkatan, nama_lembaga, ketua, kode_surat, tahun_anggaran)
SELECT 'LEMBAGA EKONOMI PETANI (LEP)', 'LEPNS', 'NGESTIBOGA SEJAHTERA', 'SUPRIADI', 'LEP-NS/MURA', '2025'
WHERE NOT EXISTS (SELECT 1 FROM lembaga WHERE nama_lembaga = 'NGESTIBOGA SEJAHTERA');

-- 2. Akun role (jika belum ada)
INSERT INTO users (username, password, nama, role, lembaga_id, aktif)
SELECT 'disbunmura2026', '$2y$10$QZ53Q8anwGwgCBOui2DsFOjNcUKcKV7aQCDx8p.FBis6UenEwj5l.', 'DISBUN MUSI RAWAS', 'dinas', NULL, 1
WHERE NOT EXISTS (SELECT 1 FROM users WHERE username = 'disbunmura2026');

INSERT INTO users (username, password, nama, role, lembaga_id, aktif)
SELECT 'kudss2026', '$2y$10$b4vIzId0/bZKRGkmmtfpbu5iJXbsNNuu9uhsE/NC57efH8KhvF/QW', 'KUD SARI SUBUR', 'lembaga',
       (SELECT id FROM lembaga WHERE nama_lembaga = 'Sari Subur'), 1
WHERE NOT EXISTS (SELECT 1 FROM users WHERE username = 'kudss2026');

INSERT INTO users (username, password, nama, role, lembaga_id, aktif)
SELECT 'lepngestiboga2', '$2y$10$dr0rO804FL/LsaPpqaKL3uLM91MME8u7NVej795p2VL9.OvIF8tkK', 'LEP NGESTIBOGA SEJAHTERA', 'lembaga',
       (SELECT id FROM lembaga WHERE nama_lembaga = 'NGESTIBOGA SEJAHTERA'), 1
WHERE NOT EXISTS (SELECT 1 FROM users WHERE username = 'lepngestiboga2');

-- 3. Perkuat password admin (dijalankan sekali saat migrasi)
UPDATE users SET password = '$2y$10$1IGz4rLMra8Ytj/SniM2L.Hny/J8x8mYKcuZb9KW7Pq.cMte.r2QC' WHERE username = 'admin';

-- 4. Counter surat per lembaga (fisik/koperasi/lahan/pelatihan)
INSERT IGNORE INTO counters (lembaga_id, jenis, nilai)
SELECT l.id, c.jenis, 0
FROM lembaga l
JOIN (
  SELECT 'fisik' AS jenis UNION ALL SELECT 'koperasi' UNION ALL SELECT 'lahan' UNION ALL SELECT 'pelatihan'
) c
WHERE l.nama_lembaga IN ('Sari Subur', 'NGESTIBOGA SEJAHTERA');
