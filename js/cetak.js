(function () {
  var searchVal = '';
  var jenisFilter = '';
  var lembagaFilter = '';

  function isAdmin() {
    return window.AppAuth && AppAuth.isAdmin();
  }

  function renderCetak() {
    var tb = document.getElementById('tbodyArsip');
    var rows = AppLetter.get();
    document.getElementById('countArsip').textContent = rows.length;
    var head = document.querySelector('#page-cetak thead tr');
    if (head) {
      head.innerHTML = isAdmin()
        ? '<th>No</th><th>Nomor Surat</th><th>Jenis Surat</th><th>Nama Pekebun</th><th>Kelembagaan</th><th>Tanggal Surat</th><th>Dibuat Pada</th><th>Aksi</th>'
        : '<th>No</th><th>Nomor Surat</th><th>Jenis Surat</th><th>Nama Pekebun</th><th>Tanggal Surat</th><th>Dibuat Pada</th><th>Aksi</th>';
    }
    var colspan = isAdmin() ? 8 : 7;
    if (!rows.length) {
      tb.innerHTML = '<tr class="empty-row"><td colspan="' + colspan + '">Belum ada surat di arsip. Buat surat pada menu Surat-Surat lalu simpan.</td></tr>';
      return;
    }
    tb.innerHTML = rows.map(function (r, i) {
      return '<tr>' +
        '<td>' + (i + 1) + '</td>' +
        '<td><strong>' + (r.no_surat ? esc(r.no_surat) : '&mdash;') + '</strong></td>' +
        '<td>' + esc(r.jenis_label) + '</td>' +
        '<td>' + esc(r.nama) + '</td>' +
        (isAdmin() ? '<td>' + esc(r.lembaga_nama || '&mdash;') + '</td>' : '') +
        '<td>' + esc(r.tanggal_label) + '</td>' +
        '<td>' + fmtTglShort(r.created_at) + '</td>' +
        '<td><div class="actions">' +
        '<button class="act-btn print" data-act="cetak" data-id="' + r.id + '" title="Cetak">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg></button>' +
        '<button class="act-btn pdf" data-act="pdf" data-id="' + r.id + '" title="Unduh PDF">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg></button>' +
        '<button class="act-btn del" data-act="hapus" data-id="' + r.id + '" title="Hapus">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>' +
        '</div></td>' +
        '</tr>';
    }).join('');
  }

  function loadRows() {
    var tb = document.getElementById('tbodyArsip');
    tb.innerHTML = '<tr class="empty-row"><td colspan="' + (isAdmin() ? 8 : 7) + '">Memuat data...</td></tr>';
    var params = {};
    if (searchVal) params.search = searchVal;
    if (jenisFilter) params.jenis = jenisFilter;
    if (isAdmin() && lembagaFilter) params.lembaga_id = lembagaFilter;
    AppLetter.load(true, params).then(function () {
      renderCetak();
    }).catch(function (e) {
      tb.innerHTML = '<tr class="empty-row"><td colspan="' + (isAdmin() ? 8 : 7) + '">Gagal memuat data.</td></tr>';
      AppToast(e.message, 'error');
    });
  }

  function fillLembagaFilter() {
    var sel = document.getElementById('filterLembagaArsip');
    if (!sel) return;
    sel.hidden = !isAdmin();
    if (!isAdmin()) return;
    if (AppCache.lembaga) {
      sel.innerHTML = '<option value="">Semua Kelembagaan</option>' +
        AppCache.lembaga.map(function (l) {
          return '<option value="' + l.id + '"' + (String(l.id) === String(lembagaFilter) ? ' selected' : '') + '>' + esc(l.nama_lembaga) + '</option>';
        }).join('');
      return;
    }
    loadLembaga().then(function (rows) {
      sel.innerHTML = '<option value="">Semua Kelembagaan</option>' +
        rows.map(function (l) {
          return '<option value="' + l.id + '">' + esc(l.nama_lembaga) + '</option>';
        }).join('');
    }).catch(function () {});
  }

  window.AppPages = window.AppPages || {};
  window.AppPages.cetak = function () {
    fillLembagaFilter();
    loadRows();
  };

  document.addEventListener('DOMContentLoaded', function () {
    document.getElementById('searchArsip').addEventListener('input', function () {
      searchVal = this.value;
      clearTimeout(loadRows._t);
      loadRows._t = setTimeout(loadRows, 250);
    });
    document.getElementById('filterJenis').addEventListener('change', function () {
      jenisFilter = this.value;
      loadRows();
    });
    document.getElementById('filterLembagaArsip').addEventListener('change', function () {
      lembagaFilter = this.value;
      loadRows();
    });

    document.getElementById('tbodyArsip').addEventListener('click', function (e) {
      var btn = e.target.closest('.act-btn');
      if (!btn) return;
      var id = btn.getAttribute('data-id');
      var act = btn.getAttribute('data-act');
      var rec = AppLetter.get().filter(function (x) { return String(x.id) === String(id); })[0];
      if (!rec) return;

      if (act === 'cetak' || act === 'pdf') {
        var need = (rec.html !== undefined && rec.html !== null) ? Promise.resolve(rec) : Api.get('surat.php', 'detail', { id: id }).then(function (j) { return j.row || {}; });
        need.then(function (full) {
          if (!full.html) { AppToast('Surat tidak ditemukan.', 'error'); return; }
          if (act === 'cetak') {
            AppPrint.printHtml(full.html);
          } else {
            var name = String(full.no_surat || (full.jenis_label + ' - ' + full.nama)).replace(/[^\w\-]+/g, '_') + '.pdf';
            AppPrint.pdfFromHtml(full.html, name);
          }
        }).catch(function (err) { AppToast(err.message, 'error'); });
      } else if (act === 'hapus') {
        AppConfirm('Yakin ingin menghapus surat "' + (rec.no_surat || rec.jenis_label) + '"?', function () {
          AppLetter.remove(id).then(function () {
            renderCetak();
            AppToast('Surat dihapus dari arsip.');
          }).catch(function (err) { AppToast(err.message, 'error'); });
        });
      }
    });
  });
})();
