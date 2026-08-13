(function () {
  /* ============ Helper Status (sinkron, tanpa DB) ============ */
  window.AppBerkas = {
    STATUS: {
      draft: 'Draft',
      diajukan: 'Menunggu Verifikasi',
      disetujui: 'Disetujui',
      dikembalikan: 'Dikembalikan'
    },
    dapatDiajukan: function (p) {
      return p && (p.status === 'draft' || p.status === 'dikembalikan');
    },
    terkunci: function (p) {
      return p && (p.status === 'diajukan' || p.status === 'disetujui');
    },
    badge: function (st) {
      var map = { draft: 'st-draft', diajukan: 'st-diajukan', disetujui: 'st-disetujui', dikembalikan: 'st-dikembalikan' };
      return '<span class="badge-status ' + (map[st] || 'st-draft') + '">' + (AppBerkas.STATUS[st] || st || 'Draft') + '</span>';
    },
    badgeDuplikat: function (p) {
      return p && Number(p.duplikat) === 1 ? '<span class="badge-status st-duplikat">Duplikat</span>' : '';
    }
  };

  function labelAksi(a) {
    var m = { diajukan: 'Diajukan', disetujui: 'Disetujui', dikembalikan: 'Dikembalikan', diperbarui: 'Data Diperbarui', dioverride: 'Override Administrator' };
    return m[a] || a;
  }

  var ICON_DOK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>';

  function btnLihatDokumen(id) {
    return '<button class="act-btn doc" data-act="dokumen" data-id="' + id + '" title="Lihat Dokumen">' + ICON_DOK + '</button>';
  }

  function btnSetujui(id, nama) {
    return '<button class="btn btn-xs btn-green" data-act="setujui" data-id="' + id + '" title="Setujui usulan ' + esc(nama) + '">Setujui</button>';
  }

  function btnTolak(id, nama) {
    return '<button class="btn btn-xs btn-danger" data-act="tolak" data-id="' + id + '" title="Tolak usulan ' + esc(nama) + '">Tolak</button>';
  }

  function aksiUsulanDiajukan(p) {
    if (p.status !== 'diajukan') return '';
    return btnSetujui(p.id, p.nama) + btnTolak(p.id, p.nama);
  }

  /* ============ BATAS WAKTU USULAN (kunci otomatis oleh dinas) ============ */
  var ICON_LOCK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>';
  var usBatas = null;

  function fmtBatasLong(s) {
    var m = String(s || '').replace('T', ' ').match(/^(\d{4})-(\d{2})-(\d{2})[ ](\d{2}):(\d{2})/);
    if (!m) return String(s || '-');
    var HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    var BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    var d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]));
    return HARI[d.getDay()] + ', ' + d.getDate() + ' ' + BULAN[d.getMonth()] + ' ' + d.getFullYear() + ' pukul ' + m[4] + '.' + m[5] + ' WIB';
  }

  function renderBatasBanner() {
    var b = document.getElementById('usulanBatasBanner');
    if (!b) return;
    if (!usBatas || !usBatas.batas) {
      b.hidden = true;
      b.innerHTML = '';
      return;
    }
    var tahun = esc(usBatas.tahun || new Date().getFullYear());
    if (usBatas.terkunci) {
      b.className = 'alert-banner lock';
      b.innerHTML = '<span class="ab-ico">' + ICON_LOCK + '</span>' +
        '<div class="ab-txt"><strong>Usulan Terkunci Otomatis</strong>' +
        '<span>Batas waktu pengajuan usulan pelatihan SDMPKS TA ' + tahun + ' telah berakhir pada ' + fmtBatasLong(usBatas.batas) + '. Ajukan Verifikasi dan Ajukan Ulang dinonaktifkan &mdash; input, perbaikan data, dan dokumen tetap dapat dilakukan.</span></div>' +
        '<button type="button" class="btn btn-outline btn-xs" data-act="info-lock">Pelajari Lebih Lanjut</button>';
    } else {
      b.className = 'alert-banner info';
      b.innerHTML = '<span class="ab-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg></span>' +
        '<div class="ab-txt"><strong>Batas Waktu Usulan Aktif</strong>' +
        '<span>Batas waktu pengajuan usulan pelatihan SDMPKS TA ' + tahun + ' : ' + fmtBatasLong(usBatas.batas) + '. Pastikan seluruh berkas diajukan sebelum batas waktu.</span></div>';
    }
    b.hidden = false;
  }

  /* ============ PERINGATAN PROFESIONAL (KK/NIK/batas waktu) ============ */
  function openUsulanWarning(kind, detail) {
    var m = document.getElementById('modalPeringatanUsulan');
    if (!m) return;
    detail = detail || {};
    var tahun = detail.tahun || (usBatas && usBatas.tahun) || String(new Date().getFullYear());
    var ico = document.getElementById('warnIco');
    var judul = document.getElementById('warnJudul');
    var pesan = document.getElementById('warnPesan');
    var box = document.getElementById('warnDetail');
    ico.className = 'warn-ico ' + (kind === 'batas' ? 'w-red' : 'w-amber');
    box.hidden = true;
    if (kind === 'batas') {
      judul.textContent = 'Batas Waktu Usulan Berakhir';
      pesan.textContent = 'Batas waktu pengajuan usulan pelatihan SDMPKS pada Tahun Anggaran ' + tahun + ' telah berakhir. Usulan baru tidak dapat diajukan ke Dinas Perkebunan. Input dan perbaikan data pekebun tetap dapat dilakukan.';
    } else if (kind === 'kk') {
      judul.textContent = 'Satu Kartu Keluarga = Satu Usulan';
      pesan.textContent = 'Kartu Keluarga No. ' + (detail.no_kk || '-') + ' telah mengusulkan usulan pelatihan SDMPKS pada Tahun Anggaran ' + tahun + '. Hanya satu NIK yang dapat diusulkan per Kartu Keluarga dalam satu tahun anggaran.';
      box.hidden = false;
      box.innerHTML =
        '<div class="warn-row"><span>No. KK</span><strong>' + esc(detail.no_kk || '-') + '</strong></div>' +
        '<div class="warn-row"><span>Diusulkan Atas Nama</span><strong>' + esc(detail.nama || '-') + '</strong></div>' +
        '<div class="warn-row"><span>NIK</span><strong>' + esc(detail.nik || '-') + '</strong></div>' +
        '<div class="warn-row"><span>Tahun Anggaran</span><strong>' + esc(String(tahun)) + '</strong></div>';
    } else if (kind === 'duplikat') {
      judul.textContent = 'Data Duplikat 100%';
      pesan.textContent = 'Data atas nama ' + (detail.nama || '-') + ' dengan NIK ' + (detail.nik || '-') + ' dan No. KK ' + (detail.no_kk || '-') + ' terdeteksi ganda/duplikat 100% (NIK dan No. KK sama persis dengan data lain). Data ini otomatis terfilter dan TIDAK dapat diajukan ke Dinas Kabupaten. Hapus atau perbaiki salah satu data duplikat terlebih dahulu.';
      box.hidden = false;
      box.innerHTML =
        '<div class="warn-row"><span>Nama</span><strong>' + esc(detail.nama || '-') + '</strong></div>' +
        '<div class="warn-row"><span>NIK</span><strong>' + esc(detail.nik || '-') + '</strong></div>' +
        '<div class="warn-row"><span>No. KK</span><strong>' + esc(detail.no_kk || '-') + '</strong></div>';
    } else {
      judul.textContent = 'NIK Sudah Diusulkan';
      pesan.textContent = 'NIK ' + (detail.nik || '-') + ' telah diusulkan pada Tahun Anggaran ' + tahun + ' atas nama ' + (detail.nama || '-') + '. Satu NIK hanya dapat diajukan satu kali dalam satu tahun anggaran.';
      box.hidden = false;
      box.innerHTML =
        '<div class="warn-row"><span>NIK</span><strong>' + esc(detail.nik || '-') + '</strong></div>' +
        '<div class="warn-row"><span>Diusulkan Atas Nama</span><strong>' + esc(detail.nama || '-') + '</strong></div>' +
        '<div class="warn-row"><span>Tahun Anggaran</span><strong>' + esc(String(tahun)) + '</strong></div>';
    }
    m.hidden = false;
  }

  function refreshAll() {
    var keepDinas = AppAuth.isDinas() && usDinasLid > 0;
    if (window.AppPages.pengajuan) AppPages.pengajuan();
    if (window.AppPages.usulan) { usulanKeep = !!keepDinas; AppPages.usulan(); }
    if (window.AppPages.data) AppPages.data();
    if (window.AppPages.dashboard) AppPages.dashboard();
  }

  function openRiwayat(id) {
    Api.get('berkas.php', 'riwayat', { id: id }).then(function (j) {
      var tl = (j.riwayat || []).map(function (r) {
        var cls = r.aksi === 'disetujui' ? ' ok' : (r.aksi === 'dikembalikan' ? ' no' : '');
        return '<div class="tl-item">' +
          '<span class="tl-dot' + cls + '"></span>' +
          '<div class="tl-txt">' +
          '<strong>' + labelAksi(r.aksi) + '</strong>' +
          '<span>' + fmtTglShort(r.tgl) + ' &bull; ' + esc(r.oleh || '-') + '</span>' +
          (r.catatan ? '<em>Catatan : ' + esc(r.catatan) + '</em>' : '') +
          '</div></div>';
      }).join('');
      if (!tl) tl = '<p class="muted">Belum ada riwayat.</p>';
      document.getElementById('timelineRiwayat').innerHTML = tl;
      document.getElementById('modalRiwayat').hidden = false;
    }).catch(function (err) { AppToast(err.message, 'error'); });
  }

  /* ============ DETAIL PEKEBUN (termasuk dokumen) ============ */
  function detailRow(label, value) {
    return '<div class="detail-row"><span>' + label + '</span><strong>' + (value === '' || value == null ? '-' : value) + '</strong></div>';
  }

  function renderDetailDocs(pekebunId, wrap) {
    wrap.innerHTML = '<p class="muted">Memuat dokumen...</p>';
    AppDokumen.list(pekebunId).then(function (rows) {
      if (!rows.length) {
        wrap.innerHTML = '<div class="empty-state">Belum ada dokumen terlampir.</div>';
        return;
      }
      wrap.innerHTML = rows.map(function (d) {
        return '<div class="doc-item">' +
          '<div class="doc-ico">PDF</div>' +
          '<div class="doc-info"><strong>' + esc(d.nama_asli) + '</strong>' +
          '<span>' + esc(d.ukuran_label) + ' &bull; ' + fmtTglShort(d.created_at) + '</span></div>' +
          '<div class="doc-actions">' +
          '<a class="btn btn-xs btn-outline" href="' + AppDokumen.url(d.id) + '" target="_blank" rel="noopener">Lihat</a>' +
          '</div></div>';
      }).join('');
    }).catch(function (e) {
      wrap.innerHTML = '<div class="empty-state">Gagal memuat dokumen.</div>';
      AppToast(e.message, 'error');
    });
  }

  function openDetailPekebun(p) {
    var role = AppAuth.role();
    document.getElementById('detailSub').textContent = 'Lihat rincian data dan dokumen pekebun yang diusulkan.';
    document.getElementById('detailGrid').innerHTML =
      detailRow('Nama', esc(p.nama)) +
      detailRow('NIK', esc(p.nik)) +
      detailRow('No. KK', esc(p.no_kk || '-')) +
      detailRow('Jenis Kelamin', esc(p.jk)) +
      detailRow('Tempat / Tgl Lahir', esc((p.tempat_lahir || '-') + ' / ' + (p.tanggal_lahir ? fmtTanggal(p.tanggal_lahir) : '-'))) +
      detailRow('Jenis Pelatihan', esc(p.jenis_pelatihan || '-')) +
      detailRow('Jalur', esc(p.jalur || '-')) +
      detailRow('Alamat', esc(p.alamat)) +
      detailRow('No. HP', esc(p.hp)) +
      detailRow('Desa', esc(p.desa || '-')) +
      detailRow('Kecamatan', esc(p.kecamatan || '-')) +
      detailRow('Kabupaten', esc(p.kabupaten || '-')) +
      detailRow('Provinsi', esc(p.provinsi || '-')) +
      detailRow('Kepala Desa', esc(p.kepala_desa || '-')) +
      detailRow('Kelembagaan', esc(p.lembaga_nama || '-')) +
      detailRow('Status', AppBerkas.badge(p.status)) +
      detailRow('Tanggal Input', fmtTglShort(p.tgl_input)) +
      detailRow('Diajukan', p.tgl_diajukan ? fmtTglShort(p.tgl_diajukan) : '-') +
      detailRow('Diverifikasi', p.tgl_verifikasi ? fmtTglShort(p.tgl_verifikasi) + (p.verifikator ? ' oleh ' + esc(p.verifikator) : '') : '-') +
      detailRow('Keterangan', p.alasan ? esc(p.alasan) : '-');

    renderDetailDocs(p.id, document.getElementById('detailDocList'));

    var actions = '';
    if (p.status === 'diajukan' && (role === 'dinas' || role === 'admin')) {
      actions = '<button class="btn btn-green" data-act="setujui" data-id="' + p.id + '">Setujui Berkas</button>' +
        '<button class="btn btn-danger" data-act="kembalikan" data-id="' + p.id + '">Kembalikan ke Lembaga</button>';
    }
    document.getElementById('detailActions').innerHTML = actions;
    document.getElementById('modalDetailPekebun').hidden = false;
  }

  /* ============ LIHAT DOKUMEN (dinas/admin) ============ */
  function openLihatDokumen(p) {
    document.getElementById('lihatDokumenSub').textContent = p.nama + ' (NIK ' + p.nik + ') &bull; Dokumen terlampir';
    var wrap = document.getElementById('lihatDocList');
    wrap.innerHTML = '<p class="muted">Memuat dokumen...</p>';
    AppDokumen.list(p.id).then(function (rows) {
      if (!rows.length) {
        wrap.innerHTML = '<div class="empty-state">Belum ada dokumen terlampir.</div>';
        return;
      }
      wrap.innerHTML = rows.map(function (d) {
        return '<div class="doc-item">' +
          '<div class="doc-ico">PDF</div>' +
          '<div class="doc-info"><strong>' + esc(d.nama_asli) + '</strong>' +
          '<span>' + esc(d.ukuran_label) + ' &bull; ' + fmtTglShort(d.created_at) + '</span></div>' +
          '<div class="doc-actions">' +
          '<a class="btn btn-xs btn-outline" href="' + AppDokumen.url(d.id) + '" target="_blank" rel="noopener">Lihat</a>' +
          '</div></div>';
      }).join('');
    }).catch(function (e) {
      wrap.innerHTML = '<div class="empty-state">Gagal memuat dokumen.</div>';
      AppToast(e.message, 'error');
    });
    document.getElementById('modalLihatDokumen').hidden = false;
  }

  /* ============ VERIFIKASI & EDIT USULAN ============ */
  var verifId = 0;
  var verifEditable = false;

  function usulanRow(id) {
    for (var i = 0; i < usulan.rows.length; i++) {
      if (String(usulan.rows[i].id) === String(id)) return usulan.rows[i];
    }
    return null;
  }

  function renderVerifDocs(allowEdit) {
    var wrap = document.getElementById('vDocList');
    wrap.innerHTML = '<p class="muted">Memuat dokumen...</p>';
    AppDokumen.list(verifId).then(function (rows) {
      if (!rows.length) {
        wrap.innerHTML = '<div class="empty-state">Belum ada dokumen terlampir.</div>';
        return;
      }
      wrap.innerHTML = rows.map(function (d) {
        var hapus = allowEdit
          ? '<button class="btn btn-xs btn-danger" data-doc="hapus" data-id="' + d.id + '">Hapus</button>'
          : '';
        return '<div class="doc-item">' +
          '<div class="doc-ico">PDF</div>' +
          '<div class="doc-info"><strong>' + esc(d.nama_asli) + '</strong>' +
          '<span>' + esc(d.ukuran_label) + ' &bull; ' + fmtTglShort(d.created_at) + '</span></div>' +
          '<div class="doc-actions">' +
          '<a class="btn btn-xs btn-outline" href="' + AppDokumen.url(d.id) + '" target="_blank" rel="noopener">Lihat</a>' +
          hapus +
          '</div></div>';
      }).join('');
    }).catch(function (e) {
      wrap.innerHTML = '<div class="empty-state">Gagal memuat dokumen.</div>';
      AppToast(e.message, 'error');
    });
  }

  function openVerifikasiModal(p) {
    var role = AppAuth.role();
    var isDinas = role === 'dinas';
    var isAdmin = role === 'admin';
    var editable = !isDinas;
    verifEditable = editable;
    verifId = p.id;
    if (window.AppWilayah) {
      var selP = document.getElementById('vJenisPelatihan');
      if (selP && !selP.options.length) {
        selP.innerHTML = '<option value="">-- Pilih Jenis Pelatihan --</option>' +
          AppWilayah.OPSI_PELATIHAN.map(function (o) { return '<option value="' + esc(o) + '">' + esc(o) + '</option>'; }).join('');
      }
      var selJ = document.getElementById('vJalur');
      if (selJ && !selJ.options.length) {
        selJ.innerHTML = '<option value="">-- Pilih Jalur --</option>' +
          AppWilayah.OPSI_JALUR.map(function (o) { return '<option value="' + esc(o) + '">' + esc(o) + '</option>'; }).join('');
      }
    }
    document.getElementById('vId').value = p.id;
    document.getElementById('vNama').value = p.nama;
    document.getElementById('vNik').value = p.nik;
    document.getElementById('vJk').value = p.jk;
    document.getElementById('vNoKk').value = p.no_kk || '';
    document.getElementById('vTempatLahir').value = p.tempat_lahir || '';
    document.getElementById('vTanggalLahir').value = p.tanggal_lahir || '';
    document.getElementById('vJenisPelatihan').value = p.jenis_pelatihan || '';
    document.getElementById('vJalur').value = p.jalur || '';
    document.getElementById('vKepalaDesa').value = p.kepala_desa || '';
    document.getElementById('vHp').value = p.hp;
    if (window.AppWilayah) {
      AppWilayah.setValues('v', {
        provinsi: p.provinsi || '', kabupaten: p.kabupaten || '',
        kecamatan: p.kecamatan || '', desa: p.desa || ''
      }, function () {});
    }
    document.getElementById('verifikasiSub').textContent =
      p.nama + ' (NIK ' + p.nik + ') &bull; ' + AppBerkas.STATUS[p.status] + ' &bull; ' + (p.lembaga_nama || '-');
    var keputusan = p.status === 'diajukan' && (isDinas || isAdmin);
    document.getElementById('btnTerimaVerifikasi').hidden = !keputusan;
    document.getElementById('btnTolakVerifikasi').hidden = !keputusan;
    document.getElementById('btnOverrideUsulan').hidden = !(isAdmin && p.status === 'disetujui');
    document.getElementById('btnSimpanVerifikasi').hidden = !editable;
    document.getElementById('vDocDropzone').hidden = !editable;
    ['vNama', 'vNik', 'vNoKk', 'vJk', 'vTempatLahir', 'vTanggalLahir', 'vJenisPelatihan', 'vJalur', 'vHp', 'vKepalaDesa', 'vProvinsi', 'vKabupaten', 'vKecamatan', 'vDesa'].forEach(function (id) {
      document.getElementById(id).disabled = !editable;
    });
    document.getElementById('modalVerifikasi').hidden = false;
    renderVerifDocs(editable);
  }

  /* ============ PENGAJUAN (lembaga / admin) ============ */
  var filterPengajuan = '';
  var filterPengajuanPelatihan = '';
  var pengajuanRows = [];

  function pengajuanFiltered() {
    return pengajuanRows.filter(function (p) {
      if (filterPengajuan && p.status !== filterPengajuan) return false;
      if (filterPengajuanPelatihan) {
        var v = (p.jenis_pelatihan || '').trim();
        if (filterPengajuanPelatihan === '__BELUM__') { if (v !== '') return false; }
        else if (v !== filterPengajuanPelatihan) return false;
      }
      return true;
    });
  }

  function renderPengajuan() {
    var rows = pengajuanFiltered();
    var terkunci = !!(usBatas && usBatas.terkunci);
    var isAdmin = AppAuth.isAdmin();
    var tb = document.getElementById('tbodyPengajuan');
    document.getElementById('countPengajuan').textContent = rows.length;
    if (!rows.length) {
      tb.innerHTML = '<tr class="empty-row"><td colspan="' + (isAdmin ? 9 : 8) + '">Belum ada berkas. Input data pekebun lalu ajukan verifikasi.</td></tr>';
      return;
    }
    tb.innerHTML = rows.map(function (p, i) {
      var aksi = '<button class="btn btn-xs btn-outline" data-act="detail" data-id="' + p.id + '">Detail</button>' +
        '<button class="btn btn-xs btn-ghost" data-act="riwayat" data-id="' + p.id + '">Riwayat</button>';
      if (AppBerkas.dapatDiajukan(p)) {
        if (p.duplikat) {
          aksi = '<button class="btn btn-xs btn-lock" data-act="info-duplikat" data-id="' + p.id + '" title="Data terdeteksi ganda/duplikat 100% (NIK + No. KK sama) — tidak dapat diajukan ke Dinas Kabupaten">' + ICON_LOCK + ' Duplikat</button>' + aksi;
        } else if (terkunci) {
          aksi = '<button class="btn btn-xs btn-lock" data-act="info-lock" title="Batas waktu usulan telah berakhir">' + ICON_LOCK + ' Terkunci</button>' + aksi;
        } else {
          aksi = '<button class="btn btn-xs btn-primary" data-act="ajukan" data-id="' + p.id + '">' +
            (p.status === 'dikembalikan' ? 'Ajukan Ulang' : 'Ajukan Verifikasi') + '</button>' + aksi;
        }
      }
      return '<tr>' +
        '<td>' + (i + 1) + '</td>' +
        '<td><strong>' + esc(p.nama) + '</strong></td>' +
        '<td>' + esc(p.nik) + '</td>' +
        '<td>' + esc(p.desa || '-') + '</td>' +
        '<td>' + AppBerkas.badge(p.status) + AppBerkas.badgeDuplikat(p) + '</td>' +
        '<td>' + (p.tgl_diajukan ? fmtTglShort(p.tgl_diajukan) : '-') + '</td>' +
        '<td>' + (p.alasan ? '<span class="alasan" title="' + esc(p.alasan) + '">' + esc(p.alasan) + '</span>' : '-') + '</td>' +
        '<td><div class="actions">' + aksi + '</div></td>' +
        '</tr>';
    }).join('');
  }

  window.AppPages = window.AppPages || {};
  window.AppPages.pengajuan = function () {
    var tb = document.getElementById('tbodyPengajuan');
    tb.innerHTML = '<tr class="empty-row"><td colspan="8">Memuat data...</td></tr>';
    var u = AppAuth.user();
    var lid = Number(u && u.lembaga_id) || 0;
    usBatas = null;
    if (window.AppSettings && lid) {
      AppSettings.load(lid).then(function (s) {
        var b = s.batas_usulan || '';
        var tahun = s.tahun_anggaran || String(new Date().getFullYear());
        usBatas = {
          batas: b,
          tahun: tahun,
          terkunci: !!(b && new Date(String(b).replace(' ', 'T')) <= new Date())
        };
        renderBatasBanner();
      }).catch(function () { renderBatasBanner(); });
    } else {
      renderBatasBanner();
    }
    Api.get('berkas.php', 'list').then(function (j) {
      pengajuanRows = j.rows || [];
      var selPj = document.getElementById('filterPengajuanPelatihan');
      if (selPj) {
        var optsPj = '<option value="">Semua Jenis Pelatihan</option>';
        (window.AppWilayah ? AppWilayah.OPSI_PELATIHAN : []).forEach(function (o) {
          optsPj += '<option value="' + esc(o) + '"' + (filterPengajuanPelatihan === o ? ' selected' : '') + '>' + esc(o) + '</option>';
        });
        optsPj += '<option value="__BELUM__"' + (filterPengajuanPelatihan === '__BELUM__' ? ' selected' : '') + '>Belum Diisi</option>';
        selPj.innerHTML = optsPj;
      }
      renderPengajuan();
    }).catch(function (e) {
      tb.innerHTML = '<tr class="empty-row"><td colspan="8">Gagal memuat data.</td></tr>';
      AppToast(e.message, 'error');
    });
  };

  /* ============ CETAK / UNDUH DATA PEKEBUN ============ */
  function dataPekebunDoc(rows, s) {
    s = s || {};
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
    return '<div class="print-doc landscape">' +
      window.AppSurat.kopHTML(s) +
      '<div class="pd-title">DATA PEKEBUN</div>' +
      '<div class="pd-meta">' + (s.nama_lembaga ? esc(s.nama_lembaga) : '') + ' &bull; Total : ' + rows.length + ' data</div>' +
      '<div class="pd-table-wrap"><table class="pd-table">' +
      '<thead><tr><th>No</th><th>Nama</th><th>NIK</th><th>No. KK</th><th>Jenis Kelamin</th><th>Tempat Lahir</th><th>Tgl Lahir</th><th>Jenis Pelatihan</th><th>Jalur</th><th>Provinsi</th><th>Kabupaten</th><th>Kecamatan</th><th>Desa</th><th>No. HP</th></tr></thead>' +
      '<tbody>' + rowsHtml + '</tbody></table></div>' +
      '<div class="pd-foot">Dicetak pada : ' + window.fmtDateTime() + '</div>' +
      '</div>';
  }

  function printDataPekebun(rows, lid) {
    if (!rows.length) { AppToast('Tidak ada data untuk dicetak.', 'warn'); return; }
    var load = lid > 0 ? AppSettings.load(lid) : Promise.resolve(null);
    load.catch(function () { return null; }).then(function () {
      AppPrint.printHtml(dataPekebunDoc(rows, AppSettings.get(lid)));
    });
  }

  function exportPengajuanExcel() {
    var rows = pengajuanFiltered();
    if (!rows.length) { AppToast('Tidak ada data untuk diunduh.', 'warn'); return; }
    var isAdmin = AppAuth.isAdmin();
    window.loadExcelLib().then(function () {
    var aoa = [['No', (isAdmin ? 'Kelembagaan' : null), 'Nama', 'NIK', 'No. KK', 'Jenis Kelamin', 'Tempat Lahir', 'Tgl Lahir', 'Jenis Pelatihan', 'Jalur', 'Provinsi', 'Kabupaten', 'Kecamatan', 'Desa', 'No. HP'].filter(Boolean)];
    rows.forEach(function (p, i) {
      var r = [i + 1];
      if (isAdmin) r.push(p.lembaga_nama || '');
      r.push(p.nama, p.nik, p.no_kk || '', p.jk, p.tempat_lahir || '', p.tanggal_lahir ? window.fmtTanggal(p.tanggal_lahir) : '', p.jenis_pelatihan || '', p.jalur || '', p.provinsi || '', p.kabupaten || '', p.kecamatan || '', p.desa || '', p.hp);
      aoa.push(r);
    });
    var ws = XLSX.utils.aoa_to_sheet(aoa);
    var colW = [5];
    if (isAdmin) colW.push(26);
    colW = colW.concat([25, 18, 18, 14, 14, 13, 20, 12, 18, 22, 16, 18, 16]);
    ws['!cols'] = colW.map(function (w) { return { wch: w }; });
    var wb = XLSX.utils.book_new();
    var namaSheet = filterPengajuanPelatihan ? (filterPengajuanPelatihan === '__BELUM__' ? 'Belum Diisi' : filterPengajuanPelatihan) : 'Data Pengajuan';
    XLSX.utils.book_append_sheet(wb, ws, namaSheet.substring(0, 31));
    var fPart = filterPengajuanPelatihan ? (filterPengajuanPelatihan === '__BELUM__' ? 'Belum_Diisi' : filterPengajuanPelatihan.replace(/[^\w]+/g, '_')) : '';
    XLSX.writeFile(wb, 'Data_Pengajuan' + (fPart ? '_' + fPart : '') + '_' + window.yymmdd() + '.xlsx');
    AppToast('Data pengajuan berhasil diunduh sebagai Excel.');
    }).catch(function () {
      AppToast('Library Excel tidak termuat. Periksa koneksi internet.', 'error');
    });
  }

  function exportUsulanExcel() {
    var rows = usulanExportRows();
    if (!rows.length) { AppToast('Tidak ada data untuk diunduh.', 'warn'); return; }
    window.loadExcelLib().then(function () {
    var aoa = [['No', 'Nama', 'NIK', 'No. KK', 'Jenis Kelamin', 'Jenis Pelatihan', 'Jalur', 'Desa', 'Kelembagaan', 'Status', 'Diajukan']];
    rows.forEach(function (p, i) {
      aoa.push([i + 1, p.nama, p.nik, p.no_kk || '', p.jk || '', p.jenis_pelatihan || '', p.jalur || '', p.desa || '', p.lembaga_nama || '', AppBerkas.STATUS[p.status] || p.status || '', p.tgl_diajukan ? fmtTglShort(p.tgl_diajukan) : '']);
    });
    var ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = [{ wch: 5 }, { wch: 25 }, { wch: 18 }, { wch: 18 }, { wch: 14 }, { wch: 20 }, { wch: 12 }, { wch: 18 }, { wch: 26 }, { wch: 18 }, { wch: 13 }];
    var wb = XLSX.utils.book_new();
    var namaSheet = 'Usulan';
    if (usPelatihan) namaSheet = usPelatihan === '__BELUM__' ? 'Belum Diisi' : usPelatihan;
    XLSX.utils.book_append_sheet(wb, ws, namaSheet.substring(0, 31));
    var fPart = usPelatihan ? (usPelatihan === '__BELUM__' ? 'Belum_Diisi' : usPelatihan.replace(/[^\w]+/g, '_')) : '';
    XLSX.writeFile(wb, 'Data_Usulan' + (fPart ? '_' + fPart : '') + '_' + window.yymmdd() + '.xlsx');
    AppToast('Data usulan berhasil diunduh sebagai Excel.');
    }).catch(function () {
      AppToast('Library Excel tidak termuat. Periksa koneksi internet.', 'error');
    });
  }

  function exportPengajuanPdf() {
    var rows = pengajuanFiltered();
    if (!rows.length) { AppToast('Tidak ada data untuk diunduh.', 'warn'); return; }
    var u = AppAuth.user();
    var lid = Number(u && u.lembaga_id) || 0;
    var load = lid > 0 ? AppSettings.load(lid) : Promise.resolve(null);
    load.catch(function () { return null; }).then(function () {
      AppPrint.pdfFromHtml(dataPekebunDoc(rows, AppSettings.get(lid)), 'Data_Pengajuan_' + window.yymmdd() + '.pdf');
    });
  }

  /* ============ USULAN (dinas / admin) ============ */
  var usulan = { groups: [], rows: [] };
  var usSearch = '';
  var usLembaga = 0;
  var usStatus = '';
  var usPelatihan = '';
  var usDinasLid = 0;
  var usulanKeep = false;

  function usulanFiltered() {
    var q = usSearch.toLowerCase();
    return usulan.rows.filter(function (p) {
      if (usLembaga && String(p.lembaga_id) !== String(usLembaga)) return false;
      if (usStatus && p.status !== usStatus) return false;
      if (usPelatihan) {
        var v = (p.jenis_pelatihan || '').trim();
        if (usPelatihan === '__BELUM__') { if (v !== '') return false; }
        else if (v !== usPelatihan) return false;
      }
      if (!q) return true;
      return (p.nama || '').toLowerCase().indexOf(q) > -1 || (p.nik || '').indexOf(q) > -1;
    });
  }

  function usulanExportRows() {
    var rows = usulanFiltered();
    if (AppAuth.isDinas() && usDinasLid) {
      rows = rows.filter(function (p) { return String(p.lembaga_id) === String(usDinasLid); });
    }
    return rows;
  }

  function renderUsulan() {
    var rows = usulanFiltered();
    var sum = document.getElementById('usSummary');
    var groups = usulan.groups || [];
    var total = 0, menunggu = 0, disetujui = 0, dikembalikan = 0;
    groups.forEach(function (g) {
      total += g.total || 0;
      menunggu += g.menunggu || 0;
      disetujui += g.disetujui || 0;
      dikembalikan += g.dikembalikan || 0;
    });
    document.getElementById('countUsulan').textContent = rows.length;

    sum.innerHTML =
      '<div class="us-stat c-green"><b>' + total + '</b><span>Total</span></div>' +
      '<div class="us-stat c-amber"><b>' + menunggu + '</b><span>Menunggu Verifikasi</span></div>' +
      '<div class="us-stat c-green"><b>' + disetujui + '</b><span>Disetujui</span></div>' +
      '<div class="us-stat c-red"><b>' + dikembalikan + '</b><span>Dikembalikan</span></div>';

    var wrap = document.getElementById('usGroups');
    if (!groups.length) {
      wrap.innerHTML = '<div class="empty-state">Belum ada kelembagaan.</div>';
      return;
    }
    if (AppAuth.isDinas()) {
      renderUsulanDinas(wrap, rows);
      return;
    }
    var perLembaga = {};
    rows.forEach(function (p) { perLembaga[p.lembaga_id] = perLembaga[p.lembaga_id] || []; perLembaga[p.lembaga_id].push(p); });

    wrap.innerHTML = groups.map(function (g) {
      var list = perLembaga[g.lembaga_id] || [];
      var rowsHtml = list.length ? list.map(function (p, i) {
        var aksi = btnLihatDokumen(p.id) +
          '<button class="btn btn-xs btn-outline" data-act="detail" data-id="' + p.id + '">Detail</button>' +
          '<button class="btn btn-xs btn-ghost" data-act="riwayat" data-id="' + p.id + '">Riwayat</button>';
      aksi = aksiUsulanDiajukan(p) + aksi;
      if (p.status === 'disetujui') {
        aksi = '<button class="btn btn-xs btn-danger" data-act="batalkan" data-id="' + p.id + '" title="Batalkan persetujuan usulan">Batalkan</button>' + aksi;
      }
        if (AppAuth.role() !== 'dinas') {
          aksi = '<button class="btn btn-xs btn-primary" data-act="edit" data-id="' + p.id + '">Edit</button>' +
            '<button class="btn btn-xs btn-danger" data-act="hapus" data-id="' + p.id + '">Hapus</button>' + aksi;
        }
return '<tr>' +
        '<td>' + (i + 1) + '</td>' +
        (isAdmin ? '<td>' + esc(p.lembaga_nama || '-') + '</td>' : '') +
        '<td><strong>' + esc(p.nama) + '</strong></td>' +
        '<td>' + esc(p.nik) + '</td>' +
        '<td>' + esc(p.desa || '-') + '</td>' +
        '<td>' + AppBerkas.badge(p.status) + AppBerkas.badgeDuplikat(p) + '</td>' +
        '<td>' + (p.tgl_diajukan ? fmtTglShort(p.tgl_diajukan) : '-') + '</td>' +
        '<td>' + (p.alasan ? '<span class="alasan" title="' + esc(p.alasan) + '">' + esc(p.alasan) + '</span>' : '-') + '</td>' +
        '<td><div class="actions">' + aksi + '</div></td>' +
        '</tr>';
      }).join('') : '<tr class="empty-row"><td colspan="8">Tidak ada data pada filter ini.</td></tr>';
      return '<div class="us-group">' +
        '<div class="us-group-head">' +
        '<div class="us-group-txt"><strong>' + esc(g.nama_lembaga) + '</strong>' +
        '<span>' + g.total + ' total &bull; ' + g.menunggu + ' menunggu &bull; ' + g.disetujui + ' disetujui &bull; ' + g.dikembalikan + ' dikembalikan</span></div>' +
        '<button class="btn btn-xs btn-outline" data-act="cetak" data-lembaga="' + g.lembaga_id + '" title="Cetak data pekebun kelembagaan ini">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>' +
        'Cetak Data Pekebun</button>' +
        '</div>' +
        '<div class="table-wrap"><table class="table">' +
        '<thead><tr><th>No</th><th>Nama</th><th>NIK</th><th>Desa</th><th>Status</th><th>Diajukan</th><th>Keterangan</th><th>Aksi</th></tr></thead>' +
        '<tbody>' + rowsHtml + '</tbody></table></div>' +
        '</div>';
    }).join('');
  }

  function renderUsulanDinas(wrap, rows) {
    var lid = usDinasLid;
    if (!lid) {
      var cards = (usulan.groups || []).map(function (g) {
        var terkunciG = !!(g.batas_usulan && new Date(String(g.batas_usulan).replace(' ', 'T')) <= new Date());
        return '<div class="lembaga-card us-lcard' + (terkunciG ? ' lcard-locked' : '') + '" data-lembaga="' + g.lembaga_id + '">' +
          '<div class="lc-head">' +
          '<div class="lc-badge">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21h18"/><path d="M5 21V7l7-4 7 4v14"/><path d="M9 9h1"/><path d="M9 13h1"/><path d="M14 9h1"/><path d="M14 13h1"/><path d="M10 21v-4h4v4"/></svg></div>' +
          '<div class="lc-txt"><strong>' + esc(g.nama_lembaga) + (terkunciG ? ' <span class="lock-chip">' + ICON_LOCK + ' Terkunci</span>' : '') + '</strong>' +
          '<span>' + (g.kode_surat ? esc(g.kode_surat) : '') + (g.tempat ? ' &bull; ' + esc(g.tempat) : '') + '</span></div>' +
          '</div>' +
          '<div class="lc-stats">' +
          '<div class="lc-stat"><b>' + (g.total || 0) + '</b><span>Total</span></div>' +
          '<div class="lc-stat amber"><b>' + (g.menunggu || 0) + '</b><span>Menunggu</span></div>' +
          '<div class="lc-stat green"><b>' + (g.disetujui || 0) + '</b><span>Disetujui</span></div>' +
          '<div class="lc-stat red"><b>' + (g.dikembalikan || 0) + '</b><span>Dikembalikan</span></div>' +
          '</div>' +
          '<div class="lc-actions">' +
          '<button type="button" class="btn btn-primary" data-act="lihat" data-lembaga="' + g.lembaga_id + '">Lihat Usulan</button>' +
          '</div>' +
          '</div>';
      }).join('');
      wrap.innerHTML = '<div class="lembaga-grid">' + cards + '</div>';
      return;
    }

    var g = null;
    for (var i = 0; i < (usulan.groups || []).length; i++) {
      if (String(usulan.groups[i].lembaga_id) === String(lid)) { g = usulan.groups[i]; break; }
    }
    var list = rows.filter(function (p) { return String(p.lembaga_id) === String(lid); });
    var rowsHtml = list.length ? list.map(function (p, i) {
      var aksi = btnLihatDokumen(p.id) +
        '<button class="btn btn-xs btn-outline" data-act="detail" data-id="' + p.id + '">Detail</button>' +
        '<button class="btn btn-xs btn-ghost" data-act="riwayat" data-id="' + p.id + '">Riwayat</button>';
      aksi = aksiUsulanDiajukan(p) + aksi;
      if (p.status === 'disetujui') {
        aksi = '<button class="btn btn-xs btn-danger" data-act="batalkan" data-id="' + p.id + '" title="Batalkan persetujuan usulan">Batalkan</button>' + aksi;
      }
      return '<tr>' +
        '<td>' + (i + 1) + '</td>' +
        '<td><strong>' + esc(p.nama) + '</strong></td>' +
        '<td>' + esc(p.nik) + '</td>' +
        '<td>' + esc(p.desa || '-') + '</td>' +
        '<td>' + AppBerkas.badge(p.status) + AppBerkas.badgeDuplikat(p) + '</td>' +
        '<td>' + (p.tgl_diajukan ? fmtTglShort(p.tgl_diajukan) : '-') + '</td>' +
        '<td>' + (p.alasan ? '<span class="alasan" title="' + esc(p.alasan) + '">' + esc(p.alasan) + '</span>' : '-') + '</td>' +
        '<td><div class="actions">' + aksi + '</div></td>' +
        '</tr>';
    }).join('') : '<tr class="empty-row"><td colspan="8">Belum ada usulan dari kelembagaan ini.</td></tr>';
    wrap.innerHTML =
      '<div class="us-group">' +
      '<div class="us-group-head">' +
      '<div class="us-group-txt"><strong>' + esc((g && g.nama_lembaga) || '') + '</strong>' +
      '<span>Daftar usulan pekebun kelembagaan ini.</span></div>' +
      '<div class="us-group-actions">' +
      '<button class="btn btn-xs btn-ghost" data-act="kembali">Kembali ke Daftar</button>' +
      '<button class="btn btn-xs btn-outline" data-act="cetak" data-lembaga="' + lid + '" title="Cetak data pekebun kelembagaan ini">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>' +
      'Cetak Data Pekebun</button>' +
      '</div>' +
      '</div>' +
      '<div class="table-wrap"><table class="table">' +
      '<thead><tr><th>No</th><th>Nama</th><th>NIK</th><th>Desa</th><th>Status</th><th>Diajukan</th><th>Keterangan</th><th>Aksi</th></tr></thead>' +
      '<tbody>' + rowsHtml + '</tbody></table></div>' +
      '</div>';
  }

  window.AppPages.usulan = function () {
    var isDinas = AppAuth.isDinas();
    if (isDinas) {
      if (!usulanKeep) usDinasLid = 0;
      usulanKeep = false;
      usLembaga = 0;
      document.getElementById('filterUsulanLembaga').hidden = true;
    } else {
      document.getElementById('filterUsulanLembaga').hidden = false;
    }
    document.getElementById('usGroups').innerHTML = '<div class="empty-state">Memuat data...</div>';
    Api.get('berkas.php', 'list').then(function (j) {
      usulan.groups = j.groups || [];
      usulan.rows = j.rows || [];
      var sel = document.getElementById('filterUsulanLembaga');
      var opts = '<option value="">Semua Kelembagaan</option>';
      usulan.groups.forEach(function (g) {
        opts += '<option value="' + g.lembaga_id + '"' + (String(usLembaga) === String(g.lembaga_id) ? ' selected' : '') + '>' + esc(g.nama_lembaga) + '</option>';
      });
      sel.innerHTML = opts;
      var selP = document.getElementById('filterUsulanPelatihan');
      if (selP) {
        var optsP = '<option value="">Semua Jenis Pelatihan</option>';
        (window.AppWilayah ? AppWilayah.OPSI_PELATIHAN : []).forEach(function (o) {
          optsP += '<option value="' + esc(o) + '"' + (usPelatihan === o ? ' selected' : '') + '>' + esc(o) + '</option>';
        });
        optsP += '<option value="__BELUM__"' + (usPelatihan === '__BELUM__' ? ' selected' : '') + '>Belum Diisi</option>';
        selP.innerHTML = optsP;
      }
      renderUsulan();
    }).catch(function (e) {
      document.getElementById('usGroups').innerHTML = '<div class="empty-state">Gagal memuat data.</div>';
      AppToast(e.message, 'error');
    });
  };

  /* ============ Aksi Bersama ============ */
  var kembalikanId = null;
  var overrideMode = false;
  var batalkanId = null;

  function resetKembaliModal() {
    overrideMode = false;
    batalkanId = null;
    var tw = document.getElementById('kembaliTargetWrap');
    if (tw) tw.hidden = true;
    var kh = document.getElementById('kembaliHead');
    if (kh) kh.textContent = 'Kembalikan Berkas';
    document.getElementById('btnSimpanKembali').textContent = 'Kembalikan Berkas';
    var kl = document.getElementById('keteranganLabel');
    if (kl) kl.textContent = 'Keterangan *';
  }

  document.addEventListener('DOMContentLoaded', function () {
    var btnCetakPengajuan = document.getElementById('btnCetakPengajuan');
    if (btnCetakPengajuan) {
      btnCetakPengajuan.addEventListener('click', function () {
        var u = AppAuth.user();
        printDataPekebun(pengajuanRows, Number(u && u.lembaga_id) || 0);
      });
    }
    var btnExcelPengajuan = document.getElementById('btnExcelPengajuan');
    if (btnExcelPengajuan) {
      btnExcelPengajuan.addEventListener('click', exportPengajuanExcel);
    }
    var btnPdfPengajuan = document.getElementById('btnPdfPengajuan');
    if (btnPdfPengajuan) {
      btnPdfPengajuan.addEventListener('click', exportPengajuanPdf);
    }
    var btnExcelUsulan = document.getElementById('btnExcelUsulan');
    if (btnExcelUsulan) {
      btnExcelUsulan.addEventListener('click', exportUsulanExcel);
    }

    if (document.getElementById('filterPengajuan')) {
      document.getElementById('filterPengajuan').addEventListener('change', function () {
        filterPengajuan = this.value;
        renderPengajuan();
      });
    }
    if (document.getElementById('filterPengajuanPelatihan')) {
      document.getElementById('filterPengajuanPelatihan').addEventListener('change', function () {
        filterPengajuanPelatihan = this.value;
        renderPengajuan();
      });
    }
    if (document.getElementById('filterUsulanLembaga')) {
      document.getElementById('searchUsulan').addEventListener('input', function () {
        usSearch = this.value;
        renderUsulan();
      });
      document.getElementById('filterUsulanLembaga').addEventListener('change', function () {
        usLembaga = Number(this.value) || 0;
        renderUsulan();
      });
      document.getElementById('filterUsulanStatus').addEventListener('change', function () {
        usStatus = this.value;
        renderUsulan();
      });
      document.getElementById('filterUsulanPelatihan').addEventListener('change', function () {
        usPelatihan = this.value;
        renderUsulan();
      });
    }

    document.getElementById('tbodyPengajuan').addEventListener('click', function (e) {
      var btn = e.target.closest('.btn');
      if (!btn) return;
      var id = btn.getAttribute('data-id');
      var act = btn.getAttribute('data-act');
      if (act === 'riwayat') { openRiwayat(id); return; }
      if (act === 'detail') {
        var pd = pengajuanRows.filter(function (x) { return String(x.id) === String(id); })[0];
        if (pd) openDetailPekebun(pd);
        return;
      }
      if (act === 'info-lock') { openUsulanWarning('batas', null); return; }
      if (act === 'info-duplikat') {
        var pdup = pengajuanRows.filter(function (x) { return String(x.id) === String(id); })[0];
        if (pdup) openUsulanWarning('duplikat', { nama: pdup.nama, nik: pdup.nik, no_kk: pdup.no_kk });
        return;
      }
      if (act === 'ajukan') {
        var pj = pengajuanRows.filter(function (x) { return String(x.id) === String(id); })[0];
        if (!pj) return;
        var uL = AppAuth.user();
        var lidL = Number(uL && uL.lembaga_id) || 0;
        var tahunL = (usBatas && usBatas.tahun) || String(new Date().getFullYear());
        var dup = null;
        pengajuanRows.forEach(function (x) {
          if (dup || String(x.id) === String(pj.id)) return;
          if (x.status !== 'diajukan' && x.status !== 'disetujui' && x.status !== 'dikembalikan') return;
          if (String(x.tgl_diajukan || '').slice(0, 4) !== String(tahunL)) return;
          if (x.nik === pj.nik) dup = { kind: 'nik', x: x };
          else if (pj.no_kk && x.no_kk && x.no_kk === pj.no_kk) dup = { kind: 'kk', x: x };
        });
        if (dup) {
          openUsulanWarning(dup.kind, { nama: dup.x.nama, nik: pj.nik, no_kk: pj.no_kk, tahun: tahunL, status: dup.x.status });
          return;
        }
        AppDokumen.list(pj.id).then(function (docs) {
          if (!docs.length) {
            AppToast('Upload dokumen (PDF, maks. 5 MB) pekebun terlebih dahulu sebelum mengajukan.', 'warn');
            return;
          }
          return Api.post('berkas.php', 'ajukan', { id: pj.id }).then(function () {
            AppToast('Berkas berhasil diajukan untuk verifikasi.');
            refreshAll();
          });
        }).catch(function (err) {
          if (err.code === 'kk_terpakai') openUsulanWarning('kk', err.detail);
          else if (err.code === 'nik_terpakai') openUsulanWarning('nik', err.detail);
          else if (err.code === 'batas_berakhir') openUsulanWarning('batas', err.detail);
          else AppToast(err.message, 'error');
        });
        return;
      }
    });

    var usWrap = document.getElementById('usGroups');
    if (usWrap) {
      usWrap.addEventListener('click', function (e) {
      var card = e.target.closest('.us-lcard');
      if (card && !e.target.closest('.btn')) {
        usDinasLid = Number(card.getAttribute('data-lembaga')) || 0;
        renderUsulan();
        return;
      }
      var btn = e.target.closest('.btn, .act-btn');
      if (!btn) return;
      var id = btn.getAttribute('data-id');
      var act = btn.getAttribute('data-act');
      if (act === 'kembali') { usDinasLid = 0; renderUsulan(); return; }
      if (act === 'lihat') {
        usDinasLid = Number(btn.getAttribute('data-lembaga')) || 0;
        renderUsulan();
        return;
      }
      if (act === 'riwayat') { openRiwayat(id); return; }
      if (act === 'dokumen') {
        var pd0 = usulan.rows.filter(function (x) { return String(x.id) === String(id); })[0];
        if (pd0) openLihatDokumen(pd0);
        return;
      }
      if (act === 'setujui') {
        var ps = usulan.rows.filter(function (x) { return String(x.id) === String(id); })[0];
        if (!ps) return;
        AppConfirm('Setujui usulan atas nama "' + ps.nama + '"?', function () {
          Api.post('berkas.php', 'setujui', { id: ps.id }).then(function () {
            AppToast('Usulan disetujui.');
            refreshAll();
          }).catch(function (err) { AppToast(err.message, 'error'); });
        });
        return;
      }
      if (act === 'tolak') {
        var pt = usulan.rows.filter(function (x) { return String(x.id) === String(id); })[0];
        if (!pt) return;
        resetKembaliModal();
        kembalikanId = pt.id;
        document.getElementById('kembaliHead').textContent = 'Penolakan Usulan';
        document.getElementById('btnSimpanKembali').textContent = 'Tolak & Kembalikan';
        var kl = document.getElementById('keteranganLabel');
        if (kl) kl.textContent = 'Alasan Penolakan *';
        document.getElementById('kembaliInfo').textContent =
          'Tolak usulan atas nama "' + pt.nama + '" (NIK ' + pt.nik + '). Berkas akan dikembalikan ke lembaga beserta alasan penolakan agar dapat diperbaiki.';
        document.getElementById('keterangan').value = '';
        document.getElementById('modalKembali').hidden = false;
        setTimeout(function () { document.getElementById('keterangan').focus(); }, 50);
        return;
      }
      if (act === 'batalkan') {
        var pb = usulan.rows.filter(function (x) { return String(x.id) === String(id); })[0];
        if (!pb) return;
        resetKembaliModal();
        batalkanId = pb.id;
        document.getElementById('kembaliHead').textContent = 'Batalkan Persetujuan Usulan';
        document.getElementById('btnSimpanKembali').textContent = 'Ya, Batalkan';
        var lbl = document.getElementById('keteranganLabel');
        if (lbl) lbl.textContent = 'Alasan Pembatalan *';
        document.getElementById('kembaliInfo').textContent =
          'Batalkan persetujuan usulan atas nama "' + pb.nama + '" (NIK ' + pb.nik + '). Status usulan akan kembali menjadi Draft dan lembaga dapat memperbaiki / mengajukan ulang.';
        document.getElementById('keterangan').value = '';
        document.getElementById('modalKembali').hidden = false;
        setTimeout(function () { document.getElementById('keterangan').focus(); }, 50);
        return;
      }
      if (act === 'detail') {
        var pd = usulan.rows.filter(function (x) { return String(x.id) === String(id); })[0];
        if (pd) openDetailPekebun(pd);
        return;
      }
      if (act === 'cetak') {
        var lid = btn.getAttribute('data-lembaga');
        var rowsL = usulan.rows.filter(function (x) { return String(x.lembaga_id) === String(lid); });
        printDataPekebun(rowsL, Number(lid) || 0);
        return;
      }
      var p = usulan.rows.filter(function (x) { return String(x.id) === String(id); })[0];
      if (!p) return;
      if (act === 'edit') {
        openVerifikasiModal(p);
      } else if (act === 'hapus') {
        AppConfirm('Yakin ingin menghapus usulan atas nama "' + p.nama + '"?', function () {
          Api.post('pekebun.php', 'delete', { id: p.id }).then(function () {
            AppToast('Usulan dihapus.');
            refreshAll();
          }).catch(function (err) { AppToast(err.message, 'error'); });
        });
      }
      });
    }

    var mk = document.getElementById('modalKembali');
    if (mk) {
      document.getElementById('btnTutupKembali').addEventListener('click', function () { mk.hidden = true; resetKembaliModal(); });
      document.getElementById('btnBatalKembali').addEventListener('click', function () { mk.hidden = true; resetKembaliModal(); });
      mk.addEventListener('click', function (e) { if (e.target === mk) { mk.hidden = true; resetKembaliModal(); } });
      document.getElementById('btnSimpanKembali').addEventListener('click', function () {
        var catatan = document.getElementById('keterangan').value;
        if (!catatan.trim()) {
          AppToast('Keterangan wajib diisi.', 'error');
          document.getElementById('keterangan').focus();
          return;
        }
        var wasOverride = overrideMode;
        var wasBatalkan = batalkanId > 0;
        var p = wasOverride
          ? Api.post('berkas.php', 'override', {
              id: kembalikanId, alasan: catatan,
              status: document.getElementById('kembaliTarget').value
            })
          : wasBatalkan
            ? Api.post('berkas.php', 'batalkan', { id: batalkanId, alasan: catatan })
            : Api.post('berkas.php', 'kembalikan', { id: kembalikanId, alasan: catatan });
        p.then(function () {
          mk.hidden = true;
          resetKembaliModal();
          var mv0 = document.getElementById('modalVerifikasi');
          if (mv0) mv0.hidden = true;
          AppToast(wasOverride ? 'Usulan dibuka kembali oleh administrator.' : (wasBatalkan ? 'Persetujuan usulan dibatalkan.' : 'Berkas dikembalikan ke lembaga.'));
          refreshAll();
        }).catch(function (err) { AppToast(err.message, 'error'); });
      });
    }

    var mr = document.getElementById('modalRiwayat');
    if (mr) {
      document.getElementById('btnTutupRiwayat').addEventListener('click', function () { mr.hidden = true; });
      mr.addEventListener('click', function (e) { if (e.target === mr) mr.hidden = true; });
    }

    var mw = document.getElementById('modalPeringatanUsulan');
    if (mw) {
      document.getElementById('btnMengertiPeringatan').addEventListener('click', function () { mw.hidden = true; });
      mw.addEventListener('click', function (e) { if (e.target === mw) mw.hidden = true; });
      var banner = document.getElementById('usulanBatasBanner');
      if (banner) {
        banner.addEventListener('click', function (e) {
          var b = e.target.closest('[data-act]');
          if (b && b.getAttribute('data-act') === 'info-lock') openUsulanWarning('batas', null);
        });
      }
    }

    var mld = document.getElementById('modalLihatDokumen');
    if (mld) {
      document.getElementById('btnTutupLihatDokumen').addEventListener('click', function () { mld.hidden = true; });
      mld.addEventListener('click', function (e) { if (e.target === mld) mld.hidden = true; });
    }

    var mdp = document.getElementById('modalDetailPekebun');
    if (mdp) {
      document.getElementById('btnTutupDetailPekebun').addEventListener('click', function () { mdp.hidden = true; });
      mdp.addEventListener('click', function (e) { if (e.target === mdp) mdp.hidden = true; });
      document.getElementById('detailActions').addEventListener('click', function (e) {
        var btn = e.target.closest('[data-act]');
        if (!btn) return;
        var id = btn.getAttribute('data-id');
        var act = btn.getAttribute('data-act');
        var p = null;
        usulan.rows.forEach(function (x) { if (String(x.id) === String(id)) p = x; });
        if (!p) pengajuanRows.forEach(function (x) { if (String(x.id) === String(id)) p = x; });
        if (!p) return;
        if (act === 'setujui') {
          AppConfirm('Setujui berkas atas nama "' + p.nama + '"?', function () {
            Api.post('berkas.php', 'setujui', { id: p.id }).then(function () {
              mdp.hidden = true;
              AppToast('Berkas disetujui.');
              refreshAll();
            }).catch(function (err) { AppToast(err.message, 'error'); });
          });
        } else if (act === 'kembalikan') {
          resetKembaliModal();
          kembalikanId = p.id;
          document.getElementById('kembaliInfo').textContent = 'Kembalikan berkas atas nama "' + p.nama + '" (NIK ' + p.nik + ')';
          document.getElementById('keterangan').value = '';
          document.getElementById('modalKembali').hidden = false;
          setTimeout(function () { document.getElementById('keterangan').focus(); }, 50);
        }
      });
    }

    var mv = document.getElementById('modalVerifikasi');
    if (mv) {
      if (window.AppWilayah) {
        AppWilayah.init('v');
        AppWilayah.bindRegionSelects('v', {});
      }
      document.getElementById('btnTutupVerifikasi').addEventListener('click', function () { mv.hidden = true; });
      document.getElementById('btnBatalVerifikasi').addEventListener('click', function () { mv.hidden = true; });
      mv.addEventListener('click', function (e) { if (e.target === mv) mv.hidden = true; });

      function uploadVerifDoc(file) {
        if (!file) return;
        var isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name || '');
        if (!isPdf) {
          AppToast('Hanya file PDF yang diperbolehkan.', 'error');
          return;
        }
        if (file.size > 5 * 1024 * 1024) {
          AppToast('Ukuran file maksimal 5 MB.', 'error');
          return;
        }
        AppDokumen.upload(file, verifId).then(function () {
          AppToast('Dokumen berhasil diunggah.');
          renderVerifDocs(verifEditable);
        }).catch(function (err) { AppToast(err.message, 'error'); });
      }

      var vDrop = document.getElementById('vDocDropzone');
      var vFile = document.getElementById('vFileDokumen');
      document.getElementById('btnPilihDokumen2').addEventListener('click', function () { vFile.click(); });
      vFile.addEventListener('change', function () {
        if (vFile.files.length) uploadVerifDoc(vFile.files[0]);
        vFile.value = '';
      });
      ['dragenter', 'dragover'].forEach(function (ev) {
        vDrop.addEventListener(ev, function (e) { e.preventDefault(); vDrop.classList.add('drag'); });
      });
      ['dragleave', 'drop'].forEach(function (ev) {
        vDrop.addEventListener(ev, function (e) { e.preventDefault(); vDrop.classList.remove('drag'); });
      });
      vDrop.addEventListener('drop', function (e) {
        var f = e.dataTransfer.files && e.dataTransfer.files[0];
        if (f) uploadVerifDoc(f);
      });
      document.getElementById('vDocList').addEventListener('click', function (e) {
        var btn = e.target.closest('[data-doc="hapus"]');
        if (!btn) return;
        AppConfirm('Yakin ingin menghapus dokumen ini?', function () {
          AppDokumen.hapus(btn.getAttribute('data-id'), verifId).then(function () {
            AppToast('Dokumen dihapus.');
            renderVerifDocs(verifEditable);
          }).catch(function (err) { AppToast(err.message, 'error'); });
        });
      });

      document.getElementById('btnSimpanVerifikasi').addEventListener('click', function () {
        var nama = document.getElementById('vNama').value.trim();
        var nik = document.getElementById('vNik').value.trim();
        var jk = document.getElementById('vJk').value;
        var noKk = document.getElementById('vNoKk').value.trim();
        var tempatLahir = document.getElementById('vTempatLahir').value.trim();
        var tanggalLahir = document.getElementById('vTanggalLahir').value;
        var jenisPelatihan = document.getElementById('vJenisPelatihan').value;
        var jalur = document.getElementById('vJalur').value;
        var wilayah = window.AppWilayah ? AppWilayah.readValues('v') : { desa: '' };
        var desa = wilayah.desa || '';
        var alamat = (window.AppWilayah && AppWilayah.composeAlamat('v')) || '';
        var hp = document.getElementById('vHp').value.trim();
        var kepalaDesa = document.getElementById('vKepalaDesa').value.trim();
        if (!nama) { AppToast('Nama wajib diisi.', 'error'); return; }
        if (!/^\d{16}$/.test(nik)) { AppToast('NIK harus 16 digit angka.', 'error'); return; }
        if (!jk) { AppToast('Pilih jenis kelamin.', 'error'); return; }
        if (!jenisPelatihan) { AppToast('Pilih jenis pelatihan.', 'error'); return; }
        if (!jalur) { AppToast('Pilih jalur.', 'error'); return; }
        if (!desa) { AppToast('Pilih desa/kelurahan wilayah pekebun.', 'error'); return; }
        var digits = (hp || '').replace(/\D/g, '');
        if (digits.length < 10 || digits.length > 15) { AppToast('Nomor handphone tidak valid (minimal 10 digit).', 'error'); return; }
        Api.post('pekebun.php', 'save', {
          id: verifId, nama: nama, nik: nik, no_kk: noKk, jk: jk,
          tempat_lahir: tempatLahir, tanggal_lahir: tanggalLahir || '',
          jenis_pelatihan: jenisPelatihan, jalur: jalur,
          alamat: alamat, desa: desa,
          provinsi: wilayah.provinsi || '', kabupaten: wilayah.kabupaten || '', kecamatan: wilayah.kecamatan || '',
          kepala_desa: kepalaDesa, hp: hp
        }).then(function () {
          AppToast('Data usulan berhasil diperbarui.');
          refreshAll();
        }).catch(function (err) { AppToast(err.message, 'error'); });
      });

      document.getElementById('btnTerimaVerifikasi').addEventListener('click', function () {
        var p = usulanRow(verifId);
        if (!p) return;
        AppConfirm('Terima (setujui) usulan atas nama "' + p.nama + '"?', function () {
          Api.post('berkas.php', 'setujui', { id: verifId }).then(function () {
            mv.hidden = true;
            AppToast('Usulan diterima dan disetujui.');
            refreshAll();
          }).catch(function (err) { AppToast(err.message, 'error'); });
        });
      });

      document.getElementById('btnTolakVerifikasi').addEventListener('click', function () {
        var p = usulanRow(verifId);
        if (!p) return;
        resetKembaliModal();
        kembalikanId = verifId;
        document.getElementById('kembaliInfo').textContent = 'Tolak / kembalikan usulan atas nama "' + p.nama + '" (NIK ' + p.nik + ')';
        document.getElementById('keterangan').value = '';
        document.getElementById('modalKembali').hidden = false;
        setTimeout(function () { document.getElementById('keterangan').focus(); }, 50);
      });

      document.getElementById('btnOverrideUsulan').addEventListener('click', function () {
        var p = usulanRow(verifId);
        if (!p) return;
        overrideMode = true;
        document.getElementById('kembaliHead').textContent = 'Override Berkas';
        document.getElementById('btnSimpanKembali').textContent = 'Konfirmasi Override';
        document.getElementById('kembaliTargetWrap').hidden = false;
        document.getElementById('kembaliInfo').textContent =
          'Override usulan atas nama "' + p.nama + '" (NIK ' + p.nik + '). Berkas berstatus Disetujui akan dibuka kembali untuk diperbaiki oleh lembaga.';
        document.getElementById('keterangan').value = '';
        document.getElementById('modalKembali').hidden = false;
        setTimeout(function () { document.getElementById('keterangan').focus(); }, 50);
      });
    }

    var md = document.getElementById('modalDokumen');
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        if (mk) mk.hidden = true;
        if (mr) mr.hidden = true;
        if (md) md.hidden = true;
        if (mdp) mdp.hidden = true;
        if (mv) mv.hidden = true;
        if (mld) mld.hidden = true;
        if (mw) mw.hidden = true;
      }
    });
  });
})();
