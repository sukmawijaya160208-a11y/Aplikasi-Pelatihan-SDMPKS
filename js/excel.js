(function () {
  function needXlsx() {
    return window.loadExcelLib().then(function () { return true; }).catch(function () {
      AppToast('Library Excel tidak termuat. Periksa koneksi internet.', 'error');
      return false;
    });
  }

  function normJk(v) {
    var s = String(v || '').toUpperCase().replace(/[-_]/g, ' ').replace(/\s+/g, ' ').trim();
    if (s === 'L' || s.indexOf('LAKI') > -1) return 'LAKI-LAKI';
    if (s === 'P' || s.indexOf('PEREMPUAN') > -1 || s.indexOf('WANITA') > -1) return 'PEREMPUAN';
    return s;
  }

  function settingsForPrint() {
    var u = AppAuth.user();
    var lid = 0;
    if (u && u.role === 'admin') {
      lid = (window.stateData && stateData.filterLembagaId) || 0;
    } else if (u) {
      lid = Number(u.lembaga_id) || 0;
    }
    if (lid > 0 && !AppSettings.isLoaded(lid)) {
      return AppSettings.load(lid).catch(function () { return null; }).then(function () {
        return AppSettings.get(lid);
      });
    }
    return Promise.resolve(AppSettings.get(lid));
  }

  window.AppExcel = {
    template: function () {
      needXlsx().then(function (ok) {
        if (!ok) return;
      var head = ['Nama Lengkap *', 'NIK *', 'Nomor Kartu Keluarga *', 'Jenis Kelamin *', 'Tempat Lahir', 'Tanggal Lahir', 'Jenis Pelatihan *', 'Jalur *', 'Provinsi *', 'Kabupaten/Kota *', 'Kecamatan *', 'Desa/Kelurahan *', 'No. SHM', 'Luas Lahan (M2)', 'Nama Kepala Desa *', 'Nama Pemilik Sebelumnya', 'Nomor Handphone', 'Agama', 'Pekerjaan', 'Jalan, RT/RW', 'NIB', 'Status Tanah', 'Dipergunakan Untuk', 'Sebelah Utara', 'Sebelah Timur', 'Sebelah Selatan', 'Sebelah Barat', 'Tahun Menguasai', 'Perolehan Dari', 'Tahun Perolehan', 'Saksi 1 - Nama', 'Saksi 1 - Umur', 'Saksi 1 - Pekerjaan', 'Saksi 1 - Alamat', 'Saksi 2 - Nama', 'Saksi 2 - Umur', 'Saksi 2 - Pekerjaan', 'Saksi 2 - Alamat'];
      var aoa = [
        head,
        ['PARJIMAN', '1605122712760002', '1605122701050002', 'LAKI-LAKI', 'Megang Sakti', '1976-12-27', 'Budidaya Kelapa Sawit', 'Pekebun', 'Sumatera Selatan', 'Kabupaten Musi Rawas', 'Megang Sakti', 'Tegal Sari', '', '', 'SISWOYO', '', '082227283416']
      ];
      var ws = XLSX.utils.aoa_to_sheet(aoa);
      ws['!cols'] = [{ wch: 20 }, { wch: 18 }, { wch: 20 }, { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 20 }, { wch: 12 }, { wch: 18 }, { wch: 22 }, { wch: 16 }, { wch: 18 }, { wch: 16 }, { wch: 14 }, { wch: 18 }, { wch: 20 }, { wch: 16 }, { wch: 10 }, { wch: 14 }, { wch: 18 }, { wch: 18 }, { wch: 14 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 14 }, { wch: 18 }, { wch: 14 }, { wch: 18 }, { wch: 10 }, { wch: 14 }, { wch: 20 }, { wch: 18 }, { wch: 10 }, { wch: 14 }, { wch: 20 }];
      var wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Data Pekebun');
      XLSX.writeFile(wb, 'Template_Data_Pekebun.xlsx');
      AppToast('Template Excel berhasil diunduh.');
      });
    },

    importFile: function (file) {
      needXlsx().then(function (ok) {
        if (!ok) return;
      if (!/\.(xlsx|xls)$/i.test(file.name)) {
        AppToast('File harus berformat .xlsx atau .xls.', 'error');
        return;
      }
      var reader = new FileReader();
      reader.onload = function (e) {
        try {
          var wb = XLSX.read(new Uint8Array(e.target.result), { type: 'array' });
          var ws = wb.Sheets[wb.SheetNames[0]];
          var rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
          var list = [];
          for (var i = 1; i < rows.length; i++) {
            var r = rows[i];
            var nama = String(r[0] || '').trim();
            var nik = String(r[1] || '').trim().replace(/\D/g, '');
            var noKk = String(r[2] || '').trim().replace(/\D/g, '');
            var jk = normJk(r[3]);
            var tempatLahir = String(r[4] || '').trim();
            var tanggalLahir = String(r[5] || '').trim();
            if (!/^\d{4}-\d{2}-\d{2}$/.test(tanggalLahir)) tanggalLahir = '';
            var jenisPelatihan = String(r[6] || '').trim();
            var jalur = String(r[7] || '').trim();
            var provinsi = String(r[8] || '').trim();
            var kabupaten = String(r[9] || '').trim();
            var kecamatan = String(r[10] || '').trim();
            var desa = String(r[11] || '').trim();
            var noShm = String(r[12] || '').trim();
            var luasLahan = String(r[13] || '').trim();
            var kepalaDesa = String(r[14] || '').trim();
            var pemilikSebelumnya = String(r[15] || '').trim();
            var hp = String(r[16] || '').trim();
            var agama = String(r[17] || '').trim();
            var pekerjaan = String(r[18] || '').trim();
            var jalanRtRw = String(r[19] || '').trim();
            var nib = String(r[20] || '').trim();
            var statusTanah = String(r[21] || '').trim();
            var dipergunakan = String(r[22] || '').trim();
            var batasUtara = String(r[23] || '').trim();
            var batasTimur = String(r[24] || '').trim();
            var batasSelatan = String(r[25] || '').trim();
            var batasBarat = String(r[26] || '').trim();
            var tahunKuasai = String(r[27] || '').trim();
            var perolehanDari = String(r[28] || '').trim();
            var perolehanSejak = String(r[29] || '').trim();
            var s1Nama = String(r[30] || '').trim();
            var s1Umur = String(r[31] || '').trim();
            var s1Pekerjaan = String(r[32] || '').trim();
            var s1Alamat = String(r[33] || '').trim();
            var s2Nama = String(r[34] || '').trim();
            var s2Umur = String(r[35] || '').trim();
            var s2Pekerjaan = String(r[36] || '').trim();
            var s2Alamat = String(r[37] || '').trim();
            if (!nama && !nik && !noKk) continue;
            if (!nama || !/^\d{16}$/.test(nik) || !/^\d{16}$/.test(noKk) ||
              (jk !== 'LAKI-LAKI' && jk !== 'PEREMPUAN') ||
              !jenisPelatihan || !jalur || !provinsi || !kabupaten || !kecamatan || !desa || !kepalaDesa) continue;
            list.push({
              nama: nama, nik: nik, no_kk: noKk, jk: jk, tempat_lahir: tempatLahir, tanggal_lahir: tanggalLahir,
              jenis_pelatihan: jenisPelatihan, jalur: jalur, provinsi: provinsi, kabupaten: kabupaten, kecamatan: kecamatan, desa: desa,
              no_shm: noShm, luas_lahan: luasLahan, kepala_desa: kepalaDesa, pemilik_sebelumnya: pemilikSebelumnya, hp: hp,
              agama: agama, pekerjaan: pekerjaan, jalan_rt_rw: jalanRtRw, nib: nib, status_tanah: statusTanah, dipergunakan: dipergunakan,
              batas_utara: batasUtara, batas_timur: batasTimur, batas_selatan: batasSelatan, batas_barat: batasBarat,
              tahun_kuasai: tahunKuasai, perolehan_dari: perolehanDari, perolehan_sejak: perolehanSejak,
              saksi1_nama: s1Nama, saksi1_umur: s1Umur, saksi1_pekerjaan: s1Pekerjaan, saksi1_alamat: s1Alamat,
              saksi2_nama: s2Nama, saksi2_umur: s2Umur, saksi2_pekerjaan: s2Pekerjaan, saksi2_alamat: s2Alamat
            });
          }
          if (!list.length) {
            AppToast('Tidak ada data valid yang ditemukan pada file.', 'warn');
            return;
          }
          var lembagaId = 0;
          var u = AppAuth.user();
          if (u && u.role === 'admin') {
            var selL = document.getElementById('fLembaga');
            lembagaId = Number(selL ? selL.value : 0) || (window.stateData ? stateData.filterLembagaId : 0) || 0;
            if (!lembagaId) {
              AppToast('Pilih kelembagaan pemilik data terlebih dahulu (form Input Data).', 'error');
              return;
            }
          }
          AppData.import(list, lembagaId).then(function (j) {
            var ok = j.ok_count || 0;
            var skip = j.skip_count || 0;
            AppToast('Berhasil mengimpor ' + ok + ' data' + (skip ? ' (' + skip + ' data dilewati)' : '') + '.');
            if (window.AppPages.data) AppPages.data();
          }).catch(function (err) {
            AppToast(err.message, 'error');
          });
        } catch (err) {
          AppToast('Gagal membaca file: ' + err.message, 'error');
        }
      };
      reader.readAsArrayBuffer(file);
      });
    },

    excelData: function () {
      needXlsx().then(function (ok) {
        if (!ok) return;
      var rows = window.filteredData();
      if (!rows.length) { AppToast('Tidak ada data untuk diekspor.', 'warn'); return; }
      var aoa = [['No', 'Nama Lengkap', 'NIK', 'Nomor Kartu Keluarga', 'Jenis Kelamin', 'Tempat Lahir', 'Tanggal Lahir', 'Jenis Pelatihan', 'Jalur', 'Provinsi', 'Kabupaten/Kota', 'Kecamatan', 'Desa/Kelurahan', 'No. SHM', 'Luas Lahan (M2)', 'Nama Kepala Desa', 'Nama Pemilik Sebelumnya', 'Nomor Handphone', 'Agama', 'Pekerjaan', 'Jalan, RT/RW', 'NIB', 'Status Tanah', 'Dipergunakan Untuk', 'Sebelah Utara', 'Sebelah Timur', 'Sebelah Selatan', 'Sebelah Barat', 'Tahun Menguasai', 'Perolehan Dari', 'Tahun Perolehan', 'Saksi 1 - Nama', 'Saksi 1 - Umur', 'Saksi 1 - Pekerjaan', 'Saksi 1 - Alamat', 'Saksi 2 - Nama', 'Saksi 2 - Umur', 'Saksi 2 - Pekerjaan', 'Saksi 2 - Alamat', 'Tanggal Input']];
      rows.forEach(function (p, i) {
        aoa.push([i + 1, p.nama, p.nik, p.no_kk || '', p.jk, p.tempat_lahir || '', p.tanggal_lahir || '', p.jenis_pelatihan || '', p.jalur || '', p.provinsi || '', p.kabupaten || '', p.kecamatan || '', p.desa || '', p.no_shm || '', p.luas_lahan || '', p.kepala_desa || '', p.pemilik_sebelumnya || '', p.hp, p.agama || '', p.pekerjaan || '', p.jalan_rt_rw || '', p.nib || '', p.status_tanah || '', p.dipergunakan || '', p.batas_utara || '', p.batas_timur || '', p.batas_selatan || '', p.batas_barat || '', p.tahun_kuasai || '', p.perolehan_dari || '', p.perolehan_sejak || '', p.saksi1_nama || '', p.saksi1_umur || '', p.saksi1_pekerjaan || '', p.saksi1_alamat || '', p.saksi2_nama || '', p.saksi2_umur || '', p.saksi2_pekerjaan || '', p.saksi2_alamat || '', window.fmtTglShort(p.tgl_input)]);
      });
      var ws = XLSX.utils.aoa_to_sheet(aoa);
      ws['!cols'] = [{ wch: 5 }, { wch: 20 }, { wch: 18 }, { wch: 20 }, { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 20 }, { wch: 12 }, { wch: 18 }, { wch: 22 }, { wch: 16 }, { wch: 18 }, { wch: 16 }, { wch: 14 }, { wch: 18 }, { wch: 20 }, { wch: 16 }, { wch: 10 }, { wch: 14 }, { wch: 18 }, { wch: 18 }, { wch: 14 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 14 }, { wch: 18 }, { wch: 14 }, { wch: 18 }, { wch: 10 }, { wch: 14 }, { wch: 20 }, { wch: 18 }, { wch: 10 }, { wch: 14 }, { wch: 20 }, { wch: 14 }];
      var wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Data Pekebun');
      XLSX.writeFile(wb, 'Data_Pekebun_' + window.yymmdd() + '.xlsx');
      AppToast('Data berhasil diunduh sebagai Excel.');
      });
    },

    cetakData: function () {
      var rows = window.filteredData();
      if (!rows.length) { AppToast('Tidak ada data untuk dicetak.', 'warn'); return; }
      settingsForPrint().then(function (s) {
        var rowsHtml = rows.map(function (p, i) {
          return '<tr>' +
            '<td>' + (i + 1) + '</td>' +
            '<td>' + esc(p.nama) + '</td>' +
            '<td>' + esc(p.nik) + '</td>' +
            '<td>' + esc(p.no_kk || '-') + '</td>' +
            '<td>' + esc(p.jk) + '</td>' +
            '<td>' + esc(p.tempat_lahir || '-') + '</td>' +
            '<td>' + (p.tanggal_lahir ? window.fmtTanggal(p.tanggal_lahir) : '-') + '</td>' +
            '<td>' + esc(p.jenis_pelatihan || '-') + '</td>' +
            '<td>' + esc(p.jalur || '-') + '</td>' +
            '<td>' + esc(p.provinsi || '-') + '</td>' +
            '<td>' + esc(p.kabupaten || '-') + '</td>' +
            '<td>' + esc(p.kecamatan || '-') + '</td>' +
            '<td>' + esc(p.desa || '-') + '</td>' +
            '<td>' + esc(p.hp) + '</td>' +
            '</tr>';
        }).join('');
        var html = '<div class="print-doc landscape">' +
          window.AppSurat.kopHTML(s) +
          '<div class="pd-title">DATA PEKEBUN</div>' +
          '<div class="pd-meta">' + (s.nama_lembaga ? esc(s.nama_lembaga) : '') + ' &bull; Total : ' + rows.length + ' data</div>' +
          '<div class="pd-table-wrap"><table class="pd-table">' +
          '<thead><tr><th>No</th><th>Nama</th><th>NIK</th><th>No. KK</th><th>Jenis Kelamin</th><th>Tempat Lahir</th><th>Tgl Lahir</th><th>Jenis Pelatihan</th><th>Jalur</th><th>Provinsi</th><th>Kabupaten</th><th>Kecamatan</th><th>Desa</th><th>No. HP</th></tr></thead>' +
          '<tbody>' + rowsHtml + '</tbody></table></div>' +
          '<div class="pd-foot">Dicetak pada : ' + window.fmtDateTime() + '</div>' +
          '</div>';
        AppPrint.printHtml(html);
      });
    },

    pdfData: function () {
      var rows = window.filteredData();
      if (!rows.length) { AppToast('Tidak ada data untuk diunduh.', 'warn'); return; }
      window.loadPdfLib().then(function () {
      var js = window.jspdf;
      settingsForPrint().then(function (s) {
        var doc = new js.jsPDF('p', 'mm', 'a4');
        doc.setFontSize(13);
        doc.text(s.nama_lembaga, 105, 14, { align: 'center' });
        doc.setFontSize(12);
        doc.text('DATA PEKEBUN', 105, 21, { align: 'center' });
        doc.setFontSize(9);
        doc.text('Total : ' + rows.length + ' data', 14, 28);
        if (typeof doc.autoTable !== 'function') {
          AppToast('Plugin tabel PDF tidak termuat.', 'error');
          return;
        }
        doc.autoTable({
          startY: 31,
          head: [['No', 'Nama', 'NIK', 'Jenis Kelamin', 'No. HP']],
          body: rows.map(function (p, i) { return [i + 1, p.nama, p.nik, p.jk, p.hp]; }),
          styles: { fontSize: 8, cellPadding: 1.6 },
          headStyles: { fillColor: [12, 95, 67], textColor: 255 },
          columnStyles: { 0: { cellWidth: 8 } }
        });
        doc.save('Data_Pekebun_' + window.yymmdd() + '.pdf');
        AppToast('Data berhasil diunduh sebagai PDF.');
      });
      }).catch(function () {
        AppToast('Library PDF tidak termuat. Periksa koneksi internet.', 'error');
      });
    }
  };
})();
