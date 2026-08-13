(function () {
  var JENIS = {
    koperasi: { label: 'Surat Keterangan Keanggotaan Koperasi', kode: 'SK-KOP' },
    pelatihan: { label: 'Surat Pernyataan Bersedia Mengikuti Kegiatan Pelatihan', kode: 'SP-PLT' },
    lahan: { label: 'Surat Pernyataan Kepemilikan Lahan', kode: 'SP-LAHAN' },
    beda_nama: { label: 'Surat Keterangan Beda Nama', kode: 'SK-BN' },
    fisik: { label: 'Surat Pernyataan Penguasaan Fisik Bidang Tanah', kode: 'SK-PFT' }
  };
  var KOLEKTIF = ['koperasi', 'beda_nama'];
  var isKolektif = function (j) { return KOLEKTIF.indexOf(j) > -1; };
  var isDesaJenis = function (j) { return j === 'beda_nama' || j === 'fisik'; };

  function pad(n) { return ('000' + n).slice(-3); }
  function todayISO() {
    var d = new Date();
    return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
  }
  function sanitizeName(s) {
    return String(s || '').replace(/[^\w\-]+/g, '_').slice(0, 40);
  }
  function usiaTahun(tgl) {
    if (!tgl) return null;
    var d = new Date(tgl);
    if (isNaN(d.getTime())) return null;
    var now = new Date();
    var u = now.getFullYear() - d.getFullYear();
    var m = now.getMonth() - d.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < d.getDate())) u--;
    return u >= 0 ? u : null;
  }

  function suratLembagaId() {
    var u = AppAuth.user();
    if (u && u.role === 'admin') {
      var sel = document.getElementById('selLembagaSurat');
      return sel && sel.value ? Number(sel.value) : 0;
    }
    return u ? (Number(u.lembaga_id) || 0) : 0;
  }

  function ensureSettings(lid) {
    if (lid <= 0) return Promise.reject(new Error('Pilih kelembagaan terlebih dahulu.'));
    return AppSettings.load(lid).catch(function () { return null; });
  }

  window.AppSurat = {
    JENIS: JENIS,

    kopHTML: function (s) {
      var logo = s.logo ? '<img class="kop-logo" src="' + s.logo + '" alt="Logo">' : '';
      return '<div class="kop">' +
        '<div class="kop-row">' + logo +
        '<div class="kop-txt">' +
        '<div class="kop-jenis">' + esc(s.jenis_lembaga || 'KOPERASI UNIT DESA (KUD)') + '</div>' +
        '<div class="kop-nama">' + esc(s.nama_lembaga) + '</div>' +
        '<div class="kop-sekretariat">Sekretariat :</div>' +
        '<div class="kop-alamat">' + esc(s.alamat) + '</div>' +
        '</div></div>' +
        '<div class="kop-rule thin"></div>' +
        '<div class="kop-rule thick"></div>' +
        '</div>';
    },

    kopDesaHTML: function (s) {
      var logo = s.logo_desa ? '<img class="kop-logo" src="' + s.logo_desa + '" alt="Logo Desa">' : '';
      var parts = AppSurat.alamatParts(s.desa_alamat || s.alamat);
      var kecRaw = String(parts.kecName || '').replace(/^Kecamatan\s+/i, '').trim().toUpperCase();
      var kabRaw = String(parts.kabName || '').replace(/^Kabupaten\s+/i, '').trim().toUpperCase();
      var desaRaw = String(s.nama_desa || '').replace(/^Desa\s+/i, '').trim().toUpperCase();
      return '<div class="kop">' +
        '<div class="kop-row">' + logo +
        '<div class="kop-txt">' +
        '<div class="kop-jenis">' + (kabRaw ? 'PEMERINTAH KABUPATEN ' + esc(kabRaw) : 'PEMERINTAH KABUPATEN .......') + '</div>' +
        '<div class="kop-kec">' + (kecRaw ? 'KECAMATAN ' + esc(kecRaw) : 'KECAMATAN .......') + '</div>' +
        '<div class="kop-nama">' + (desaRaw ? 'DESA ' + esc(desaRaw) : esc(s.nama_desa || '')) + '</div>' +
        '<div class="kop-sekretariat">Sekretariat :</div>' +
        '<div class="kop-alamat">' + esc(s.desa_alamat || s.alamat) + '</div>' +
        '</div></div>' +
        '<div class="kop-rule thin"></div>' +
        '<div class="kop-rule thick"></div>' +
        '</div>';
    },

    alamatParts: function (a) {
      var s = a || '';
      var desaKec = s, kabProv = '', kabRaw = '', kecKab = '';
      var desaName = '', kecName = '', kabName = '';
      var low = s.toLowerCase();
      var iKec = low.indexOf('kecamatan');
      var iKab = low.indexOf('kabupaten');
      var mProv = low.search(/(provinsi|prov|prop)(\.|\s|$)/);
      var iProv = mProv > -1 ? mProv : -1;
      if (iKec > -1) {
        var end = (iKab > -1 ? iKab : (iProv > -1 ? iProv : s.length));
        desaKec = s.slice(0, end).trim();
      }
      if (iKab > -1) {
        kabProv = s.slice(iKab).trim();
        if (iProv > -1) {
          kabRaw = 'Kabupaten ' + s.slice(iKab + 9, iProv).trim();
        } else {
          kabRaw = kabProv;
        }
      }
      if (iKec > -1 && iKab > -1) {
        var kEnd = iProv > -1 ? iProv : s.length;
        kecKab = 'KECAMATAN ' + s.slice(iKec + 9, kEnd).trim().toUpperCase();
      }
      var clean = function (x) { return x.replace(/^[\s,.\-]+|[\s,.\-]+$/g, ''); };
      if (iKec > -1) {
        var iDesa = low.indexOf('desa');
        if (iDesa > -1) {
          desaName = clean(s.slice(iDesa + 4, iKec));
          if (desaName) desaName = 'Desa ' + desaName;
        }
        var kEnd2 = iKab > -1 ? iKab : (iProv > -1 ? iProv : s.length);
        kecName = clean(s.slice(iKec + 9, kEnd2));
        if (kecName) kecName = 'Kecamatan ' + kecName;
      }
      if (iKab > -1) {
        kabName = clean(s.slice(iKab + 9, iProv > -1 ? iProv : s.length));
        if (kabName) kabName = 'Kabupaten ' + kabName;
      }
      return { desaKec: desaKec, kabProv: kabProv, kabRaw: kabRaw, kecKab: kecKab, desaName: desaName, kecName: kecName, kabName: kabName };
    },

    lokasiPekebun: function (p, parts) {
      var seg = [];
      var mk = function (v, label) {
        v = String(v || '').trim();
        if (!v) return;
        v = v.replace(/^(desa|kelurahan|kecamatan|kabupaten|kota)\s+/i, '');
        seg.push(label + ' ' + v);
      };
      mk(p.desa, 'Desa');
      mk(p.kecamatan, 'Kecamatan');
      mk(p.kabupaten, 'Kabupaten');
      if (!seg.length && parts) {
        ['desaName', 'kecName', 'kabName'].forEach(function (k) {
          if (parts[k]) seg.push(parts[k]);
        });
      }
      return seg.length ? 'di ' + seg.join(' ') : '';
    },

    lokasiLahan: function (p, parts) {
      var lahan = {
        desa: p.lahan_desa,
        kecamatan: p.lahan_kecamatan,
        kabupaten: p.lahan_kabupaten
      };
      var lok = AppSurat.lokasiPekebun(lahan, null);
      if (lok) return lok;
      return AppSurat.lokasiPekebun(p, parts);
    },

    formatLuas: function (v) {
      var n = parseFloat(String(v == null ? '' : v).replace(/,/g, '.'));
      if (!isFinite(n) || n <= 0) return '........';
      return n.toLocaleString('id-ID', { maximumFractionDigits: 2 });
    },

    buildSheet: function (jenis, p, s, tanggal, no, tanaman, ids) {
      var kop = jenis === 'koperasi' ? AppSurat.kopHTML(s)
        : jenis === 'beda_nama' ? AppSurat.kopDesaHTML(s) : '';
      var tgl = fmtTanggal(tanggal);
      var parts = AppSurat.alamatParts(s.alamat);
      var namaAtas = p ? (p.nama || '').toUpperCase() : '';
      var body = '';

      if (jenis === 'koperasi') {
        var lid = suratLembagaId();
        var anggota = (AppData.get() || []).filter(function (r) {
          return Number(r.lembaga_id) === Number(lid);
        }).sort(function (x, y) {
          return String(x.nik).localeCompare(String(y.nik));
        });
        var tbRows = anggota.length
          ? anggota.map(function (r, i) {
              return '<tr><td class="l-no">' + (i + 1) + '</td><td>' + esc(r.nama) + '</td><td>' + esc(r.nik) + '</td></tr>';
            }).join('')
          : '<tr><td class="l-no">-</td><td colspan="2">Tidak ada data pekebun.</td></tr>';
        var lokasi = [parts.desaName, parts.kecName, parts.kabName].filter(function (x) { return x; });
        var lokasiTxt = lokasi.length ? ' di ' + lokasi.join(' ') : '';
        body =
          '<div class="l-title">SURAT KETERANGAN</div>' +
          '<div class="l-nomor">' + esc(no) + '</div>' +
          '<p class="no-indent gap3">Yang bertanda tangan di bawah ini :</p>' +
          '<table class="l-table">' +
          '<tr><td class="l-w">Nama</td><td class="l-c">:</td><td>' + esc(s.ketua) + '</td></tr>' +
          '<tr><td class="l-w">Jabatan</td><td class="l-c">:</td><td>' + esc(s.jabatan) + '</td></tr>' +
          '<tr><td class="l-w">Alamat</td><td class="l-c">:</td><td>' + esc(s.alamat) + '</td></tr>' +
          '<tr><td class="l-w">Nomor Handphone</td><td class="l-c">:</td><td>' + esc(s.ketua_hp || '') + '</td></tr>' +
          '</table>' +
          '<p class="no-indent">dengan ini menyatakan dengan sebenarnya bahwa nama-nama di bawah ini :</p>' +
          '<table class="l-table l-table-list">' +
          '<thead><tr><th class="l-no">No.</th><th>Nama</th><th>NIK</th></tr></thead>' +
          '<tbody>' + tbRows + '</tbody>' +
          '</table>' +
          '<p class="no-indent">adalah benar sebagai Pekebun kelapa sawit dan menjadi anggota ' + esc(s.singkatan || s.nama_lembaga) + lokasiTxt + '.</p>' +
          '<p class="no-indent">Demikian surat pernyataan ini dibuat dengan sebenar–benarnya untuk dapat digunakan sebagaimana semestinya. Apabila di kemudian hari ditemukan bahwa pernyataan ini tidak benar, saya bersedia menerima konsekuensi sesuai dengan peraturan yang berlaku.</p>' +
          '<div class="l-sign">' +
          '<div>' + esc(s.tempat) + ', ' + tgl + '</div>' +
          '<div>Ketua ' + esc(s.singkatan || s.nama_lembaga) + ',</div>' +
          '<div class="l-space"></div>' +
          '<div class="l-name">' + esc(s.ketua) + '</div>' +
          '</div>';

      } else if (jenis === 'pelatihan') {
        var alamatLengkap = (p.alamat || '').toLowerCase().indexOf('kabupaten') > -1;
        var alamat2 = (!alamatLengkap && parts.kabProv) ? '<br><span class="l-sub">' + esc(parts.kabProv) + '</span>' : '';
        body =
          '<div class="l-title">SURAT PERNYATAAN</div>' +
          '<p class="no-indent gap3">Yang bertanda tangan di bawah ini :</p>' +
          '<table class="l-table">' +
          '<tr><td class="l-w">Nama</td><td class="l-c">:</td><td>' + esc(p.nama) + '</td></tr>' +
          '<tr><td class="l-w">Tempat, Tanggal Lahir</td><td class="l-c">:</td><td>' + esc(p.tempat_lahir) + (p.tanggal_lahir ? ', ' + fmtTanggal(p.tanggal_lahir) : '') + '</td></tr>' +
          '<tr><td class="l-w">NIK</td><td class="l-c">:</td><td>' + esc(p.nik) + '</td></tr>' +
          '<tr><td class="l-w">Jenis Kelamin</td><td class="l-c">:</td><td>' + esc(p.jk) + '</td></tr>' +
          '<tr><td class="l-w">Alamat</td><td class="l-c">:</td><td>' + esc(p.alamat) + alamat2 + '</td></tr>' +
          '<tr><td class="l-w">Nomor Handphone</td><td class="l-c">:</td><td>' + esc(p.hp) + '</td></tr>' +
          '</table>' +
          '<p>dengan ini menyatakan bahwa Saya bersedia untuk mengikuti pelatihan pengembangan sumber daya manusia perkebunan (SDMP) yang di danai oleh Badan Pengelola Dana Perkebunan (BPDP) dengan mematuhi segala peraturan yang berlaku.</p>' +
          '<p>Demikian surat pernyataan ini dibuat dengan sebenar – benarnya untuk dapat digunakan sebagaimana semestinya. Apabila dikemudian hari ditemukan bahwa pernyataan ini tidak benar, saya bersedia menerima konsekuensi sesuai dengan peraturan yang berlaku.</p>' +
          '<div class="l-sign">' +
          '<div>' + esc(s.tempat) + ', ' + tgl + '</div>' +
          '<div>Yang Membuat Pernyataan,</div>' +
          '<div class="l-space"></div>' +
          '<div class="l-name">' + esc(namaAtas) + '</div>' +
          '</div>';

      } else if (jenis === 'lahan') {
        var alamatLengkap = (p.alamat || '').toLowerCase().indexOf('kabupaten') > -1;
        var alamat3 = (!alamatLengkap && parts.kecKab) ? '<br><span class="l-sub">' + esc(parts.kecKab) + '</span>' : '';
        var lokTxt = AppSurat.lokasiLahan(p, parts);
        var luas = AppSurat.formatLuas(p.luas_lahan);
        body =
          '<div class="l-title">SURAT PERNYATAAN</div>' +
          '<p class="no-indent gap3">Yang bertanda tangan di bawah ini :</p>' +
          '<table class="l-table">' +
          '<tr><td class="l-w">Nama</td><td class="l-c">:</td><td>' + esc(p.nama) + '</td></tr>' +
          '<tr><td class="l-w">NIK</td><td class="l-c">:</td><td>' + esc(p.nik) + '</td></tr>' +
          '<tr><td class="l-w">Jenis Kelamin</td><td class="l-c">:</td><td>' + esc(p.jk) + '</td></tr>' +
          '<tr><td class="l-w">Alamat</td><td class="l-c">:</td><td>' + esc(p.alamat) + alamat3 + '</td></tr>' +
          '<tr><td class="l-w">Nomor Handphone</td><td class="l-c">:</td><td>' + esc(p.hp) + '</td></tr>' +
          '</table>' +
          '<p>dengan ini menyatakan bahwa Saya benar sebagai Pekebun kelapa sawit dan memiliki lahan perkebunan kelapa sawit ' + lokTxt + ' seluas ' + luas + ' M2 (meter persegi)</p>' +
          '<p>Demikian surat pernyataan ini dibuat dengan sebenar–benarnya dan dapat digunakan sebagaimana semestinya. Apabila di kemudian hari ditemukan bahwa pernyataan ini tidak benar, saya bersedia menerima konsekuensi sesuai dengan peraturan yang berlaku.</p>' +
          '<div class="l-sign">' +
          '<div>' + esc(s.tempat) + ', ' + tgl + '</div>' +
          '<div>Saya yang membuat Pernyataan,</div>' +
          '<div class="l-space"></div>' +
          '<div class="l-name">' + esc(namaAtas) + '</div>' +
          '</div>';
      } else if (jenis === 'fisik') {
        var dotsF = '........';
        var rowF = function (label, val) {
          val = String(val == null ? '' : val).trim();
          return '<tr><td class="l-w">' + label + '</td><td class="l-c">:</td><td>' + (val ? esc(val) : dotsF) + '</td></tr>';
        };
        var fParts = AppSurat.alamatParts(p.alamat || '');
        var luasF = AppSurat.formatLuas(p.luas_lahan);
        var valF = function (v) { v = String(v == null ? '' : v).trim(); return v ? esc(v) : dotsF; };
        var saksiDuo =
          '<table class="l-table l-saksi-num">' +
          '<tr><td class="l-no2">1.</td><td class="l-w">Nama</td><td class="l-c">:</td><td>' + valF(p.saksi1_nama) + '</td></tr>' +
          '<tr><td class="l-no2"></td><td class="l-w">Umur</td><td class="l-c">:</td><td>' + valF(p.saksi1_umur) + ' Tahun</td></tr>' +
          '<tr><td class="l-no2"></td><td class="l-w">Pekerjaan</td><td class="l-c">:</td><td>' + valF(p.saksi1_pekerjaan) + '</td></tr>' +
          '<tr><td class="l-no2"></td><td class="l-w">Alamat</td><td class="l-c">:</td><td>' + valF(p.saksi1_alamat) + '</td></tr>' +
          '<tr class="l-num-top"><td class="l-no2">2.</td><td class="l-w">Nama</td><td class="l-c">:</td><td>' + valF(p.saksi2_nama) + '</td></tr>' +
          '<tr><td class="l-no2"></td><td class="l-w">Umur</td><td class="l-c">:</td><td>' + valF(p.saksi2_umur) + ' Tahun</td></tr>' +
          '<tr><td class="l-no2"></td><td class="l-w">Pekerjaan</td><td class="l-c">:</td><td>' + valF(p.saksi2_pekerjaan) + '</td></tr>' +
          '<tr><td class="l-no2"></td><td class="l-w">Alamat</td><td class="l-c">:</td><td>' + valF(p.saksi2_alamat) + '</td></tr>' +
          '</table>';
        body =
          '<div class="l-title">SURAT PERNYATAAN PENGUASAAN FISIK BIDANG TANAH</div>' +
          '<p class="no-indent gap3">Yang bertanda tangan di bawah ini :</p>' +
          '<table class="l-table">' +
          rowF('Nama', p.nama) +
          rowF('NIK', p.nik) +
          rowF('Agama', p.agama) +
          rowF('Tempat, Tgl. Lahir', (p.tempat_lahir || '') + (p.tanggal_lahir ? ', ' + fmtTanggal(p.tanggal_lahir) : '')) +
          rowF('Pekerjaan', p.pekerjaan) +
          rowF('Alamat', p.alamat) +
          '</table>' +
          '<p class="no-indent">dengan ini menyatakan bahwa Saya benar-benar menguasai secara fisik bidang tanah yang terletak di :</p>' +
          '<table class="l-table">' +
          rowF('Jalan/RT/RW', p.jalan_rt_rw) +
          rowF('Desa', p.lahan_desa || p.desa || fParts.desaName) +
          rowF('Kecamatan', p.lahan_kecamatan || p.kecamatan || fParts.kecName) +
          rowF('Kabupaten', p.lahan_kabupaten || p.kabupaten || fParts.kabName) +
          rowF('NIB', p.nib) +
          rowF('Status Tanah', p.status_tanah) +
          rowF('Dipergunakan Untuk', p.dipergunakan) +
          '</table>' +
          '<p class="no-indent">dengan batas-batas sebagai berikut :</p>' +
          '<table class="l-table l-batas-duo">' +
          '<tr><td class="l-w">Utara</td><td class="l-c">:</td><td>' + valF(p.batas_utara) + '</td>' +
          '<td class="l-w">Timur</td><td class="l-c">:</td><td>' + valF(p.batas_timur) + '</td></tr>' +
          '<tr><td class="l-w">Selatan</td><td class="l-c">:</td><td>' + valF(p.batas_selatan) + '</td>' +
          '<td class="l-w">Barat</td><td class="l-c">:</td><td>' + valF(p.batas_barat) + '</td></tr>' +
          '</table>' +
          '<p class="no-indent">dengan ketentuan sebagai berikut :</p>' +
          '<ol class="l-points">' +
          '<li>Bahwa tanah/lahan tersebut benar milik saya sendiri dan dikuasai secara fisik seluas ' + luasF + ' M2;</li>' +
          '<li>Bahwa tanah/lahan tersebut telah saya kuasai sejak tahun ' + (String(p.tahun_kuasai || '').trim() || dotsF) + ';</li>' +
          '<li>Bahwa tanah/lahan tersebut diperoleh dari ' + (String(p.perolehan_dari || '').trim() || dotsF) + ' sejak tahun ' + (String(p.perolehan_sejak || '').trim() || dotsF) + ';</li>' +
          '<li>Bahwa tanah/lahan tersebut tidak sedang dalam sengketa dengan pihak manapun;</li>' +
          '<li>Bahwa tanah/lahan tersebut tidak sedang dijadikan jaminan/gadai kepada pihak manapun;</li>' +
          '<li>Bahwa tanah/lahan tersebut tidak termasuk dalam kawasan hutan negara;</li>' +
          '<li>Bahwa tanah/lahan tersebut belum pernah dipindahtangankan kepada pihak lain;</li>' +
          '<li>Pernyataan ini saya buat dengan sebenar-benarnya dan penuh rasa tanggung jawab;</li>' +
          '<li>Apabila di kemudian hari ternyata pernyataan ini tidak benar, saya bersedia menerima segala konsekuensi sesuai dengan peraturan perundang-undangan yang berlaku.</li>' +
          '</ol>' +
          '<p class="no-indent">Surat Pernyataan ini saya buat dengan sebenar-benarnya dengan penuh tanggung jawab baik secara perdata maupun pidana, apabila di kemudian hari terdapat unsur-unsur yang tidak benar dalam pernyataan ini maka segala akibat yang timbul menjadi tanggung jawab saya dan bersedia dituntut sesuai dengan ketentuan peraturan perundang-undangan serta tidak akan melibatkan pihak lain dan saya bersedia sertipikat yang telah saya terima dibatalkan oleh pejabat yang berwenang.</p>' +
          '<p class="no-indent">Demikian surat pernyataan ini dibuat dengan disaksikan oleh :</p>' +
          saksiDuo +
          '<div class="l-sign-2">' +
          '<div class="l-sign-left">' +
          '<div class="l-sign-cap">Saksi-saksi</div>' +
          '<table class="l-table l-saksi-sign">' +
          '<tr><td class="l-no2"></td><td class="l-w">Saksi I</td><td class="l-c">:</td><td class="l-sn"><span class="l-name">' + valF(p.saksi1_nama) + '</span></td><td class="l-ws-sig">(...........)</td></tr>' +
          '<tr><td class="l-no2"></td><td class="l-w">Saksi II</td><td class="l-c">:</td><td class="l-sn"><span class="l-name">' + valF(p.saksi2_nama) + '</span></td><td class="l-ws-sig">(...........)</td></tr>' +
          '</table>' +
          '</div>' +
          '<div class="l-sign-right">' +
          '<div>' + esc(s.nama_desa || s.tempat) + ', ' + tgl + '</div>' +
          '<div>Yang membuat pernyataan</div>' +
          '<div class="l-space"></div>' +
          '<div class="l-name">' + esc(p.nama) + '</div>' +
          '</div>' +
          '</div>';
      } else if (jenis === 'beda_nama') {
        var lid2 = suratLembagaId();
        var daftar = (AppData.get() || []).filter(function (r) {
          return Number(r.lembaga_id) === Number(lid2);
        }).filter(function (r) {
          return !ids || ids.indexOf(String(r.id)) > -1;
        }).sort(function (x, y) {
          return String(x.nik).localeCompare(String(y.nik));
        });
        var dRows = daftar.length
          ? daftar.map(function (r, i) {
              return '<tr>' +
                '<td class="l-no">' + (i + 1) + '</td>' +
                '<td>' + esc(r.nama) + '</td>' +
                '<td>' + esc(r.no_shm || '........') + '</td>' +
                '<td>' + AppSurat.formatLuas(r.luas_lahan) + '</td>' +
                '<td>' + esc(r.pemilik_sebelumnya || '........') + '</td>' +
                '<td>' + esc(r.nama) + '</td>' +
                '<td>' + esc(r.nik) + '</td>' +
                '<td>' + esc(r.desa || '........') + '</td>' +
                '<td>' + esc(r.hp) + '</td>' +
                '</tr>';
            }).join('')
          : '<tr><td class="l-no">-</td><td colspan="8">Tidak ada data pekebun.</td></tr>';
        var dParts = AppSurat.alamatParts(s.desa_alamat || s.alamat);
        var dLok = [dParts.desaName, dParts.kecName, dParts.kabName].filter(function (x) { return x; });
        if (!dLok.length && s.nama_desa) dLok.push('Desa ' + esc(s.nama_desa));
        var dLokTxt = dLok.length ? dLok.join(' ') : 'Desa …………., Kecamatan ……...., Kabupaten …….';
        var tanamanTxt = (tanaman || 'kelapa sawit').toLowerCase();
        var pernyataanTxt = 'adalah benar memiliki/menguasai tanah/lahan kebun ' + esc(tanamanTxt) + ' di ' + dLokTxt + ' dengan sertipikat hak milik (SHM) sebagai tersebut diatas dan belum dilakukan perubahan nama kepemilikan tanah/lahan.';
        body =
          '<div class="l-title">SURAT KETERANGAN</div>' +
          '<div class="l-nomor">' + esc(no) + '</div>' +
          '<p class="no-indent gap3">Yang bertanda tangan di bawah ini:</p>' +
          '<table class="l-table">' +
          '<tr><td class="l-w">Nama</td><td class="l-c">:</td><td>' + esc(s.kepala_desa) + '</td></tr>' +
          '<tr><td class="l-w">Jabatan</td><td class="l-c">:</td><td>Kepala Desa ' + esc(s.nama_desa) + '</td></tr>' +
          '<tr><td class="l-w">Alamat</td><td class="l-c">:</td><td>' + esc(s.desa_alamat || s.alamat) + '</td></tr>' +
          '<tr><td class="l-w">No HP</td><td class="l-c">:</td><td>' + esc(s.kepala_desa_hp || '') + '</td></tr>' +
          '</table>' +
          '<p class="no-indent">dengan ini menyatakan, bahwa nama-nama dibawah ini :</p>' +
          '<table class="l-table l-table-list l-tanah">' +
          '<colgroup>' +
          '<col style="width:4.5%"/><col style="width:16.5%"/><col style="width:12%"/><col style="width:8%"/><col style="width:12%"/>' +
          '<col style="width:13%"/><col style="width:14%"/><col style="width:9%"/><col style="width:11%"/>' +
          '</colgroup>' +
          '<thead>' +
          '<tr>' +
          '<th class="l-no" rowspan="2">No.</th>' +
          '<th rowspan="2">Nama<br>Pemilik/<br>Penguasaan Tanah</th>' +
          '<th rowspan="2">No. SHM</th>' +
          '<th rowspan="2">Luas<br>Lahan<br>(m2)</th>' +
          '<th rowspan="2">Pemilik<br>Sebelumnya</th>' +
          '<th colspan="4">Pemilik Sekarang</th>' +
          '</tr>' +
          '<tr><th>Nama</th><th>NIK</th><th>Alamat</th><th>No. HP</th></tr>' +
          '</thead>' +
          '<tbody>' + dRows + '</tbody>' +
          '</table>' +
          '<p class="no-indent">' + pernyataanTxt + '</p>' +
          '<p class="no-indent">Demikian surat pernyataan ini dibuat dengan sebenar-benarnya untuk dapat digunakan sebagaimana semestinya. Apabila di kemudian hari ditemukan bahwa pernyataan ini tidak benar, saya bersedia menerima konsekuensi sesuai dengan peraturan yang berlaku.</p>' +
          '<div class="l-sign right">' +
          '<div>' + esc(s.nama_desa || s.tempat) + ', ' + tgl + '</div>' +
          '<div>Kepala Desa ' + esc(s.nama_desa) + '</div>' +
          '<div class="l-space"></div>' +
          '<div class="l-name">' + esc(s.kepala_desa) + '</div>' +
          '</div>';
      }

      return '<div class="sheet' + (jenis === 'fisik' ? ' fisik-kerat' : '') + '">' + kop + '<div class="l-body">' + body + '</div></div>';
    }
  };

  var currentSheet = null;
  var currentNo = '';
  var renderSeq = 0;

  var EMPTY = '<div class="empty-state">Pilih pekebun dan jenis surat, lalu klik &quot;Buat Surat&quot;.</div>';

  function renderPreview() {
    var seq = ++renderSeq;
    var selP = document.getElementById('selPekebun');
    var selJ = document.getElementById('selJenis');
    var inpT = document.getElementById('inpTanggal');
    var inpN = document.getElementById('inpNoSurat');
    var preview = document.getElementById('suratPreview');

    var kolektif = isKolektif(selJ.value);
    var isDesa = isDesaJenis(selJ.value);
    var multi = selJ.value === 'beda_nama' ? multiChecked() : null;
    if (!kolektif && !selP.value) {
      preview.innerHTML = EMPTY;
      currentSheet = null;
      currentNo = '';
      inpN.value = '';
      return;
    }
    if (selJ.value === 'beda_nama' && !multi.length) {
      preview.innerHTML = '<div class="empty-state">Centang pekebun pada daftar di samping, lalu klik &quot;Buat Surat&quot;.</div>';
      currentSheet = null;
      currentNo = '';
      inpN.value = '';
      return;
    }
    if (!inpT.value) inpT.value = todayISO();

    var p = null;
    if (!kolektif) {
      p = AppData.getById(selP.value);
      if (!p) {
        preview.innerHTML = EMPTY;
        currentSheet = null;
        return;
      }
    }
    var lid = suratLembagaId();
    var s = AppSettings.get(lid);
    var finish = function () {
      preview.innerHTML = AppSurat.buildSheet(selJ.value, p, s, inpT.value, currentNo,
        document.getElementById('selTanaman') ? document.getElementById('selTanaman').value : '',
        multi);
      currentSheet = preview.querySelector('.sheet');
      fitDesaTable();
    };
    if (isKolektif(selJ.value)) {
      Api.get('surat.php', 'next_no', { jenis: selJ.value, lembaga_id: lid > 0 ? lid : 0 }).then(function (j) {
        if (seq !== renderSeq) return;
        currentNo = j.no_surat || '';
        inpN.value = currentNo;
        finish();
      }).catch(function (e) {
        if (seq !== renderSeq) return;
        currentNo = '';
        inpN.value = '';
        finish();
        AppToast(e.message, 'error');
      });
    } else {
      currentNo = '';
      inpN.value = '';
      finish();
    }
  }

  function setKoperasiMode() {
    var selP = document.getElementById('selPekebun');
    var selJ = document.getElementById('selJenis');
    if (!selP || !selJ) return;
    var kolektif = isKolektif(selJ.value);
    var isBedaNama = selJ.value === 'beda_nama';
    selP.disabled = kolektif;
    var lbl = document.querySelector('label[for="selPekebun"]');
    if (lbl) lbl.textContent = kolektif ? 'Seluruh Pekebun (kolektif)' : 'Pilih Pekebun';
    var w = document.getElementById('selPekebunWrap');
    if (w) w.hidden = isBedaNama;
    var mw = document.getElementById('pekebunMultiWrap');
    if (mw) mw.hidden = !isBedaNama;
    var tw = document.getElementById('tanamanWrap');
    if (tw) tw.hidden = !isBedaNama;
  }

  var multiSel = {};

  function renderMultiPekebun() {
    var list = document.getElementById('pekebunMultiList');
    if (!list) return;
    var lid = suratLembagaId();
    var rows = (AppData.get() || []).filter(function (r) {
      return Number(r.lembaga_id) === Number(lid);
    }).sort(function (x, y) {
      return String(x.nik).localeCompare(String(y.nik));
    });
    list.innerHTML = rows.length
      ? rows.map(function (r) {
          var ck = multiSel[String(r.id)] ? ' checked' : '';
          return '<label class="multi-item"><input type="checkbox" value="' + r.id + '"' + ck + '><span>' + esc(r.nama) + '</span><small>' + esc(r.nik) + '</small></label>';
        }).join('')
      : '<div class="multi-empty">Tidak ada pekebun untuk kelembagaan ini.</div>';
  }

  function multiChecked() {
    return [].slice.call(document.querySelectorAll('#pekebunMultiList input[type=checkbox]:checked')).map(function (x) { return x.value; });
  }

  function fitDesaTable() {
    var tbl = currentSheet ? currentSheet.querySelector('.l-tanah') : null;
    if (!tbl) return;
    var MIN = 5;
    [].forEach.call(tbl.querySelectorAll('th, td'), function (c) {
      c.style.whiteSpace = 'nowrap';
      c.style.fontSize = '';
    });
    [].forEach.call(tbl.querySelectorAll('th, td'), function (c) {
      var base = parseFloat(getComputedStyle(c).fontSize) / 1.3333333 || 10;
      var i = 0;
      while (c.scrollWidth > c.clientWidth && i < 25) {
        var cur = parseFloat(c.style.fontSize) || base;
        if (cur <= MIN) break;
        c.style.fontSize = Math.max(MIN, cur - 0.5) + 'pt';
        i++;
      }
      if (c.scrollWidth > c.clientWidth) {
        c.style.whiteSpace = 'normal';
        c.style.fontSize = '';
      }
    });
  }

  window.AppPages = window.AppPages || {};
  window.AppPages.surat = function () {
    var preview = document.getElementById('suratPreview');
    preview.innerHTML = '<div class="empty-state">Memuat data...</div>';

    var isAdmin = AppAuth.isAdmin();
    document.getElementById('suratLembagaWrap').hidden = !isAdmin;

    var lid = suratLembagaId();
    var selP = document.getElementById('selPekebun');

    var fillPekebun = function () {
      var cur = selP.value;
      var list = AppData.get().filter(function (p) {
        return Number(p.lembaga_id) === Number(lid);
      });
      var curOk = list.some(function (p) { return String(p.id) === String(cur); });
      selP.innerHTML = '<option value="">-- Pilih Pekebun --</option>' +
        list.map(function (p) {
          return '<option value="' + p.id + '">' + esc(p.nama) + ' &mdash; ' + esc(p.nik) + '</option>';
        }).join('');
      if (curOk) selP.value = cur;
      renderMultiPekebun();
      setKoperasiMode();
    };

    var loadSettings = function () {
      if (lid <= 0) {
        if (isAdmin) {
          preview.innerHTML = '<div class="empty-state">Pilih kelembagaan terlebih dahulu.</div>';
        }
        return;
      }
      ensureSettings(lid).then(function () {
        fillPekebun();
        if (!document.getElementById('inpTanggal').value) {
          document.getElementById('inpTanggal').value = todayISO();
        }
        renderPreview();
      });
    };

    if (isAdmin) {
      AppData.load().then(function () {
        return loadLembaga();
      }).then(function () {
        var sel = document.getElementById('selLembagaSurat');
        var target = (AppGo.opts && AppGo.opts.lembaga_id) ? Number(AppGo.opts.lembaga_id) : lid;
        var opts = '<option value="">-- Pilih Kelembagaan --</option>';
        (AppCache.lembaga || []).forEach(function (l) {
          opts += '<option value="' + l.id + '"' + (String(l.id) === String(target) ? ' selected' : '') + '>' + esc(l.nama_lembaga) + '</option>';
        });
        sel.innerHTML = opts;
        if (!sel.value && AppCache.lembaga && AppCache.lembaga.length) {
          sel.value = AppCache.lembaga[0].id;
        }
        if (sel.value) {
          lid = Number(sel.value);
          loadSettings();
        } else {
          preview.innerHTML = '<div class="empty-state">Pilih kelembagaan terlebih dahulu.</div>';
        }
      }).catch(function (e) {
        preview.innerHTML = '<div class="empty-state">Gagal memuat kelembagaan.</div>';
        AppToast(e.message, 'error');
      });
    } else {
      AppData.load().then(function () {
        loadSettings();
      }).catch(function (e) {
        preview.innerHTML = '<div class="empty-state">Gagal memuat data.</div>';
        AppToast(e.message, 'error');
      });
    }
  };

  document.addEventListener('DOMContentLoaded', function () {
    var selLS = document.getElementById('selLembagaSurat');
    if (selLS) {
      selLS.addEventListener('change', function () {
        multiSel = {};
        AppPages.surat();
      });
    }

    document.getElementById('selPekebun').addEventListener('change', renderPreview);
    document.getElementById('selJenis').addEventListener('change', function () {
      setKoperasiMode();
      renderPreview();
    });
    var selT = document.getElementById('selTanaman');
    if (selT) selT.addEventListener('change', renderPreview);
    var multiList = document.getElementById('pekebunMultiList');
    if (multiList) {
      multiList.addEventListener('change', function (e) {
        if (e.target && e.target.type === 'checkbox') {
          multiSel[e.target.value] = e.target.checked;
          renderPreview();
        }
      });
    }
    var btnAll = document.getElementById('btnMultiAll');
    if (btnAll) btnAll.addEventListener('click', function () {
      var lid = suratLembagaId();
      (AppData.get() || []).forEach(function (r) {
        if (Number(r.lembaga_id) === Number(lid)) multiSel[String(r.id)] = true;
      });
      renderMultiPekebun();
      renderPreview();
    });
    var btnNone = document.getElementById('btnMultiNone');
    if (btnNone) btnNone.addEventListener('click', function () {
      multiSel = {};
      renderMultiPekebun();
      renderPreview();
    });
    document.getElementById('inpTanggal').addEventListener('change', renderPreview);
    document.getElementById('btnBuatSurat').addEventListener('click', renderPreview);

    document.getElementById('btnCetakSurat').addEventListener('click', function () {
      if (!currentSheet) { AppToast('Buat surat terlebih dahulu.', 'warn'); return; }
      AppPrint.printHtml(currentSheet.outerHTML);
    });

    document.getElementById('btnPdfSurat').addEventListener('click', function () {
      if (!currentSheet) { AppToast('Buat surat terlebih dahulu.', 'warn'); return; }
      var jenis = document.getElementById('selJenis').value;
      var p = AppData.getById(document.getElementById('selPekebun').value);
      var s = AppSettings.get(suratLembagaId());
      var namaFile = isKolektif(jenis)
        ? ((jenis === 'beda_nama' || jenis === 'fisik') ? (s ? ('Pemerintah Desa ' + s.nama_desa) : '') : (s ? s.nama_lembaga : ''))
        : (p ? p.nama : '');
      AppPrint.pdfFromEl(currentSheet, sanitizeName(JENIS[jenis].label + ' - ' + namaFile) + '.pdf');
    });

    document.getElementById('btnSimpanArsip').addEventListener('click', function () {
      if (!currentSheet) { AppToast('Buat surat terlebih dahulu.', 'warn'); return; }
      var selJ = document.getElementById('selJenis');
      var selP = document.getElementById('selPekebun');
      var kolektif = isKolektif(selJ.value);
      var p = kolektif ? null : AppData.getById(selP.value);
      if (!kolektif && !p) return;
      var s = AppSettings.get(suratLembagaId());
      var rec = {
        jenis: selJ.value,
        jenis_label: JENIS[selJ.value].label,
        no_surat: currentNo.replace(/^Nomor\s*:\s*/, ''),
        nama: kolektif ? ((selJ.value === 'beda_nama' || selJ.value === 'fisik') ? ('Pemerintah Desa ' + (s ? s.nama_desa : '')) : (s ? s.nama_lembaga : '')) : p.nama,
        pekebun_id: kolektif ? 0 : p.id,
        lembaga_id: suratLembagaId() || 0,
        tanggal: document.getElementById('inpTanggal').value,
        tanggal_label: fmtTanggal(document.getElementById('inpTanggal').value),
        html: currentSheet.outerHTML
      };
      AppLetter.add(rec).then(function () {
        AppToast('Surat berhasil disimpan ke arsip.');
        if (window.AppPages.cetak) AppPages.cetak();
        renderPreview();
      }).catch(function (err) { AppToast(err.message, 'error'); });
    });
  });
})();
