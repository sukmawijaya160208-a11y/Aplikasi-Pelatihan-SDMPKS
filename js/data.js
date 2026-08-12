/* ============================================================
   SDMPKS - Inti Aplikasi: navigasi, dashboard, data pekebun,
   kelembagaan (admin) & akun pengguna (admin)
   ============================================================ */
(function () {
  /* ============ Helper Umum ============ */
  window.esc = function (v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (m) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m];
    });
  };

  var BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

  window.fmtTanggal = function (iso) {
    if (!iso) return '';
    var d = new Date(iso + 'T00:00:00');
    if (isNaN(d.getTime())) return '';
    return d.getDate() + ' ' + BULAN[d.getMonth()] + ' ' + d.getFullYear();
  };
  window.fmtTglShort = function (iso) {
    if (!iso) return '';
    var d = new Date(String(iso).replace(' ', 'T'));
    if (isNaN(d.getTime())) return '';
    return ('0' + d.getDate()).slice(-2) + '/' + ('0' + (d.getMonth() + 1)).slice(-2) + '/' + d.getFullYear();
  };
  window.fmtDateTime = function () {
    var d = new Date();
    return ('0' + d.getDate()).slice(-2) + '/' + ('0' + (d.getMonth() + 1)).slice(-2) + '/' + d.getFullYear() +
      ' ' + ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2);
  };
  window.yymmdd = function () {
    var d = new Date();
    return '' + d.getFullYear() + ('0' + (d.getMonth() + 1)).slice(-2) + ('0' + d.getDate()).slice(-2);
  };

  window.setSelOpt = function (el, v) {
    v = String(v == null ? '' : v);
    if (!el || !v) return v;
    var found = false;
    [].forEach.call(el.options, function (o) { if (o.value === v) found = true; });
    if (!found) {
      var opt = document.createElement('option');
      opt.value = v;
      opt.textContent = v;
      el.appendChild(opt);
    }
    el.value = v;
    return v;
  };

  /* ============ Pencetakan & PDF ============ */
  function pdfPageSize(el) {
    if (el.classList && el.classList.contains('landscape')) {
      return { format: [297, 210], width: 297, topMm: 12, pageMm: 186 };
    }
    var isFisik = el.className.indexOf('fisik-kerat') > -1;
    if (isFisik) return { format: [215.9, 330], width: 215.9, onePage: true };
    var wmm = Math.round((el.offsetWidth / 3.779528) * 10) / 10;
    var hmm = Math.round((el.offsetHeight / 3.779528) * 10) / 10;
    return { format: wmm > 0 ? [wmm, hmm > 0 ? hmm : 297] : 'a4', width: wmm > 0 ? wmm : 210 };
  }
  function pdfAddCanvas(doc, canvas, widthMm, filename, opts) {
    if (opts === true) opts = { onePage: true };
    opts = opts || {};
    var pxPerMm = canvas.width / widthMm;
    var pageMm = opts.pageMm || doc.internal.pageSize.getHeight();
    var topMm = opts.topMm || 0;
    var pageHpx = pageMm * pxPerMm;
    var topPx = topMm * pxPerMm;
    var pages = opts.onePage ? 1 : Math.max(1, Math.ceil((canvas.height - topPx) / pageHpx - 0.01));
    var imgHmm = canvas.height / pxPerMm;
    for (var i = 0; i < pages; i++) {
      if (i > 0) doc.addPage();
      doc.addImage(canvas, 'JPEG', 0, topMm - (i * pageHpx) / pxPerMm, widthMm, imgHmm, undefined, 'FAST');
    }
    doc.save(filename);
  }
  function newPdfDoc(sz) {
    var orient = sz.format && sz.format[0] > sz.format[1] ? 'l' : 'p';
    return new window.jspdf.jsPDF({ orientation: orient, unit: 'mm', format: sz.format, compress: true });
  }
  function buildPdfFromEl(el, filename) {
    var js = window.jspdf;
    if (!js) { AppToast('Library PDF tidak termuat. Periksa koneksi internet.', 'error'); return; }
    var sz = pdfPageSize(el);
    html2canvas(el, { scale: 2, useCORS: true, windowWidth: el.scrollWidth }).then(function (canvas) {
      var doc = newPdfDoc(sz);
      pdfAddCanvas(doc, canvas, sz.width, filename, sz);
    }).catch(function (e) {
      AppToast('Gagal membuat PDF: ' + e.message, 'error');
    });
  }
  window.AppPrint = {
    printHtml: function (html) {
      var pa = document.getElementById('printArea');
      pa.innerHTML = html;
      document.body.classList.add('printing');
      window.print();
      setTimeout(function () { document.body.classList.remove('printing'); }, 400);
    },
    pdfFromEl: function (el, filename) {
      window.loadPdfLib().then(function () {
        buildPdfFromEl(el, filename);
      }).catch(function () {
        AppToast('Library PDF tidak termuat. Periksa koneksi internet.', 'error');
      });
    },
    pdfFromHtml: function (html, filename) {
      var ov = document.getElementById('pdfOverlay');
      ov.innerHTML = html;
      var el = ov.firstElementChild;
      if (!el) { ov.innerHTML = ''; return; }
      window.loadPdfLib().then(function () {
        var js = window.jspdf;
        var sz = pdfPageSize(el);
        html2canvas(el, { scale: 2, useCORS: true, windowWidth: el.scrollWidth }).then(function (canvas) {
          var doc = newPdfDoc(sz);
          pdfAddCanvas(doc, canvas, sz.width, filename, sz);
          ov.innerHTML = '';
        }).catch(function (e) {
          ov.innerHTML = '';
          AppToast('Gagal membuat PDF: ' + e.message, 'error');
        });
      }).catch(function () {
        ov.innerHTML = '';
        AppToast('Library PDF tidak termuat. Periksa koneksi internet.', 'error');
      });
    }
  };

  /* ============ Cache Kelembagaan ============ */
  window.AppCache = { lembaga: null };
  window.loadLembaga = function (force) {
    if (AppCache.lembaga && !force) return Promise.resolve(AppCache.lembaga);
    return Api.get('lembaga.php', 'list').then(function (j) {
      AppCache.lembaga = j.rows || [];
      return AppCache.lembaga;
    });
  };

  /* ============ Navigasi & Halaman ============ */
  var ICONS = {
    dashboard: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/>',
    data: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    surat: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>',
    cetak: '<polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>',
    pengajuan: '<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>',
    usulan: '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>',
    lembaga: '<path d="M3 21h18"/><path d="M5 21V7l7-4 7 4v14"/><path d="M9 9h1"/><path d="M9 13h1"/><path d="M14 9h1"/><path d="M14 13h1"/><path d="M10 21v-4h4v4"/>',
    akun: '<path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/>',
    backup: '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>',
    pengaturan: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
    tentang: '<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>'
  };

  var NAV = [
    { page: 'dashboard', label: 'Dashboard', roles: ['admin', 'dinas', 'lembaga'] },
    { page: 'data', label: 'Input Data', roles: ['admin', 'lembaga'] },
    { page: 'surat', label: 'Surat-Surat', roles: ['admin', 'lembaga'] },
    { page: 'cetak', label: 'Cetak', roles: ['admin', 'lembaga'] },
    { page: 'pengajuan', label: 'Pengajuan Berkas', roles: ['lembaga'] },
    { page: 'usulan', label: 'Usulan Kelembagaan', roles: ['admin', 'dinas'] },
    { page: 'lembaga', label: 'Kelembagaan', roles: ['admin'] },
    { page: 'akun', label: 'Akun Pengguna', roles: ['admin'] },
    { page: 'backup', label: 'Backup & Restore', roles: ['admin', 'lembaga'] },
    { page: 'pengaturan', label: 'Pengaturan', roles: ['admin', 'dinas', 'lembaga'] },
    { page: 'tentang', label: 'Tentang Aplikasi', roles: ['admin', 'dinas', 'lembaga'] }
  ];

  var TITLES = {
    dashboard: ['Dashboard', 'Ringkasan keseluruhan data'],
    data: ['Input Data', 'Kelola data pekebun'],
    surat: ['Surat-Surat', 'Buat surat resmi kelembagaan'],
    cetak: ['Cetak', 'Arsip surat dan cetak ulang dokumen'],
    pengajuan: ['Pengajuan Berkas', 'Ajukan dan pantau status berkas'],
    usulan: ['Usulan Kelembagaan', 'Verifikasi usulan yang diajukan lembaga'],
    lembaga: ['Kelembagaan', 'Kelola daftar kelembagaan pekebun'],
    akun: ['Akun Pengguna', 'Kelola akun pengguna aplikasi'],
    backup: ['Backup & Restore', 'Cadangkan dan pulihkan data aplikasi'],
    pengaturan: ['Pengaturan', 'Pengaturan kelembagaan dan kop surat'],
    tentang: ['Tentang Aplikasi', 'Informasi mengenai aplikasi']
  };

  window.AppPages = {};
  window.AppGo = function (page, opts) {
    AppGo.opts = opts || null;
    var sections = document.querySelectorAll('.page');
    for (var i = 0; i < sections.length; i++) {
      sections[i].classList.toggle('active', sections[i].id === 'page-' + page);
    }
    var navs = document.querySelectorAll('.nav-item');
    for (var j = 0; j < navs.length; j++) {
      navs[j].classList.toggle('active', navs[j].getAttribute('data-page') === page);
    }
    var t = TITLES[page] || TITLES.dashboard;
    if (page === 'pengaturan' && AppAuth.role() === 'dinas') {
      t = ['Detail Kelembagaan', 'Detail lengkap kelembagaan beserta pengaturannya'];
    }
    document.getElementById('pageTitle').textContent = t[0];
    document.getElementById('pageSubtitle').textContent = t[1];
    document.body.classList.remove('nav-open');
    var fn = window.AppPages[page];
    if (fn) fn();
    window.scrollTo(0, 0);
  };

  function buildNav() {
    var role = AppAuth.role();
    var nav = document.getElementById('sidebarNav');
    var html = '';
    for (var i = 0; i < NAV.length; i++) {
      var item = NAV[i];
      if (item.roles.indexOf(role) === -1) continue;
      var label = item.label;
      if (item.page === 'pengaturan' && role === 'dinas') label = 'Detail Kelembagaan';
      html += '<button class="nav-item' + (item.page === 'dashboard' ? ' active' : '') + '" data-page="' + item.page + '">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + ICONS[item.page] + '</svg>' +
        label + '</button>';
    }
    nav.innerHTML = html;
    var navs = nav.querySelectorAll('.nav-item');
    for (var k = 0; k < navs.length; k++) {
      navs[k].addEventListener('click', function () {
        AppGo(this.getAttribute('data-page'));
      });
    }
  }

  function renderTopbar() {
    var u = AppAuth.user();
    var nama = AppAuth.nama();
    document.getElementById('pmName').textContent = nama;
    document.getElementById('pmName2').textContent = nama;
    document.getElementById('pmUser2').textContent = '@' + (u ? u.username : '');
    document.getElementById('pmRole').textContent = AppAuth.roleLabel();
    document.getElementById('avatarInit').textContent = (nama || '?').charAt(0).toUpperCase();
  }

  /* ============ Dashboard ============ */
  function renderStatCards(role, s) {
    var map = [
      { key: 'total', label: 'Total Pekebun', color: 'c-green', icon: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>' },
      { key: 'pria', label: 'Laki-Laki', color: 'c-blue', icon: '<circle cx="12" cy="7" r="4"/><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>' },
      { key: 'wanita', label: 'Perempuan', color: 'c-amber', icon: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/><path d="M12 3a2.5 2.5 0 0 1 2.5 2.5c0 1-.5 1.5-2.5 2.5-2-1-2.5-1.5-2.5-2.5A2.5 2.5 0 0 1 12 3z"/>' },
      { key: 'surat', label: 'Total Surat', color: 'c-purple', icon: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/>' },
      { key: 'menunggu', label: 'Menunggu Verifikasi', color: 'c-amber', icon: '<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>' },
      { key: 'disetujui', label: 'Disetujui', color: 'c-green', icon: '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>' },
      { key: 'dikembalikan', label: 'Dikembalikan', color: 'c-red', icon: '<circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>' }
    ];
    var extra = [];
    if (role === 'admin' || role === 'dinas') {
      extra = [
        { key: 'lembaga', label: 'Kelembagaan', color: 'c-purple', icon: '<path d="M3 21h18"/><path d="M5 21V7l7-4 7 4v14"/><path d="M9 9h1"/><path d="M9 13h1"/><path d="M14 9h1"/><path d="M14 13h1"/><path d="M10 21v-4h4v4"/>' }
      ];
    }
    if (role === 'admin') {
      extra.push({ key: 'akun', label: 'Akun Pengguna', color: 'c-blue', icon: '<path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/>' });
    }
    var cards = (role === 'lembaga' ? [] : extra).concat(map);
    document.getElementById('statGrid').innerHTML = cards.map(function (c) {
      return '<div class="stat-card ' + c.color + '">' +
        '<div class="stat-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + c.icon + '</svg></div>' +
        '<div><div class="stat-value">' + (s[c.key] || 0) + '</div><div class="stat-label">' + c.label + '</div></div>' +
        '</div>';
    }).join('');
  }

  function renderRecent(role, st) {
    var tb = document.getElementById('tbodyRecent');
    var recent = st.recent || [];
    if (role === 'lembaga') {
      document.getElementById('recentTitle').textContent = 'Data Pekebun Terbaru';
      document.getElementById('recentHead').innerHTML = '<tr><th>No</th><th>Nama</th><th>NIK</th><th>Jenis Kelamin</th><th>Alamat</th><th>No. HP</th></tr>';
      if (!recent.length) {
        tb.innerHTML = '<tr class="empty-row"><td colspan="6">Belum ada data pekebun. Silakan input data terlebih dahulu.</td></tr>';
      } else {
        tb.innerHTML = recent.map(function (p, i) {
          return '<tr><td>' + (i + 1) + '</td><td><strong>' + esc(p.nama) + '</strong></td><td>' + esc(p.nik) + '</td><td>' + esc(p.jk) + '</td><td>' + esc(p.alamat) + '</td><td>' + esc(p.hp) + '</td></tr>';
        }).join('');
      }
    } else {
      document.getElementById('recentTitle').textContent = 'Usulan Terbaru';
      document.getElementById('recentHead').innerHTML = '<tr><th>No</th><th>Nama</th><th>NIK</th><th>Kelembagaan</th><th>Status</th><th>Diajukan</th></tr>';
      if (!recent.length) {
        tb.innerHTML = '<tr class="empty-row"><td colspan="6">Belum ada usulan dari kelembagaan.</td></tr>';
      } else {
        tb.innerHTML = recent.map(function (p, i) {
          var stBadge = window.AppBerkas ? AppBerkas.badge(p.status) : '';
          return '<tr><td>' + (i + 1) + '</td><td><strong>' + esc(p.nama) + '</strong></td><td>' + esc(p.nik) + '</td><td>' + esc(p.lembaga_nama || '-') + '</td><td>' + stBadge + '</td><td>' + (p.tgl_diajukan ? fmtTglShort(p.tgl_diajukan) : '-') + '</td></tr>';
        }).join('');
      }
    }
  }

  window.AppPages.dashboard = function () {
    var grid = document.getElementById('statGrid');
    grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1;">Memuat data...</div>';
    Api.get('dashboard.php', 'stats').then(function (j) {
      var role = AppAuth.role();
      var s = j.stats.stats;
      renderStatCards(role, s);
      renderRecent(role, j.stats);
      if (window.AppChart) {
        window.loadChartLib().then(function () {
          if (window.AppChart) AppChart.draw(j.stats);
        }).catch(function () {});
      }
    }).catch(function (e) {
      grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1;">Gagal memuat data.</div>';
      AppToast(e.message, 'error');
    });
  };

  /* ============ Halaman Data Pekebun ============ */
  var state = {
    rows: [],
    searchVal: '',
    filterJk: '',
    filterLembagaId: 0
  };
  window.stateData = state;

  window.filteredData = function () {
    var q = state.searchVal.toLowerCase();
    return state.rows.filter(function (p) {
      if (state.filterJk && p.jk !== state.filterJk) return false;
      if (state.filterLembagaId && String(p.lembaga_id) !== String(state.filterLembagaId)) return false;
      if (!q) return true;
      return (p.nama || '').toLowerCase().indexOf(q) > -1 || (p.nik || '').indexOf(q) > -1;
    });
  };

  function fillLembagaSelects(sel, selectedId) {
    var opts = '<option value="">-- Pilih Kelembagaan --</option>';
    (AppCache.lembaga || []).forEach(function (l) {
      opts += '<option value="' + l.id + '"' + (String(l.id) === String(selectedId) ? ' selected' : '') + '>' + esc(l.nama_lembaga) + '</option>';
    });
    sel.innerHTML = opts;
  }

  function fillOpsiKeikutsertaan(selPelatihanId, selJalurId) {
    var selP = document.getElementById(selPelatihanId);
    var selJ = document.getElementById(selJalurId);
    if (selP && window.AppWilayah) {
      selP.innerHTML = '<option value="">-- Pilih Jenis Pelatihan --</option>' +
        AppWilayah.OPSI_PELATIHAN.map(function (o) { return '<option value="' + esc(o) + '">' + esc(o) + '</option>'; }).join('');
    }
    if (selJ && window.AppWilayah) {
      selJ.innerHTML = '<option value="">-- Pilih Jalur --</option>' +
        AppWilayah.OPSI_JALUR.map(function (o) { return '<option value="' + esc(o) + '">' + esc(o) + '</option>'; }).join('');
    }
  }

  function resetWilayahForm() {
    var p = document.getElementById('fProvinsi');
    if (p) p.value = '';
    ['fKabupaten', 'fKecamatan', 'fDesa'].forEach(function (id) {
      var s = document.getElementById(id);
      if (!s) return;
      s.innerHTML = '<option value="">-- Pilih --</option>';
      s.disabled = true;
    });
  }

  function resetForm() {
    document.getElementById('formPekebun').reset();
    document.getElementById('fId').value = '';
    document.getElementById('formTitle').textContent = 'Input Data Pekebun';
    document.getElementById('btnBatal').hidden = true;
    formDocId = 0;
    document.getElementById('formDokumenWrap').hidden = true;
    document.getElementById('formDocList').innerHTML = '';
    if (AppAuth.isAdmin()) {
      fillLembagaSelects(document.getElementById('fLembaga'), state.filterLembagaId || '');
    }
    resetWilayahForm();
  }

  function renderDataTable() {
    var rows = filteredData();
    var isLembaga = AppAuth.isLembaga();
    var isAdmin = AppAuth.isAdmin();
    var tb = document.getElementById('tbodyData');
    document.getElementById('countData').textContent = rows.length;
    if (!rows.length) {
      tb.innerHTML = '<tr class="empty-row"><td colspan="9">Tidak ada data yang cocok.</td></tr>';
      return;
    }
    tb.innerHTML = rows.map(function (p, i) {
      var aksi = '';
      if (isLembaga || isAdmin) {
        if (isLembaga && window.AppBerkas && AppBerkas.dapatDiajukan(p) && Number(p.duplikat) !== 1) {
          aksi += '<button class="act-btn submit" data-act="ajukan" data-id="' + p.id + '" title="' + (p.status === 'dikembalikan' ? 'Ajukan Ulang' : 'Ajukan Verifikasi') + '">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4z"/></svg></button>';
        }
        if (!(window.AppBerkas && AppBerkas.terkunci(p))) {
          aksi += '<button class="act-btn edit" data-act="edit" data-id="' + p.id + '" title="Edit">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4z"/></svg></button>' +
            '<button class="act-btn del" data-act="del" data-id="' + p.id + '" title="Hapus">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>';
        }
        aksi += '<button class="act-btn doc" data-act="dokumen" data-id="' + p.id + '" title="Dokumen (PDF)">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg></button>';
      }
      var namaCol = isAdmin ? '<td><strong>' + esc(p.nama) + '</strong><div class="cell-sub">' + esc(p.lembaga_nama || '') + '</div></td>' : '<td><strong>' + esc(p.nama) + '</strong></td>';
      return '<tr>' +
        '<td>' + (i + 1) + '</td>' +
        namaCol +
        '<td>' + esc(p.nik) + '</td>' +
        '<td>' + esc(p.jk) + '</td>' +
        '<td>' + esc(p.alamat) + '</td>' +
        '<td>' + esc(p.hp) + '</td>' +
        '<td>' + (window.AppBerkas ? AppBerkas.badge(p.status) + AppBerkas.badgeDuplikat(p) : '') + '</td>' +
        '<td>' + fmtTglShort(p.tgl_input) + '</td>' +
        '<td><div class="actions">' + aksi + '</div></td>' +
        '</tr>';
    }).join('');
  }

  window.AppPages.data = function () {
    var isLembaga = AppAuth.isLembaga();
    var isAdmin = AppAuth.isAdmin();
    document.getElementById('cardForm').hidden = !(isLembaga || isAdmin);
    document.getElementById('cardUpload').hidden = !(isLembaga || isAdmin);
    document.getElementById('formLembagaWrap').hidden = !isAdmin;
    document.getElementById('filterLembaga').hidden = !isAdmin;

    var tb = document.getElementById('tbodyData');
    tb.innerHTML = '<tr class="empty-row"><td colspan="9">Memuat data...</td></tr>';

    loadLembaga().then(function () {
      if (isAdmin) {
        fillLembagaSelects(document.getElementById('filterLembaga'), state.filterLembagaId || '');
        fillLembagaSelects(document.getElementById('fLembaga'), state.filterLembagaId || '');
      }
      var params = {};
      if (isAdmin && state.filterLembagaId) params.lembaga_id = state.filterLembagaId;
      return Api.get('pekebun.php', 'list', params);
    }).then(function (j) {
      state.rows = j.rows || [];
      renderDataTable();
      if (!isAdmin) resetForm();
      if (isLembaga) resetForm();
    }).catch(function (e) {
      tb.innerHTML = '<tr class="empty-row"><td colspan="9">Gagal memuat data.</td></tr>';
      AppToast(e.message, 'error');
    });
  };

  /* ============ Dokumen Pekebun (PDF) ============ */
  var dokumenId = 0;

  function renderDokumenList() {
    var wrap = document.getElementById('docList');
    var p = AppData.getById(dokumenId) || state.rows.filter(function (x) { return String(x.id) === String(dokumenId); })[0] || null;
    var bolehUbah = (AppAuth.isLembaga() || AppAuth.isAdmin()) && !(window.AppBerkas && AppBerkas.terkunci(p));
    wrap.innerHTML = '<p class="muted">Memuat dokumen...</p>';
    AppDokumen.list(dokumenId).then(function (rows) {
      if (!rows.length) {
        wrap.innerHTML = '<div class="empty-state">Belum ada dokumen. Upload PDF pendukung (mis. surat pernyataan) maks. 5 MB.</div>';
        return;
      }
      wrap.innerHTML = rows.map(function (d) {
        return '<div class="doc-item">' +
          '<div class="doc-ico">PDF</div>' +
          '<div class="doc-info"><strong>' + esc(d.nama_asli) + '</strong>' +
          '<span>' + esc(d.ukuran_label) + ' &bull; ' + fmtTglShort(d.created_at) + '</span></div>' +
          '<div class="doc-actions">' +
          '<a class="btn btn-xs btn-outline" href="' + AppDokumen.url(d.id) + '" target="_blank" rel="noopener">Lihat</a>' +
          (bolehUbah ? '<button class="btn btn-xs btn-danger" data-doc="hapus" data-id="' + d.id + '">Hapus</button>' : '') +
          '</div></div>';
      }).join('');
    }).catch(function (e) {
      wrap.innerHTML = '<div class="empty-state">Gagal memuat dokumen.</div>';
      AppToast(e.message, 'error');
    });
  }

  function openDokumenModal(p) {
    dokumenId = p.id;
    var terkunci = window.AppBerkas && AppBerkas.terkunci(p);
    document.getElementById('dokUploadWrap').hidden = terkunci;
    document.getElementById('dokumenSub').textContent = p.nama + ' (NIK ' + p.nik + ')' + (terkunci ? ' - dokumen terkunci karena berkas sedang diproses' : '');
    document.getElementById('modalDokumen').hidden = false;
    renderDokumenList();
  }

  /* ---- Dokumen di dalam form input pekebun ---- */
  var formDocId = 0;

  function renderFormDocs() {
    var wrap = document.getElementById('formDocList');
    if (!formDocId) {
      wrap.innerHTML = '';
      return;
    }
    wrap.innerHTML = '<p class="muted">Memuat dokumen...</p>';
    AppDokumen.list(formDocId).then(function (rows) {
      if (!rows.length) {
        wrap.innerHTML = '<div class="empty-state" style="padding:16px;">Belum ada dokumen. Unggah PDF pendukung (maks. 5 MB) agar data lengkap.</div>';
        return;
      }
      wrap.innerHTML = rows.map(function (d) {
        return '<div class="doc-item">' +
          '<div class="doc-ico">PDF</div>' +
          '<div class="doc-info"><strong>' + esc(d.nama_asli) + '</strong>' +
          '<span>' + esc(d.ukuran_label) + ' &bull; ' + fmtTglShort(d.created_at) + '</span></div>' +
          '<div class="doc-actions">' +
          '<a class="btn btn-xs btn-outline" href="' + AppDokumen.url(d.id) + '" target="_blank" rel="noopener">Lihat</a>' +
          '<button class="btn btn-xs btn-danger" data-doc="hapus" data-id="' + d.id + '">Hapus</button>' +
          '</div></div>';
      }).join('');
    }).catch(function (e) {
      wrap.innerHTML = '<div class="empty-state" style="padding:16px;">Gagal memuat dokumen.</div>';
      AppToast(e.message, 'error');
    });
  }

  /* ============ Halaman Kelembagaan (admin) ============ */
  var lembagaModalId = 0;

  window.openLembagaModal = function (row) {
    lembagaModalId = row ? row.id : 0;
    document.getElementById('lembagaModalTitle').textContent = row ? 'Edit Kelembagaan' : 'Tambah Kelembagaan';
    document.getElementById('lId').value = row ? row.id : '';
    document.getElementById('lNama').value = row ? row.nama_lembaga : '';
    document.getElementById('lJenis').value = row ? (row.jenis_lembaga || '') : 'KOPERASI UNIT DESA (KUD)';
    document.getElementById('lSingkatan').value = row ? (row.singkatan || '') : '';
    document.getElementById('lKetua').value = row ? (row.ketua || '') : '';
    document.getElementById('lJabatan').value = row ? (row.jabatan || '') : '';
    document.getElementById('lAlamat').value = row ? (row.alamat || '') : '';
    document.getElementById('lTempat').value = row ? (row.tempat || '') : '';
    document.getElementById('lKodeSurat').value = row ? (row.kode_surat || '') : 'KUD-SS/MURA';
    document.getElementById('lTahun').value = row ? (row.tahun_anggaran || '') : String(new Date().getFullYear());
    document.getElementById('lKepalaDesa').value = row ? (row.kepala_desa || '') : '';
    document.getElementById('modalLembaga').hidden = false;
    setTimeout(function () { document.getElementById('lNama').focus(); }, 60);
  };

  function renderLembagaGrid() {
    var grid = document.getElementById('lembagaGrid');
    var rows = AppCache.lembaga || [];
    document.getElementById('countLembaga').textContent = rows.length;
    if (!rows.length) {
      grid.innerHTML = '<div class="empty-state">Belum ada kelembagaan. Klik &quot;Tambah Kelembagaan&quot;.</div>';
      return;
    }
    grid.innerHTML = rows.map(function (l) {
      return '<div class="lembaga-card">' +
        '<div class="lc-head">' +
        '<div class="lc-badge">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21h18"/><path d="M5 21V7l7-4 7 4v14"/><path d="M9 9h1"/><path d="M9 13h1"/><path d="M14 9h1"/><path d="M14 13h1"/><path d="M10 21v-4h4v4"/></svg></div>' +
        '<div class="lc-txt"><strong>' + esc(l.nama_lembaga) + '</strong>' +
        '<span>' + esc(l.jenis_lembaga) + (l.singkatan ? ' &bull; ' + esc(l.singkatan) : '') + (l.ketua ? ' &bull; Ketua : ' + esc(l.ketua) : '') + '</span></div>' +
        '</div>' +
        '<div class="lc-stats">' +
        '<div class="lc-stat"><b>' + l.total_pekebun + '</b><span>Total</span></div>' +
        '<div class="lc-stat amber"><b>' + l.menunggu + '</b><span>Menunggu</span></div>' +
        '<div class="lc-stat green"><b>' + l.disetujui + '</b><span>Disetujui</span></div>' +
        '<div class="lc-stat red"><b>' + l.dikembalikan + '</b><span>Dikembalikan</span></div>' +
        '</div>' +
        '<div class="lc-actions">' +
        '<button class="btn btn-xs btn-outline" data-act="kelola" data-id="' + l.id + '">Data</button>' +
        '<button class="btn btn-xs btn-outline" data-act="surat" data-id="' + l.id + '">Surat</button>' +
        '<button class="btn btn-xs btn-outline" data-act="pengaturan" data-id="' + l.id + '">Pengaturan</button>' +
        '<button class="btn btn-xs btn-ghost" data-act="edit" data-id="' + l.id + '">Edit</button>' +
        '<button class="btn btn-xs btn-danger" data-act="hapus" data-id="' + l.id + '">Hapus</button>' +
        '</div>' +
        '</div>';
    }).join('');
  }

  window.AppPages.lembaga = function () {
    document.getElementById('lembagaGrid').innerHTML = '<div class="empty-state">Memuat data...</div>';
    loadLembaga(true).then(function () {
      renderLembagaGrid();
    }).catch(function (e) {
      AppToast(e.message, 'error');
    });
  };

  /* ============ Halaman Akun Pengguna (admin) ============ */
  var akunState = {
    rows: [],
    searchVal: '',
    filterRole: '',
    filterLembaga: 0
  };

  function roleBadge(role) {
    var m = { admin: 'st-admin', dinas: 'st-dinas', lembaga: 'st-lembaga' };
    var label = { admin: 'Admin', dinas: 'Dinas', lembaga: 'Lembaga' }[role] || role;
    return '<span class="badge-status ' + (m[role] || 'st-draft') + '">' + label + '</span>';
  }

  function renderAkunTable() {
    var rows = akunState.rows;
    var tb = document.getElementById('tbodyAkun');
    document.getElementById('countAkun').textContent = rows.length;
    if (!rows.length) {
      tb.innerHTML = '<tr class="empty-row"><td colspan="7">Tidak ada akun yang cocok.</td></tr>';
      return;
    }
    var selfId = AppAuth.user() ? AppAuth.user().id : 0;
    tb.innerHTML = rows.map(function (u) {
      var isSelf = Number(u.id) === Number(selfId);
      var aksi = '<button class="btn btn-xs btn-outline" data-act="edit" data-id="' + u.id + '">Edit</button>' +
        '<button class="btn btn-xs btn-ghost" data-act="reset" data-id="' + u.id + '">Reset Pass</button>';
      if (!isSelf) {
        aksi += '<button class="btn btn-xs btn-danger" data-act="hapus" data-id="' + u.id + '">Hapus</button>';
      }
      var toggle = Number(u.aktif) === 1
        ? '<button class="switch on" data-act="toggle" data-id="' + u.id + '" title="Nonaktifkan"><span></span></button>'
        : '<button class="switch" data-act="toggle" data-id="' + u.id + '" title="Aktifkan"><span></span></button>';
      var status = Number(u.aktif) === 1
        ? '<span class="tag-aktif">Aktif</span>'
        : '<span class="tag-pending">' + (u.role === 'lembaga' ? 'Menunggu' : 'Nonaktif') + '</span>';
      return '<tr>' +
        '<td><strong>' + esc(u.username) + '</strong>' + (isSelf ? '<div class="cell-sub">Anda</div>' : '') + '</td>' +
        '<td>' + esc(u.nama) + '</td>' +
        '<td>' + roleBadge(u.role) + '</td>' +
        '<td>' + esc(u.lembaga_nama || '-') + '</td>' +
        '<td>' + status + ' ' + toggle + '</td>' +
        '<td>' + fmtTglShort(u.created_at) + '</td>' +
        '<td><div class="actions">' + aksi + '</div></td>' +
        '</tr>';
    }).join('');
  }

  function loadAkunRows() {
    var params = { search: akunState.searchVal, role: akunState.filterRole };
    if (akunState.filterLembaga) params.lembaga_id = akunState.filterLembaga;
    return Api.get('users.php', 'list', params).then(function (j) {
      akunState.rows = j.rows || [];
      renderAkunTable();
    });
  }

  function fillAkunLembagaSelects(selectedId) {
    ['aLembaga', 'filterAkunLembaga'].forEach(function (id) {
      var sel = document.getElementById(id);
      var opts = '<option value="">' + (id === 'filterAkunLembaga' ? 'Semua Kelembagaan' : '-- Pilih Kelembagaan --') + '</option>';
      (AppCache.lembaga || []).forEach(function (l) {
        opts += '<option value="' + l.id + '"' + (String(l.id) === String(selectedId || '') ? ' selected' : '') + '>' + esc(l.nama_lembaga) + '</option>';
      });
      sel.innerHTML = opts;
    });
  }

  var akunModalEditId = 0;

  function openAkunModal(row) {
    akunModalEditId = row ? row.id : 0;
    document.getElementById('akunModalTitle').textContent = row ? 'Edit Akun' : 'Tambah Akun';
    document.getElementById('aId').value = row ? row.id : '';
    document.getElementById('aUsername').value = row ? row.username : '';
    document.getElementById('aNama').value = row ? row.nama : '';
    document.getElementById('aRole').value = row ? row.role : '';
    document.getElementById('aLembaga').value = row && row.lembaga_id ? String(row.lembaga_id) : '';
    document.getElementById('aAktif').checked = row ? Number(row.aktif) === 1 : true;
    document.getElementById('aPassWrap').hidden = !!row;
    document.getElementById('aPassword').value = '';
    document.getElementById('aLembagaReq').textContent = '';
    document.getElementById('modalAkun').hidden = false;
    setTimeout(function () { document.getElementById('aUsername').focus(); }, 60);
  }

  window.AppPages.akun = function () {
    var tb = document.getElementById('tbodyAkun');
    tb.innerHTML = '<tr class="empty-row"><td colspan="7">Memuat data...</td></tr>';
    loadLembaga().then(function () {
      fillAkunLembagaSelects();
      return loadAkunRows();
    }).catch(function (e) {
      tb.innerHTML = '<tr class="empty-row"><td colspan="7">Gagal memuat data.</td></tr>';
      AppToast(e.message, 'error');
    });
  };

  /* ============ Validasi ============ */
  function validHp(hp) {
    var digits = (hp || '').replace(/\D/g, '');
    return digits.length >= 10 && digits.length <= 15;
  }

  /* ============ Inisialisasi ============ */
  function initApp() {
    var role = AppAuth.role();
    if (!role) {
      window.location.href = 'index.html';
      return;
    }

    buildNav();
    renderTopbar();

    var d = new Date();
    var hari = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'][d.getDay()];
    document.getElementById('topbarDate').textContent = hari + ', ' + fmtTanggal(d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2));

    document.getElementById('btnMenu').addEventListener('click', function () {
      document.body.classList.add('nav-open');
    });
    document.getElementById('sidebarOverlay').addEventListener('click', function () {
      document.body.classList.remove('nav-open');
    });

    var links = document.querySelectorAll('[data-go]');
    for (var l = 0; l < links.length; l++) {
      links[l].addEventListener('click', function (e) {
        e.preventDefault();
        AppGo(this.getAttribute('data-go'));
      });
    }

    /* ---- Data pekebun ---- */
    var searchInput = document.getElementById('searchData');
    var filterInput = document.getElementById('filterJk');
    var filterLembagaInput = document.getElementById('filterLembaga');
    if (window.AppWilayah) {
      AppWilayah.init('f');
      AppWilayah.bindRegionSelects('f', {});
      fillOpsiKeikutsertaan('fJenisPelatihan', 'fJalur');
    }
    searchInput.addEventListener('input', function () {
      state.searchVal = searchInput.value;
      renderDataTable();
    });
    filterInput.addEventListener('change', function () {
      state.filterJk = filterInput.value;
      renderDataTable();
    });
    filterLembagaInput.addEventListener('change', function () {
      state.filterLembagaId = Number(filterLembagaInput.value) || 0;
      AppPages.data();
    });

    document.getElementById('formPekebun').addEventListener('submit', function (e) {
      e.preventDefault();
      var nama = document.getElementById('fNama').value.trim();
      var nik = document.getElementById('fNik').value.trim();
      var jk = document.getElementById('fJk').value;
      var noKk = document.getElementById('fNoKk').value.trim();
      var tempatLahir = document.getElementById('fTempatLahir').value.trim();
      var tanggalLahir = document.getElementById('fTanggalLahir').value;
      var jenisPelatihan = document.getElementById('fJenisPelatihan').value;
      var jalur = document.getElementById('fJalur').value;
      var wilayah = window.AppWilayah ? AppWilayah.readValues('f') : { desa: '' };
      var desa = wilayah.desa || '';
      var alamat = (window.AppWilayah && AppWilayah.composeAlamat('f')) || '';
      var kepalaDesa = document.getElementById('fKepalaDesa').value.trim();
      var hp = document.getElementById('fHp').value.trim();
      var luasLahan = document.getElementById('fLuasLahan').value.trim();
      var noShm = document.getElementById('fNoShm').value.trim();
      var pemilikSebelumnya = document.getElementById('fPemilikSebelumnya').value.trim();
      var agama = document.getElementById('fAgama').value.trim();
      var pekerjaan = document.getElementById('fPekerjaan').value.trim();
      var jalanRtRw = document.getElementById('fJalanRtRw').value.trim();
      var nib = document.getElementById('fNib').value.trim();
      var statusTanah = document.getElementById('fStatusTanah').value.trim();
      var dipergunakan = document.getElementById('fDipergunakan').value.trim();
      var batasUtara = document.getElementById('fBatasUtara').value.trim();
      var batasTimur = document.getElementById('fBatasTimur').value.trim();
      var batasSelatan = document.getElementById('fBatasSelatan').value.trim();
      var batasBarat = document.getElementById('fBatasBarat').value.trim();
      var tahunKuasai = document.getElementById('fTahunKuasai').value.trim();
      var perolehanDari = document.getElementById('fPerolehanDari').value.trim();
      var perolehanSejak = document.getElementById('fPerolehanSejak').value.trim();
      var saksi1Nama = document.getElementById('fSaksi1Nama').value.trim();
      var saksi1Umur = document.getElementById('fSaksi1Umur').value.trim();
      var saksi1Pekerjaan = document.getElementById('fSaksi1Pekerjaan').value.trim();
      var saksi1Alamat = document.getElementById('fSaksi1Alamat').value.trim();
      var saksi2Nama = document.getElementById('fSaksi2Nama').value.trim();
      var saksi2Umur = document.getElementById('fSaksi2Umur').value.trim();
      var saksi2Pekerjaan = document.getElementById('fSaksi2Pekerjaan').value.trim();
      var saksi2Alamat = document.getElementById('fSaksi2Alamat').value.trim();
      var id = document.getElementById('fId').value;

      if (!nama) { AppToast('Nama wajib diisi.', 'error'); return; }
      if (!/^\d{16}$/.test(nik)) { AppToast('NIK harus 16 digit angka.', 'error'); return; }
      if (!jk) { AppToast('Pilih jenis kelamin.', 'error'); return; }
      if (!jenisPelatihan) { AppToast('Pilih jenis pelatihan.', 'error'); return; }
      if (!jalur) { AppToast('Pilih jalur.', 'error'); return; }
      if (!desa) { AppToast('Pilih desa/kelurahan wilayah pekebun.', 'error'); return; }
      if (!validHp(hp)) { AppToast('Nomor handphone tidak valid (minimal 10 digit).', 'error'); return; }

      var data = {
        id: id,
        nama: nama, nik: nik, no_kk: noKk, jk: jk,
        tempat_lahir: tempatLahir, tanggal_lahir: tanggalLahir || '',
        jenis_pelatihan: jenisPelatihan, jalur: jalur,
        alamat: alamat, desa: desa,
        provinsi: wilayah.provinsi || '', kabupaten: wilayah.kabupaten || '', kecamatan: wilayah.kecamatan || '',
        kepala_desa: kepalaDesa, hp: hp,
        luas_lahan: luasLahan,
        no_shm: noShm, pemilik_sebelumnya: pemilikSebelumnya,
        agama: agama, pekerjaan: pekerjaan, jalan_rt_rw: jalanRtRw, nib: nib,
        status_tanah: statusTanah, dipergunakan: dipergunakan,
        batas_utara: batasUtara, batas_timur: batasTimur, batas_selatan: batasSelatan, batas_barat: batasBarat,
        tahun_kuasai: tahunKuasai, perolehan_dari: perolehanDari, perolehan_sejak: perolehanSejak,
        saksi1_nama: saksi1Nama, saksi1_umur: saksi1Umur, saksi1_pekerjaan: saksi1Pekerjaan, saksi1_alamat: saksi1Alamat,
        saksi2_nama: saksi2Nama, saksi2_umur: saksi2Umur, saksi2_pekerjaan: saksi2Pekerjaan, saksi2_alamat: saksi2Alamat
      };
      if (AppAuth.isAdmin()) {
        var lembagaId = Number(document.getElementById('fLembaga').value) || 0;
        if (!id && !lembagaId) { AppToast('Pilih kelembagaan pemilik data.', 'error'); return; }
        data.lembaga_id = lembagaId;
      }

      Api.post('pekebun.php', 'save', data).then(function (j) {
        if (id) {
          AppToast('Data pekebun berhasil diperbarui.');
          AppData.load(true).then(function () {
            AppPages.data();
          });
          return;
        }
        AppToast('Data pekebun berhasil disimpan. Silakan unggah dokumen pendukung (PDF, maks. 5 MB).');
        document.getElementById('fId').value = String(j.id);
        formDocId = Number(j.id) || 0;
        document.getElementById('formDokumenWrap').hidden = false;
        renderFormDocs();
        AppData.load(true).then(function (rows) {
          state.rows = rows;
          renderDataTable();
        });
      }).catch(function (err) {
        AppToast(err.message, 'error');
      });
    });

    document.getElementById('btnBatal').addEventListener('click', resetForm);

    document.getElementById('tbodyData').addEventListener('click', function (e) {
      var btn = e.target.closest('.act-btn');
      if (!btn) return;
      var id = btn.getAttribute('data-id');
      var act = btn.getAttribute('data-act');
      if (act === 'ajukan') {
        var pa = state.rows.filter(function (x) { return String(x.id) === id; })[0];
        if (!pa) return;
        if (!window.AppBerkas) return;
        if (AppBerkas.dapatDiajukan(pa) && Number(pa.duplikat) !== 1) {
          AppDokumen.list(pa.id).then(function (docs) {
            if (!docs.length) {
              AppToast('Upload dokumen (PDF, maks. 5 MB) pekebun terlebih dahulu sebelum mengajukan.', 'warn');
              return;
            }
            return Api.post('berkas.php', 'ajukan', { id: pa.id }).then(function () {
              AppToast('Berkas berhasil diajukan untuk verifikasi.');
              AppPages.data();
              if (AppPages.dashboard) AppPages.dashboard();
            });
          }).catch(function (err) { AppToast(err.message, 'error'); });
        } else {
          AppToast('Berkas tidak dapat diajukan pada status ini.', 'warn');
        }
        return;
      }
      if (act === 'dokumen') {
        var pd = state.rows.filter(function (x) { return String(x.id) === id; })[0];
        if (!pd) return;
        openDokumenModal(pd);
        return;
      }
      if (act === 'del') {
        var p = state.rows.filter(function (x) { return String(x.id) === id; })[0];
        if (!p) return;
        AppConfirm('Yakin ingin menghapus data "' + p.nama + '"?', function () {
          Api.post('pekebun.php', 'delete', { id: p.id }).then(function () {
            AppToast('Data pekebun dihapus.');
            AppData.load(true).then(function () {
              AppPages.data();
            });
          }).catch(function (err) { AppToast(err.message, 'error'); });
        });
      } else if (act === 'edit') {
        var p2 = state.rows.filter(function (x) { return String(x.id) === id; })[0];
        if (!p2) return;        if (window.AppBerkas && AppBerkas.terkunci(p2)) {
          AppToast('Berkas sedang diproses (menunggu verifikasi / disetujui) dan tidak dapat diubah.', 'error');
          return;
        }
        document.getElementById('fId').value = p2.id;
        document.getElementById('fNama').value = p2.nama;
        document.getElementById('fNik').value = p2.nik;
        document.getElementById('fJk').value = p2.jk;
        document.getElementById('fNoKk').value = p2.no_kk || '';
        document.getElementById('fTempatLahir').value = p2.tempat_lahir || '';
        document.getElementById('fTanggalLahir').value = p2.tanggal_lahir || '';
        document.getElementById('fJenisPelatihan').value = p2.jenis_pelatihan || '';
        document.getElementById('fJalur').value = p2.jalur || '';
        document.getElementById('fKepalaDesa').value = p2.kepala_desa || '';
        document.getElementById('fHp').value = p2.hp;
        document.getElementById('fLuasLahan').value = p2.luas_lahan ? String(p2.luas_lahan) : '';
        document.getElementById('fNoShm').value = p2.no_shm || '';
        document.getElementById('fPemilikSebelumnya').value = p2.pemilik_sebelumnya || '';
        document.getElementById('fAgama').value = setSelOpt(document.getElementById('fAgama'), p2.agama);
        document.getElementById('fPekerjaan').value = setSelOpt(document.getElementById('fPekerjaan'), p2.pekerjaan);
        document.getElementById('fJalanRtRw').value = p2.jalan_rt_rw || '';
        document.getElementById('fNib').value = p2.nib || '';
        document.getElementById('fStatusTanah').value = p2.status_tanah || '';
        document.getElementById('fDipergunakan').value = setSelOpt(document.getElementById('fDipergunakan'), p2.dipergunakan);
        document.getElementById('fBatasUtara').value = p2.batas_utara || '';
        document.getElementById('fBatasTimur').value = p2.batas_timur || '';
        document.getElementById('fBatasSelatan').value = p2.batas_selatan || '';
        document.getElementById('fBatasBarat').value = p2.batas_barat || '';
        document.getElementById('fTahunKuasai').value = p2.tahun_kuasai || '';
        document.getElementById('fPerolehanDari').value = p2.perolehan_dari || '';
        document.getElementById('fPerolehanSejak').value = p2.perolehan_sejak || '';
        document.getElementById('fSaksi1Nama').value = p2.saksi1_nama || '';
        document.getElementById('fSaksi1Umur').value = p2.saksi1_umur || '';
        document.getElementById('fSaksi1Pekerjaan').value = setSelOpt(document.getElementById('fSaksi1Pekerjaan'), p2.saksi1_pekerjaan);
        document.getElementById('fSaksi1Alamat').value = p2.saksi1_alamat || '';
        document.getElementById('fSaksi2Nama').value = p2.saksi2_nama || '';
        document.getElementById('fSaksi2Umur').value = p2.saksi2_umur || '';
        document.getElementById('fSaksi2Pekerjaan').value = setSelOpt(document.getElementById('fSaksi2Pekerjaan'), p2.saksi2_pekerjaan);
        document.getElementById('fSaksi2Alamat').value = p2.saksi2_alamat || '';
        if (window.AppWilayah) {
          AppWilayah.setValues('f', {
            provinsi: p2.provinsi || '', kabupaten: p2.kabupaten || '',
            kecamatan: p2.kecamatan || '', desa: p2.desa || ''
          }, function () {});
        }
        if (AppAuth.isAdmin()) {
          fillLembagaSelects(document.getElementById('fLembaga'), p2.lembaga_id);
        }
        document.getElementById('formTitle').textContent = 'Edit Data Pekebun';
        document.getElementById('btnBatal').hidden = false;
        formDocId = Number(p2.id) || 0;
        document.getElementById('formDokumenWrap').hidden = false;
        renderFormDocs();
        window.scrollTo(0, 0);
        document.getElementById('fNama').focus();
      }
    });

    /* ---- Upload Excel ---- */
    var dz = document.getElementById('dropzone');
    var fileExcel = document.getElementById('fileExcel');
    document.getElementById('btnPilihFile').addEventListener('click', function () {
      fileExcel.click();
    });
    fileExcel.addEventListener('change', function () {
      if (fileExcel.files.length) {
        AppExcel.importFile(fileExcel.files[0]);
        fileExcel.value = '';
      }
    });
    ['dragenter', 'dragover'].forEach(function (ev) {
      dz.addEventListener(ev, function (e) { e.preventDefault(); dz.classList.add('drag'); });
    });
    ['dragleave', 'drop'].forEach(function (ev) {
      dz.addEventListener(ev, function (e) { e.preventDefault(); dz.classList.remove('drag'); });
    });
    dz.addEventListener('drop', function (e) {
      var f = e.dataTransfer.files && e.dataTransfer.files[0];
      if (f) AppExcel.importFile(f);
    });

    document.getElementById('btnTemplate').addEventListener('click', function () {
      AppExcel.template();
    });
    document.getElementById('btnCetakData').addEventListener('click', function () {
      AppExcel.cetakData();
    });
    document.getElementById('btnPdfData').addEventListener('click', function () {
      AppExcel.pdfData();
    });
    document.getElementById('btnExcelData').addEventListener('click', function () {
      AppExcel.excelData();
    });

    /* ---- Dokumen pekebun (PDF) ---- */
    var md = document.getElementById('modalDokumen');
    var docDrop = document.getElementById('docDropzone');
    var fileDokumen = document.getElementById('fileDokumen');

    function uploadDokumen(file) {
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
      AppDokumen.upload(file, dokumenId).then(function () {
        AppToast('Dokumen berhasil diunggah.');
        renderDokumenList();
      }).catch(function (err) { AppToast(err.message, 'error'); });
    }

    document.getElementById('btnPilihDokumen').addEventListener('click', function () {
      fileDokumen.click();
    });
    fileDokumen.addEventListener('change', function () {
      if (fileDokumen.files.length) uploadDokumen(fileDokumen.files[0]);
      fileDokumen.value = '';
    });
    ['dragenter', 'dragover'].forEach(function (ev) {
      docDrop.addEventListener(ev, function (e) { e.preventDefault(); docDrop.classList.add('drag'); });
    });
    ['dragleave', 'drop'].forEach(function (ev) {
      docDrop.addEventListener(ev, function (e) { e.preventDefault(); docDrop.classList.remove('drag'); });
    });
    docDrop.addEventListener('drop', function (e) {
      var f = e.dataTransfer.files && e.dataTransfer.files[0];
      if (f) uploadDokumen(f);
    });
    document.getElementById('btnTutupDokumen').addEventListener('click', function () { md.hidden = true; });
    md.addEventListener('click', function (e) { if (e.target === md) md.hidden = true; });
    document.getElementById('docList').addEventListener('click', function (e) {
      var btn = e.target.closest('[data-doc="hapus"]');
      if (!btn) return;
      AppConfirm('Yakin ingin menghapus dokumen ini?', function () {
        AppDokumen.hapus(btn.getAttribute('data-id'), dokumenId).then(function () {
          AppToast('Dokumen dihapus.');
          renderDokumenList();
        }).catch(function (err) { AppToast(err.message, 'error'); });
      });
    });

    /* ---- Dokumen di form input pekebun ---- */
    var formDrop = document.getElementById('formDocDropzone');
    var formFileDokumen = document.getElementById('formFileDokumen');

    function uploadFormDoc(file) {
      if (!formDocId) {
        AppToast('Simpan data pekebun terlebih dahulu.', 'warn');
        return;
      }
      if (!file || file.type !== 'application/pdf') {
        AppToast('Hanya file PDF yang diperbolehkan.', 'error');
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        AppToast('Ukuran file maksimal 5 MB.', 'error');
        return;
      }
      AppDokumen.upload(file, formDocId).then(function () {
        AppToast('Dokumen berhasil diunggah dan tersinkron ke admin kabupaten.');
        renderFormDocs();
      }).catch(function (err) { AppToast(err.message, 'error'); });
    }

    document.getElementById('btnPilihFormDokumen').addEventListener('click', function () {
      formFileDokumen.click();
    });
    formFileDokumen.addEventListener('change', function () {
      if (formFileDokumen.files.length) uploadFormDoc(formFileDokumen.files[0]);
      formFileDokumen.value = '';
    });
    ['dragenter', 'dragover'].forEach(function (ev) {
      formDrop.addEventListener(ev, function (e) { e.preventDefault(); formDrop.classList.add('drag'); });
    });
    ['dragleave', 'drop'].forEach(function (ev) {
      formDrop.addEventListener(ev, function (e) { e.preventDefault(); formDrop.classList.remove('drag'); });
    });
    formDrop.addEventListener('drop', function (e) {
      var f = e.dataTransfer.files && e.dataTransfer.files[0];
      if (f) uploadFormDoc(f);
    });
    document.getElementById('formDocList').addEventListener('click', function (e) {
      var btn = e.target.closest('[data-doc="hapus"]');
      if (!btn) return;
      AppConfirm('Yakin ingin menghapus dokumen ini?', function () {
        AppDokumen.hapus(btn.getAttribute('data-id'), formDocId).then(function () {
          AppToast('Dokumen dihapus.');
          renderFormDocs();
        }).catch(function (err) { AppToast(err.message, 'error'); });
      });
    });

    /* ---- Kelembagaan (admin) ---- */
    var btnTambahLembaga = document.getElementById('btnTambahLembaga');
    if (btnTambahLembaga) {
      btnTambahLembaga.addEventListener('click', function () { openLembagaModal(null); });
      document.getElementById('formLembaga').addEventListener('submit', function (e) {
        e.preventDefault();
        var nama = document.getElementById('lNama').value.trim();
        if (!nama) { AppToast('Nama kelembagaan wajib diisi.', 'error'); return; }
        var data = {
          id: document.getElementById('lId').value,
          nama_lembaga: nama,
          jenis_lembaga: document.getElementById('lJenis').value.trim(),
          singkatan: document.getElementById('lSingkatan').value.trim(),
          ketua: document.getElementById('lKetua').value.trim(),
          jabatan: document.getElementById('lJabatan').value.trim(),
          alamat: document.getElementById('lAlamat').value.trim(),
          tempat: document.getElementById('lTempat').value.trim(),
          kode_surat: document.getElementById('lKodeSurat').value.trim(),
          tahun_anggaran: document.getElementById('lTahun').value.trim(),
          kepala_desa: document.getElementById('lKepalaDesa').value.trim()
        };
        Api.post('lembaga.php', 'save', data).then(function (j) {
          document.getElementById('modalLembaga').hidden = true;
          AppToast('Kelembagaan berhasil disimpan.');
          AppCache.lembaga = null;
          if (window.AppPengaturan) AppPengaturan.refresh(Number(j && j.id) || 0);
          AppPages.lembaga();
        }).catch(function (err) { AppToast(err.message, 'error'); });
      });
      document.getElementById('lembagaGrid').addEventListener('click', function (e) {
        var btn = e.target.closest('[data-act]');
        if (!btn) return;
        var id = btn.getAttribute('data-id');
        var act = btn.getAttribute('data-act');
        var row = (AppCache.lembaga || []).filter(function (x) { return String(x.id) === id; })[0];
        if (!row) return;
        if (act === 'kelola') {
          state.filterLembagaId = Number(id);
          AppGo('data');
        } else if (act === 'surat') {
          AppGo('surat', { lembaga_id: Number(id) });
        } else if (act === 'pengaturan') {
          AppGo('pengaturan', { lembaga_id: Number(id) });
        } else if (act === 'edit') {
          openLembagaModal(row);
        } else if (act === 'hapus') {
          AppConfirm('Yakin ingin menghapus kelembagaan "' + row.nama_lembaga + '"?', function () {
            Api.post('lembaga.php', 'delete', { id: row.id }).then(function () {
              AppToast('Kelembagaan dihapus.');
              AppPages.lembaga();
            }).catch(function (err) { AppToast(err.message, 'error'); });
          });
        }
      });

      var ml = document.getElementById('modalLembaga');
      var closeLembaga = function () { ml.hidden = true; };
      document.getElementById('btnTutupLembaga').addEventListener('click', closeLembaga);
      document.getElementById('btnBatalLembaga').addEventListener('click', closeLembaga);
      ml.addEventListener('click', function (e) { if (e.target === ml) closeLembaga(); });
    }

    /* ---- Akun pengguna (admin) ---- */
    var btnTambahAkun = document.getElementById('btnTambahAkun');
    if (btnTambahAkun) {
      document.getElementById('searchAkun').addEventListener('input', function () {
        akunState.searchVal = this.value;
        clearTimeout(loadAkunRows._t);
        loadAkunRows._t = setTimeout(loadAkunRows, 250);
      });
      document.getElementById('filterAkunRole').addEventListener('change', function () {
        akunState.filterRole = this.value;
        loadAkunRows();
      });
      document.getElementById('filterAkunLembaga').addEventListener('change', function () {
        akunState.filterLembaga = Number(this.value) || 0;
        loadAkunRows();
      });
      btnTambahAkun.addEventListener('click', function () { openAkunModal(null); });

      document.getElementById('aRole').addEventListener('change', function () {
        var isLembaga = this.value === 'lembaga';
        document.getElementById('aLembaga').required = isLembaga;
        document.getElementById('aLembagaReq').textContent = isLembaga ? '*' : '';
      });

      document.getElementById('formAkun').addEventListener('submit', function (e) {
        e.preventDefault();
        var id = document.getElementById('aId').value;
        var username = document.getElementById('aUsername').value.trim();
        var nama = document.getElementById('aNama').value.trim();
        var role = document.getElementById('aRole').value;
        var lembagaId = Number(document.getElementById('aLembaga').value) || 0;
        var password = document.getElementById('aPassword').value;

        if (!username) { AppToast('Username wajib diisi.', 'error'); return; }
        if (!nama) { AppToast('Nama lengkap wajib diisi.', 'error'); return; }
        if (!role) { AppToast('Pilih role akun.', 'error'); return; }
        if (role === 'lembaga' && !lembagaId) { AppToast('Pilih kelembagaan untuk akun lembaga.', 'error'); return; }
        if (!id && password.length < 6) { AppToast('Password minimal 6 karakter.', 'error'); return; }

        var data = {
          id: id, username: username, nama: nama, role: role,
          lembaga_id: lembagaId, aktif: document.getElementById('aAktif').checked ? 1 : 0,
          password: password
        };
        Api.post('users.php', id ? 'update' : 'create', data).then(function () {
          document.getElementById('modalAkun').hidden = true;
          AppToast('Akun berhasil disimpan.');
          loadAkunRows();
        }).catch(function (err) { AppToast(err.message, 'error'); });
      });

      var ma = document.getElementById('modalAkun');
      var closeAkun = function () { ma.hidden = true; };
      document.getElementById('btnTutupAkun').addEventListener('click', closeAkun);
      document.getElementById('btnBatalAkun').addEventListener('click', closeAkun);
      ma.addEventListener('click', function (e) { if (e.target === ma) closeAkun(); });

      document.getElementById('tbodyAkun').addEventListener('click', function (e) {
        var btn = e.target.closest('[data-act]');
        if (!btn) return;
        var id = btn.getAttribute('data-id');
        var act = btn.getAttribute('data-act');
        var row = akunState.rows.filter(function (x) { return String(x.id) === id; })[0];
        if (!row) return;
        if (act === 'edit') {
          openAkunModal(row);
        } else if (act === 'reset') {
          document.getElementById('resetPassInfo').textContent = 'Set password baru untuk akun "' + row.username + '".';
          document.getElementById('rpPassword').value = '';
          document.getElementById('modalResetPass').dataset.id = id;
          document.getElementById('modalResetPass').hidden = false;
          setTimeout(function () { document.getElementById('rpPassword').focus(); }, 60);
        } else if (act === 'toggle') {
          Api.post('users.php', 'toggle', { id: row.id }).then(function () {
            loadAkunRows();
          }).catch(function (err) { AppToast(err.message, 'error'); });
        } else if (act === 'hapus') {
          AppConfirm('Yakin ingin menghapus akun "' + row.username + '"? Tindakan ini tidak dapat dibatalkan.', function () {
            Api.post('users.php', 'delete', { id: row.id }).then(function () {
              AppToast('Akun dihapus.');
              loadAkunRows();
            }).catch(function (err) { AppToast(err.message, 'error'); });
          }, { title: 'Hapus Akun', yesLabel: 'Ya, Hapus Akun' });
        }
      });

      var mr = document.getElementById('modalResetPass');
      var closeReset = function () { mr.hidden = true; };
      document.getElementById('btnTutupResetPass').addEventListener('click', closeReset);
      document.getElementById('btnBatalResetPass').addEventListener('click', closeReset);
      mr.addEventListener('click', function (e) { if (e.target === mr) closeReset(); });
      document.getElementById('btnSimpanResetPass').addEventListener('click', function () {
        var pass = document.getElementById('rpPassword').value;
        if (pass.length < 6) { AppToast('Password minimal 6 karakter.', 'error'); return; }
        Api.post('users.php', 'reset_password', { id: mr.dataset.id, password: pass }).then(function () {
          mr.hidden = true;
          AppToast('Password akun berhasil direset.');
        }).catch(function (err) { AppToast(err.message, 'error'); });
      });
    }

    AppGo('dashboard');
  }

  document.addEventListener('DOMContentLoaded', function () {
    AppAuth.ensure().then(function () {
      initApp();
    }).catch(function () {});
  });
})();
