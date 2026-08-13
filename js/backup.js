/* ============================================================
   SDMPKS - Backup & Restore (Admin: database penuh, Lembaga: data sendiri)
   ============================================================ */
(function () {
  function el(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function fmtSize(n) {
    n = Number(n) || 0;
    if (n < 1024) return n + ' B';
    if (n < 1048576) return (n / 1024).toFixed(1) + ' KB';
    if (n < 1073741824) return (n / 1048576).toFixed(2) + ' MB';
    return (n / 1073741824).toFixed(2) + ' GB';
  }
  function btnLoading(btn, on) {
    if (!btn) return;
    btn.disabled = on;
    btn.dataset.txt = btn.dataset.txt || btn.textContent;
    btn.textContent = on ? 'Memproses...' : btn.dataset.txt;
  }

  var pickFile = null;
  var pickLeFile = null;

  function refreshAdmin() {
    Api.get('backup.php', 'list').then(function (j) {
      var rows = j.rows || [];
      el('bkCount').textContent = rows.length + ' file';
      var tb = el('bkBody');
      if (!rows.length) {
        tb.innerHTML = '<tr class="empty-row"><td colspan="4">Belum ada backup. Klik &ldquo;Buat Backup Sekarang&rdquo; untuk membuat backup pertama.</td></tr>';
        return;
      }
      tb.innerHTML = rows.map(function (r) {
        return '<tr>' +
          '<td><strong>' + esc(r.nama) + '</strong></td>' +
          '<td>' + fmtSize(r.ukuran) + '</td>' +
          '<td>' + esc(r.dibuat) + '</td>' +
          '<td class="ta-right">' +
          '<button type="button" class="btn btn-xs" data-act="unduh" data-file="' + esc(r.nama) + '">Unduh</button> ' +
          '<button type="button" class="btn btn-xs btn-danger" data-act="pulihkan" data-file="' + esc(r.nama) + '">Pulihkan</button> ' +
          '<button type="button" class="btn btn-xs btn-ghost" data-act="hapus" data-file="' + esc(r.nama) + '">Hapus</button>' +
          '</td></tr>';
      }).join('');
    }).catch(function (e) {
      el('bkBody').innerHTML = '<tr class="empty-row"><td colspan="4">' + esc(e.message) + '</td></tr>';
    });
  }

  function downloadBackup(name) {
    var a = document.createElement('a');
    a.href = 'api/backup.php?act=download&file=' + encodeURIComponent(name);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  function showLeReport(j) {
    var imp = j.diimpor || {};
    var lew = j.dilewati || {};
    el('bkLeReportCard').hidden = false;
    el('bkLeReportSub').textContent = j.message || 'Pemulihan selesai.';
    el('bkLeReportBody').innerHTML =
      '<div class="warn-row"><span>Pekebun diimpor</span><strong>' + (imp.pekebun || 0) + '</strong></div>' +
      '<div class="warn-row"><span>Surat diimpor</span><strong>' + (imp.surat || 0) + '</strong></div>' +
      '<div class="warn-row"><span>Counter nomor surat</span><strong>' + (imp.counters || 0) + '</strong></div>' +
      '<div class="warn-row"><span>Dilewati (duplikat / milik lembaga lain)</span><strong>' + ((lew.pekebun || 0) + (lew.surat || 0)) + '</strong></div>';
    el('bkLeReportCard').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function showPage() {
    var isAdmin = AppAuth.role() === 'admin';
    el('bkAdmin').hidden = !isAdmin;
    el('bkLembaga').hidden = isAdmin;
    if (isAdmin) refreshAdmin();
  }

  function bind() {
    if (window.AppBackup) return;
    window.AppBackup = { refreshAdmin: refreshAdmin };

    var btnCreate = el('btnBkCreate');
    if (btnCreate) btnCreate.addEventListener('click', function () {
      btnLoading(btnCreate, true);
      Api.post('backup.php', 'create', {}).then(function (j) {
        AppToast('Backup berhasil dibuat: ' + (j.nama || ''), 'success');
        refreshAdmin();
      }).catch(function (e) {
        AppToast(e.message, 'error');
      }).finally(function () { btnLoading(btnCreate, false); });
    });

    var btnChoose = el('btnBkChoose');
    if (btnChoose) btnChoose.addEventListener('click', function () { el('bkFileRestore').click(); });
    var fileRestore = el('bkFileRestore');
    if (fileRestore) fileRestore.addEventListener('change', function () {
      pickFile = fileRestore.files[0] || null;
      el('bkRestoreFile').textContent = pickFile ? 'File dipilih: ' + pickFile.name + ' (' + fmtSize(pickFile.size) + ')' : '';
      el('btnBkRestore').disabled = !pickFile;
    });

    var btnRestore = el('btnBkRestore');
    if (btnRestore) btnRestore.addEventListener('click', function () {
      if (!pickFile) return;
      AppConfirm('Pulihkan database dari file "' + pickFile.name + '"? Seluruh data saat ini akan ditimpa dengan isi file backup dan tidak dapat dibatalkan.', function () {
        btnLoading(btnRestore, true);
        Api.upload('backup.php', 'restore', { file: pickFile }).then(function (j) {
          AppToast(j.message || 'Database berhasil dipulihkan.', 'success');
          setTimeout(function () { window.location.reload(); }, 1200);
        }).catch(function (e) {
          AppToast(e.message, 'error');
        }).finally(function () { btnLoading(btnRestore, false); });
      });
    });

    var body = el('bkBody');
    if (body) body.addEventListener('click', function (ev) {
      var btn = ev.target.closest('button[data-act]');
      if (!btn) return;
      var act = btn.dataset.act;
      var name = btn.dataset.file;
      if (act === 'unduh') {
        downloadBackup(name);
      } else if (act === 'hapus') {
        AppConfirm('Hapus file backup "' + name + '"?', function () {
          Api.post('backup.php', 'delete', { file: name }).then(function () {
            AppToast('Backup dihapus.', 'success');
            refreshAdmin();
          }).catch(function (e) { AppToast(e.message, 'error'); });
        });
      } else if (act === 'pulihkan') {
        AppConfirm('Pulihkan database dari backup "' + name + '"? Seluruh data saat ini akan ditimpa dan tidak dapat dibatalkan.', function () {
          btnLoading(btn, true);
          Api.post('backup.php', 'restore', { file: name }).then(function (j) {
            AppToast(j.message || 'Database berhasil dipulihkan.', 'success');
            setTimeout(function () { window.location.reload(); }, 1200);
          }).catch(function (e) {
            AppToast(e.message, 'error');
          }).finally(function () { btnLoading(btn, false); });
        });
      }
    });

    /* ---- Lembaga ---- */
    var btnLeCreate = el('btnBkLeCreate');
    if (btnLeCreate) btnLeCreate.addEventListener('click', function () {
      btnLoading(btnLeCreate, true);
      Api.get('backup.php', 'le_create').then(function (j) {
        var d = j.data;
        var stamp = String(d.dibuat || '').replace(/[^0-9]/g, '');
        var slug = String(d.nama_lembaga || 'lembaga').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
        var blob = new Blob([JSON.stringify(d, null, 2)], { type: 'application/json;charset=utf-8' });
        var a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'backup_' + slug + '_' + (stamp || Date.now()) + '.json';
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(function () { URL.revokeObjectURL(a.href); }, 3000);
        AppToast('Backup ' + (d.jumlah ? d.jumlah.pekebun + ' pekebun, ' + d.jumlah.surat + ' surat' : '') + ' diunduh.', 'success');
      }).catch(function (e) {
        AppToast(e.message, 'error');
      }).finally(function () { btnLoading(btnLeCreate, false); });
    });

    var btnLeChoose = el('btnBkLeChoose');
    if (btnLeChoose) btnLeChoose.addEventListener('click', function () { el('bkFileLe').click(); });
    var fileLe = el('bkFileLe');
    if (fileLe) fileLe.addEventListener('change', function () {
      pickLeFile = fileLe.files[0] || null;
      el('bkLeFile').textContent = pickLeFile ? 'File dipilih: ' + pickLeFile.name + ' (' + fmtSize(pickLeFile.size) + ')' : '';
      el('btnBkLeRestore').disabled = !pickLeFile;
    });

    var btnLeRestore = el('btnBkLeRestore');
    if (btnLeRestore) btnLeRestore.addEventListener('click', function () {
      if (!pickLeFile) return;
      AppConfirm('Pulihkan data kelembagaan dari file "' + pickLeFile.name + '"? Data yang sama akan diperbarui dan data baru ditambahkan.', function () {
        btnLoading(btnLeRestore, true);
        Api.upload('backup.php', 'le_restore', { file: pickLeFile }).then(function (j) {
          showLeReport(j);
          AppToast(j.message || 'Data berhasil dipulihkan.', 'success');
        }).catch(function (e) {
          AppToast(e.message, 'error');
        }).finally(function () { btnLoading(btnLeRestore, false); });
      });
    });
  /* ---- Restart Data (admin: semua, lembaga: milik sendiri) ---- */
  function restartData(btn, scopeText, yesLabel) {
    if (!btn || btn.dataset.busy) return;
    btn.dataset.busy = '1';
    Api.get('backup.php', 'reset_preview').then(function (j) {
      var d = j.dihapus || {};
      var nP = Number(d.pekebun) || 0;
      var nD = Number(d.dokumen) || 0;
      var nS = Number(d.surat) || 0;
      if (!nP && !nD && !nS) {
        AppToast('Tidak ada data pekebun untuk dikosongkan.', 'info');
        return;
      }
      AppConfirm('RESTART DATA — TIDAK DAPAT DIBATALKAN! ' + scopeText + ' ' + nP + ' pekebun, ' + nD + ' dokumen, dan ' + nS + ' surat akan dihapus permanen. Pastikan backup sudah dibuat sebelum melanjutkan.', function () {
        btnLoading(btn, true);
        Api.post('backup.php', 'reset', { konfirmasi: true }).then(function (r) {
          AppToast(r.message || 'Data pekebun berhasil dikosongkan.', 'success');
          setTimeout(function () { window.location.reload(); }, 1500);
        }).catch(function (e) {
          AppToast(e.message, 'error');
        }).finally(function () { btnLoading(btn, false); });
      }, { title: 'Restart Data Pekebun?', yesLabel: yesLabel });
    }).catch(function (e) {
      AppToast(e.message, 'error');
    }).finally(function () { delete btn.dataset.busy; });
  }

  var btnAdminReset = el('btnBkAdminReset');
  if (btnAdminReset) btnAdminReset.addEventListener('click', function () {
    restartData(btnAdminReset, 'Seluruh data pekebun dari SEMUA kelembagaan akan dikosongkan:', 'Ya, Restart Semua');
  });

  var btnLeReset = el('btnBkLeReset');
  if (btnLeReset) btnLeReset.addEventListener('click', function () {
    restartData(btnLeReset, 'Seluruh data pekebun kelembagaan Anda akan dikosongkan:', 'Ya, Restart Data Saya');
  });
  }

  window.AppPages = window.AppPages || {};
  window.AppPages.backup = function () {
    bind();
    showPage();
  };
})();
