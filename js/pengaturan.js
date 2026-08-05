(function () {
  var FIELD_MAP = {
    sJenisLembaga: 'jenis_lembaga',
    sSingkatan: 'singkatan',
    sNamaLembaga: 'nama_lembaga',
    sKetua: 'ketua',
    sJabatan: 'jabatan',
    sKetuaHp: 'ketua_hp',
    sAlamat: 'alamat',
    sTempat: 'tempat',
    sKodeSurat: 'kode_surat',
    sKodeSuratDesa: 'kode_surat_desa',
    sTahunAnggaran: 'tahun_anggaran',
    sKepalaDesa: 'kepala_desa',
    sNamaDesa: 'nama_desa',
    sKepalaDesaHp: 'kepala_desa_hp',
    sDesaAlamat: 'desa_alamat'
  };

  var current = 0;
  var readonly = false;

  function renderKop(s) {
    var el = document.getElementById('kopPreview');
    if (!el) return;
    el.innerHTML = AppSurat.kopHTML(s || AppSettings.get(currentLembagaId()));
  }

  function renderLogo(s) {
    var el = document.getElementById('logoPreview');
    if (!el) return;
    s = s || AppSettings.get(currentLembagaId());
    if (s.logo) {
      el.innerHTML = '<img src="' + s.logo + '" alt="Logo">';
    } else {
      el.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="4"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>';
    }
  }

  function renderLogoDesa(s) {
    var el = document.getElementById('logoDesaPreview');
    if (!el) return;
    s = s || AppSettings.get(currentLembagaId());
    if (s.logo_desa) {
      el.innerHTML = '<img src="' + s.logo_desa + '" alt="Logo Desa">';
    } else {
      el.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="4"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>';
    }
  }

  function currentLembagaId() {
    var u = AppAuth.user();
    if (u && u.role === 'admin') {
      return current || 0;
    }
    return u ? (Number(u.lembaga_id) || 0) : 0;
  }

  function fillForm(s) {
    for (var id in FIELD_MAP) {
      var el = document.getElementById(id);
      if (el) el.value = s[FIELD_MAP[id]] || '';
    }
  }

  function setReadonly(mode) {
    readonly = !!mode;
    for (var id in FIELD_MAP) {
      var el = document.getElementById(id);
      if (el) el.disabled = readonly;
    }
    var btn = document.getElementById('btnSimpanPengaturan');
    if (btn) btn.hidden = readonly;
    var la = document.getElementById('logoActions');
    if (la) la.hidden = readonly;
    var ld = document.getElementById('logoDesaActions');
    if (ld) ld.hidden = readonly;
    var rb = document.getElementById('roBanner');
    if (rb) rb.hidden = !readonly;
  }

  var INFO_ICONS = {
    ketua: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
    pemdes: '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>',
    alamat: '<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>',
    tempat: '<path d="M20 10c0 4.99-5.1 10.4-8 12.5C9.1 20.4 4 14.99 4 10a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="2.2"/>',
    kode: '<line x1="4" y1="9" x2="20" y2="9"/><line x1="4" y1="15" x2="20" y2="15"/><line x1="10" y1="3" x2="8" y2="21"/><line x1="16" y1="3" x2="14" y2="21"/>',
    ta: '<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',
    singkatan: '<path d="M20.59 13.41 11 3H3v8l10.59 10.59a2 2 0 0 0 2.83 0l4.17-4.17a2 2 0 0 0 0-2.83z"/><line x1="7" y1="7" x2="7.01" y2="7"/>'
  };

  function ldInfoItem(icon, label, value) {
    return '<div class="ld-info-item"><span class="ld-info-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + (INFO_ICONS[icon] || INFO_ICONS.alamat) + '</svg></span>' +
      '<div><small>' + label + '</small><strong>' + esc(value) + '</strong></div></div>';
  }

  function renderDetailHeader(l) {
    var card = document.getElementById('pengaturanDetailCard');
    if (!card) return;
    if (!l) {
      card.hidden = true;
      return;
    }
    card.hidden = false;
    document.getElementById('ldNama').textContent = l.nama_lembaga || '-';
    document.getElementById('ldJenis').textContent = l.jenis_lembaga || '';
    var logo = document.getElementById('ldLogo');
    logo.innerHTML = l.logo
      ? '<img src="' + l.logo + '" alt="Logo">'
      : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21h18"/><path d="M5 21V7l7-4 7 4v14"/><path d="M9 9h1"/><path d="M9 13h1"/><path d="M14 9h1"/><path d="M14 13h1"/><path d="M10 21v-4h4v4"/></svg>';
    var chips = [];
    if (l.singkatan) chips.push('<span class="chip"><b>' + esc(l.singkatan) + '</b></span>');
    if (l.ketua) chips.push('<span class="chip">Ketua : <b>' + esc(l.ketua) + '</b></span>');
    if (l.kepala_desa) chips.push('<span class="chip">Kepala Desa : <b>' + esc(l.kepala_desa) + '</b></span>');
    document.getElementById('ldChips').innerHTML = chips.join('');
    document.getElementById('ldStats').innerHTML =
      '<div class="ld-stat"><b>' + (l.total_pekebun || 0) + '</b><span>Total</span></div>' +
      '<div class="ld-stat amber"><b>' + (l.menunggu || 0) + '</b><span>Menunggu</span></div>' +
      '<div class="ld-stat green"><b>' + (l.disetujui || 0) + '</b><span>Disetujui</span></div>' +
      '<div class="ld-stat red"><b>' + (l.dikembalikan || 0) + '</b><span>Dikembalikan</span></div>';
    var info = [];
    if (l.ketua) info.push(ldInfoItem('ketua', 'Ketua Kelembagaan', l.ketua + (l.jabatan ? ' &ndash; ' + l.jabatan : '')));
    if (l.kepala_desa) info.push(ldInfoItem('pemdes', 'Kepala Desa', l.kepala_desa));
    if (l.alamat) info.push(ldInfoItem('alamat', 'Alamat', l.alamat));
    if (l.tempat) info.push(ldInfoItem('tempat', 'Tempat Penerbitan', l.tempat));
    if (l.kode_surat) info.push(ldInfoItem('kode', 'Kode Nomor Surat', l.kode_surat));
    if (l.tahun_anggaran) info.push(ldInfoItem('ta', 'Tahun Anggaran', l.tahun_anggaran));
    var grid = document.getElementById('ldInfoGrid');
    if (grid) grid.innerHTML = info.join('') || '';
  }

  function lembagaRow(lid) {
    var rows = AppCache.lembaga || [];
    for (var i = 0; i < rows.length; i++) {
      if (String(rows[i].id) === String(lid)) return rows[i];
    }
    return null;
  }

  function renderBatasCard(s) {
    var inp = document.getElementById('inpBatasUsulan');
    if (!inp) return;
    var ta = document.getElementById('batasTaTahun');
    if (ta) ta.textContent = (s && s.tahun_anggaran) || String(new Date().getFullYear());
    var badge = document.getElementById('batasUsulanStatus');
    var btnHapus = document.getElementById('btnHapusBatas');
    var b = (s && s.batas_usulan) || '';
    if (!b) {
      inp.value = '';
      if (badge) { badge.textContent = 'Belum Diatur'; badge.className = 'badge st-draft'; }
      if (btnHapus) btnHapus.hidden = true;
      return;
    }
    var lewat = new Date(String(b).replace(' ', 'T')) <= new Date();
    if (badge) {
      badge.textContent = lewat ? 'Terkunci' : 'Aktif';
      badge.className = lewat ? 'badge st-dikembalikan' : 'badge st-disetujui';
    }
    inp.value = String(b).slice(0, 16);
    if (btnHapus) btnHapus.hidden = false;
  }

  function toLocalInput(d) {
    var p = function (n) { return (n < 10 ? '0' : '') + n; };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + 'T' + p(d.getHours()) + ':' + p(d.getMinutes());
  }

  function saveBatas(lid, value) {
    Api.post('settings.php', 'save_batas', { batas_usulan: value }, { lembaga_id: lid }).then(function () {
      AppToast(value ? 'Batas waktu usulan berhasil disimpan.' : 'Batas waktu usulan dihapus.');
      refresh(lid);
    }).catch(function (err) { AppToast(err.message, 'error'); });
  }

  function loadAndRender(lid) {
    renderDetailHeader(lembagaRow(lid));
    AppSettings.load(lid).then(function (s) {
      fillForm(s);
      renderLogo(s);
      renderLogoDesa(s);
      renderKop(s);
      renderBatasCard(s);
    }).catch(function (e) {
      AppToast(e.message, 'error');
    });
  }

  function rebuildSelect(target) {
    var sel = document.getElementById('selPengaturanLembaga');
    if (!sel) return;
    var rows = AppCache.lembaga || [];
    var html = '<option value="">-- Pilih Kelembagaan --</option>';
    rows.forEach(function (l) {
      html += '<option value="' + l.id + '"' + (String(l.id) === String(target) ? ' selected' : '') + '>' + esc(l.nama_lembaga) + '</option>';
    });
    sel.innerHTML = html;
    document.getElementById('countPengaturanLembaga').textContent = rows.length;
  }

  function refresh(lid) {
    loadLembaga(true).then(function () {
      rebuildSelect(lid || current);
      var sel = document.getElementById('selPengaturanLembaga');
      var pick = Number(lid || sel.value || 0);
      if (!pick && AppCache.lembaga && AppCache.lembaga.length) pick = Number(AppCache.lembaga[0].id);
      if (pick) {
        current = pick;
        sel.value = pick;
        loadAndRender(pick);
      } else {
        current = 0;
        renderDetailHeader(null);
      }
    }).catch(function (e) {
      AppToast(e.message, 'error');
    });
  }

  window.AppPengaturan = { refresh: refresh };

  window.AppPages = window.AppPages || {};
  window.AppPages.pengaturan = function (opts) {
    var u = AppAuth.user();
    var role = u ? u.role : '';
    var isAdmin = role === 'admin';
    var isDinas = role === 'dinas';
    var card = document.getElementById('pengaturanLembagaCard');
    if (card) card.hidden = !(isAdmin || isDinas);
    var btnTambah = document.getElementById('btnTambahLembagaPengaturan');
    if (btnTambah) btnTambah.hidden = !isAdmin;
    var formGrid = document.getElementById('pengaturanFormGrid');
    if (formGrid) formGrid.hidden = isDinas;
    var kopCard = document.getElementById('kopCard');
    if (kopCard) kopCard.hidden = isDinas;
    var kopWrap = document.getElementById('kopWrap');
    if (kopWrap) kopWrap.hidden = isDinas;
    var buc = document.getElementById('batasUsulanCard');
    if (buc) buc.hidden = !(isAdmin || isDinas);
    setReadonly(isDinas);

    if (isDinas) {
      var target2 = (opts || AppGo.opts || null);
      target2 = target2 && target2.lembaga_id ? Number(target2.lembaga_id) : 0;
      refresh(target2);
      return;
    }
    if (isAdmin) {
      var target = (opts || AppGo.opts || null);
      target = target && target.lembaga_id ? Number(target.lembaga_id) : 0;
      refresh(target);
      return;
    }
    refresh(Number(u.lembaga_id) || 0);
  };

  document.addEventListener('DOMContentLoaded', function () {
    var selL = document.getElementById('selPengaturanLembaga');
    if (selL) {
      selL.addEventListener('change', function () {
        current = Number(this.value) || 0;
        if (current) loadAndRender(current);
        else renderDetailHeader(null);
      });
    }

    var btnTambah = document.getElementById('btnTambahLembagaPengaturan');
    if (btnTambah && window.openLembagaModal) {
      btnTambah.addEventListener('click', function () { openLembagaModal(null); });
    }

    document.getElementById('formSettings').addEventListener('submit', function (e) {
      e.preventDefault();
      var lid = currentLembagaId();
      if (!lid) { AppToast('Pilih kelembagaan terlebih dahulu.', 'error'); return; }
      var s = AppSettings.get(lid);
      for (var id in FIELD_MAP) {
        var el = document.getElementById(id);
        if (el) s[FIELD_MAP[id]] = el.value.trim();
      }
      if (!s.nama_lembaga) { AppToast('Nama kelembagaan wajib diisi.', 'error'); return; }
      AppSettings.save(s, lid).then(function () {
        renderKop(s);
        AppToast('Pengaturan kelembagaan berhasil disimpan.');
        refresh(lid);
      }).catch(function (err) {
        AppToast(err.message, 'error');
      });
    });

    document.getElementById('btnUploadLogo').addEventListener('click', function () {
      document.getElementById('fileLogo').click();
    });

    document.getElementById('fileLogo').addEventListener('change', function () {
      var f = this.files[0];
      this.value = '';
      var lid = currentLembagaId();
      if (!lid) { AppToast('Pilih kelembagaan terlebih dahulu.', 'error'); return; }
      if (!f) return;
      if (!/^image\//.test(f.type)) { AppToast('File harus berupa gambar.', 'error'); return; }
      if (f.size > 2 * 1024 * 1024) { AppToast('Ukuran gambar maksimal 2 MB.', 'error'); return; }
      var reader = new FileReader();
      reader.onload = function (e) {
        AppSettings.saveLogo(e.target.result, lid).then(function () {
          renderLogo();
          renderKop();
          AppToast('Logo kelembagaan berhasil diunggah.');
          refresh(lid);
        }).catch(function (err) {
          AppToast(err.message, 'error');
        });
      };
      reader.readAsDataURL(f);
    });

    document.getElementById('btnHapusLogo').addEventListener('click', function () {
      var lid = currentLembagaId();
      if (!lid) { AppToast('Pilih kelembagaan terlebih dahulu.', 'error'); return; }
      AppConfirm('Yakin ingin menghapus logo?', function () {
        AppSettings.saveLogo('', lid).then(function () {
          renderLogo();
          renderKop();
          AppToast('Logo dihapus.');
          refresh(lid);
        }).catch(function (err) {
          AppToast(err.message, 'error');
        });
      });
    });

    var btnUpDesa = document.getElementById('btnUploadLogoDesa');
    var fileDesa = document.getElementById('fileLogoDesa');
    if (btnUpDesa && fileDesa) {
      btnUpDesa.addEventListener('click', function () { fileDesa.click(); });
      fileDesa.addEventListener('change', function () {
        var f = this.files[0];
        this.value = '';
        var lid = currentLembagaId();
        if (!lid) { AppToast('Pilih kelembagaan terlebih dahulu.', 'error'); return; }
        if (!f) return;
        if (!/^image\//.test(f.type)) { AppToast('File harus berupa gambar.', 'error'); return; }
        if (f.size > 2 * 1024 * 1024) { AppToast('Ukuran gambar maksimal 2 MB.', 'error'); return; }
        var reader = new FileReader();
        reader.onload = function (e) {
          AppSettings.saveLogo(e.target.result, lid, 'desa').then(function () {
            renderLogoDesa();
            AppToast('Logo desa berhasil diunggah.');
            refresh(lid);
          }).catch(function (err) {
            AppToast(err.message, 'error');
          });
        };
        reader.readAsDataURL(f);
      });
    }
    var btnHapusDesa = document.getElementById('btnHapusLogoDesa');
    if (btnHapusDesa) {
      btnHapusDesa.addEventListener('click', function () {
        var lid = currentLembagaId();
        if (!lid) { AppToast('Pilih kelembagaan terlebih dahulu.', 'error'); return; }
        AppConfirm('Yakin ingin menghapus logo desa?', function () {
          AppSettings.saveLogo('', lid, 'desa').then(function () {
            renderLogoDesa();
            AppToast('Logo desa dihapus.');
            refresh(lid);
          }).catch(function (err) {
            AppToast(err.message, 'error');
          });
        });
      });
    }

    var btnSimpanBatas = document.getElementById('btnSimpanBatas');
    if (btnSimpanBatas) {
      btnSimpanBatas.addEventListener('click', function () {
        var lid = current || currentLembagaId();
        if (!lid) { AppToast('Pilih kelembagaan terlebih dahulu.', 'error'); return; }
        var v = document.getElementById('inpBatasUsulan').value;
        if (!v) { AppToast('Pilih tanggal dan jam batas waktu terlebih dahulu.', 'error'); return; }
        saveBatas(lid, v);
      });
    }
    var btnHapusBatas = document.getElementById('btnHapusBatas');
    if (btnHapusBatas) {
      btnHapusBatas.addEventListener('click', function () {
        var lid = current || currentLembagaId();
        if (!lid) { AppToast('Pilih kelembagaan terlebih dahulu.', 'error'); return; }
        AppConfirm('Yakin ingin menghapus batas waktu usulan? Lembaga dapat mengajukan usulan kembali.', function () {
          saveBatas(lid, '');
        });
      });
    }
    var btnPerpanjangBatas = document.getElementById('btnPerpanjangBatas');
    if (btnPerpanjangBatas) {
      btnPerpanjangBatas.addEventListener('click', function () {
        var lid = current || currentLembagaId();
        if (!lid) { AppToast('Pilih kelembagaan terlebih dahulu.', 'error'); return; }
        var inp = document.getElementById('inpBatasUsulan');
        var base = inp && inp.value ? new Date(inp.value) : new Date();
        base.setDate(base.getDate() + 7);
        inp.value = toLocalInput(base);
        saveBatas(lid, inp.value);
      });
    }
  });
})();
