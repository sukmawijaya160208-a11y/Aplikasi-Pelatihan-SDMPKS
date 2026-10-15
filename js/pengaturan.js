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
    sTahunAnggaran: 'tahun_anggaran'
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

  /* ============ Daftar Desa (profil lengkap per desa) ============ */
  var desaRows = [];

  function blankDesa() {
    return { id: 0, nama_desa: '', kecamatan: '', kabupaten: '', kepala_desa: '',
      kepala_desa_hp: '', desa_alamat: '', kode_surat_desa: '', logo_desa: '', is_default: 0 };
  }

  function desaFromSettings(s) {
    s = s || {};
    var list = Array.isArray(s.desa_daftar) && s.desa_daftar.length ? s.desa_daftar : null;
    if (!list && (s.nama_desa || s.kepala_desa || s.desa_alamat || s.kode_surat_desa)) {
      list = [{
        id: 0, nama_desa: s.nama_desa || '', kecamatan: '', kabupaten: '',
        kepala_desa: s.kepala_desa || '', kepala_desa_hp: s.kepala_desa_hp || '',
        desa_alamat: s.desa_alamat || '', kode_surat_desa: s.kode_surat_desa || '',
        logo_desa: s.logo_desa || '', is_default: 1
      }];
    }
    desaRows = (list && list.length ? list : [blankDesa()]).map(function (d) {
      var o = blankDesa();
      for (var k in o) if (d && d[k] !== undefined && d[k] !== null) o[k] = d[k];
      o.id = Number(o.id) || 0;
      o.is_default = Number(o.is_default) === 1 ? 1 : 0;
      return o;
    });
    if (!desaRows.some(function (d) { return d.is_default === 1; })) desaRows[0].is_default = 1;
  }

  function desaRowHTML(d, i) {
    var logo = d.logo_desa
      ? '<img class="desa-logo-mini" src="' + d.logo_desa + '" alt="Logo desa">'
      : '<span class="desa-logo-mini desa-logo-none">Belum ada logo</span>';
    return '<div class="desa-item" data-i="' + i + '">' +
      '<div class="desa-item-head">' +
      '<strong>Desa ' + (i + 1) + '</strong>' +
      '<label class="desa-def"><input type="radio" name="desaDefault" value="' + i + '"' + (d.is_default === 1 ? ' checked' : '') + '> Jadikan default</label>' +
      '<button type="button" class="btn btn-xs btn-danger desa-hapus" data-i="' + i + '">Hapus</button>' +
      '</div>' +
      '<div class="form-row">' +
      '<div class="form-group"><label>Nama Desa *</label><input type="text" data-f="nama_desa" value="' + esc(d.nama_desa) + '" placeholder="cth: Tegal Sari"></div>' +
      '<div class="form-group"><label>Nama Kepala Desa *</label><input type="text" data-f="kepala_desa" value="' + esc(d.kepala_desa) + '" placeholder="cth: SISWOYO"></div>' +
      '</div>' +
      '<div class="form-row">' +
      '<div class="form-group"><label>Kecamatan *</label><input type="text" data-f="kecamatan" value="' + esc(d.kecamatan) + '" placeholder="cth: Megang Sakti"></div>' +
      '<div class="form-group"><label>Kabupaten/Kota *</label><input type="text" data-f="kabupaten" value="' + esc(d.kabupaten) + '" placeholder="cth: Musi Rawas"></div>' +
      '</div>' +
      '<div class="form-row">' +
      '<div class="form-group"><label>No. HP Kepala Desa</label><input type="tel" data-f="kepala_desa_hp" value="' + esc(d.kepala_desa_hp) + '" placeholder="cth: 081234567890"></div>' +
      '<div class="form-group"><label>Kode Nomor Surat (Desa)</label><input type="text" data-f="kode_surat_desa" value="' + esc(d.kode_surat_desa) + '" placeholder="cth: PD-TS/MURA"></div>' +
      '</div>' +
      '<div class="form-group"><label>Alamat Desa</label><textarea rows="2" data-f="desa_alamat">' + esc(d.desa_alamat) + '</textarea></div>' +
      '<div class="desa-logo-row">' + logo +
      '<div class="form-actions">' +
      '<button type="button" class="btn btn-xs btn-outline desa-logo-up" data-i="' + i + '">Upload Logo</button>' +
      '<button type="button" class="btn btn-xs btn-danger desa-logo-del" data-i="' + i + '">Hapus Logo</button>' +
      '</div>' +
      '<input type="file" class="desa-logo-file" data-i="' + i + '" accept="image/*" hidden>' +
      '</div>' +
      '</div>';
  }

  function renderDesaList() {
    var wrap = document.getElementById('desaList');
    if (!wrap) return;
    wrap.innerHTML = desaRows.map(function (d, i) { return desaRowHTML(d, i); }).join('');
  }

  function collectDesaList() {
    var wrap = document.getElementById('desaList');
    if (!wrap) throw new Error('Form daftar desa tidak ditemukan.');
    var items = wrap.querySelectorAll('.desa-item');
    if (!items.length) throw new Error('Minimal satu profil desa wajib diisi.');
    var out = [];
    var seen = {};
    [].forEach.call(items, function (row) {
      var g = function (f) {
        var el = row.querySelector('[data-f="' + f + '"]');
        return el ? el.value.trim().replace(/\s+/g, ' ') : '';
      };
      var nama = g('nama_desa').replace(/^Desa\s+/i, '');
      var o = {
        id: Number(desaRows[Number(row.getAttribute('data-i'))].id) || 0,
        nama_desa: nama,
        kecamatan: g('kecamatan').replace(/^Kecamatan\s+/i, ''),
        kabupaten: g('kabupaten').replace(/^(Kabupaten|Kota)\s+/i, ''),
        kepala_desa: g('kepala_desa'),
        kepala_desa_hp: g('kepala_desa_hp'),
        desa_alamat: (row.querySelector('[data-f="desa_alamat"]') || {}).value || '',
        kode_surat_desa: g('kode_surat_desa'),
        is_default: 0
      };
      o.desa_alamat = String(o.desa_alamat).trim();
      if (!o.nama_desa && !o.kecamatan && !o.kabupaten && !o.kepala_desa && !o.kepala_desa_hp && !o.desa_alamat && !o.kode_surat_desa) return;
      if (!o.nama_desa || !o.kecamatan || !o.kabupaten || !o.kepala_desa) {
        throw new Error('Profil desa "' + (o.nama_desa || '(tanpa nama)') + '" belum lengkap. Nama desa, kecamatan, kabupaten, dan kepala desa wajib diisi.');
      }
      var key = o.nama_desa.toLowerCase();
      if (seen[key]) throw new Error('Nama desa "' + o.nama_desa + '" ganda dalam daftar.');
      seen[key] = true;
      out.push(o);
    });
    if (!out.length) throw new Error('Minimal satu profil desa wajib diisi.');
    var defIdx = -1;
    var checked = wrap.querySelector('input[name="desaDefault"]:checked');
    if (checked) defIdx = Number(checked.value) || 0;
    if (defIdx < 0 || defIdx >= out.length) defIdx = 0;
    out.forEach(function (o, i) { o.is_default = (i === defIdx) ? 1 : 0; });
    return out;
  }

  function renderKopDesa(s) {
    var el = document.getElementById('kopDesaPreview');
    if (!el || !window.AppSurat) return;
    var profiles = AppSurat.desaProfiles(s);
    var profil = AppSurat.desaDefault(profiles);
    el.innerHTML = AppSurat.kopDesaHTML(s || {}, profil || {});
  }

  function setReadonly(mode) {
    readonly = !!mode;
    for (var id in FIELD_MAP) {
      var el = document.getElementById(id);
      if (el) el.disabled = readonly;
    }
    var dl = document.getElementById('desaList');
    if (dl) {
      [].forEach.call(dl.querySelectorAll('input, textarea, select, button'), function (x) { x.disabled = readonly; });
    }
    var tb = document.getElementById('btnTambahDesa');
    if (tb) tb.hidden = readonly;
    var btn = document.getElementById('btnSimpanPengaturan');
    if (btn) btn.hidden = readonly;
    var la = document.getElementById('logoActions');
    if (la) la.hidden = readonly;
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
      desaFromSettings(s);
      renderDesaList();
      renderLogo(s);
      renderKop(s);
      renderKopDesa(s);
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
      try {
        s.desa_daftar = collectDesaList();
      } catch (err) {
        AppToast(err.message, 'error');
        return;
      }
      if (!s.nama_lembaga) { AppToast('Nama kelembagaan wajib diisi.', 'error'); return; }
      AppSettings.save(s, lid).then(function () {
        renderKop(s);
        renderKopDesa(s);
        AppToast('Pengaturan kelembagaan berhasil disimpan.');
        refresh(lid);
      }).catch(function (err) {
        AppToast(err.message, 'error');
      });
    });

    var btnTambahDesa = document.getElementById('btnTambahDesa');
    if (btnTambahDesa) btnTambahDesa.addEventListener('click', function () {
      desaRows.push(blankDesa());
      renderDesaList();
    });

    var desaWrap = document.getElementById('desaList');
    if (desaWrap) {
      desaWrap.addEventListener('click', function (e) {
        var hapus = e.target.closest('.desa-hapus');
        if (hapus) {
          if (desaRows.length <= 1) { AppToast('Minimal satu profil desa harus ada.', 'warn'); return; }
          var idx = Number(hapus.getAttribute('data-i')) || 0;
          AppConfirm('Hapus profil desa ini? Perubahan tersimpan saat Anda klik Simpan Pengaturan.', function () {
            desaRows.splice(idx, 1);
            if (!desaRows.some(function (d) { return d.is_default === 1; })) desaRows[0].is_default = 1;
            renderDesaList();
          });
          return;
        }
        var up = e.target.closest('.desa-logo-up');
        if (up) {
          var i = Number(up.getAttribute('data-i')) || 0;
          if (!Number(desaRows[i].id)) {
            AppToast('Simpan pengaturan dulu sebelum upload logo desa ini.', 'warn');
            return;
          }
          var fi = desaWrap.querySelector('.desa-logo-file[data-i="' + i + '"]');
          if (fi) fi.click();
          return;
        }
        var del = e.target.closest('.desa-logo-del');
        if (del) {
          var j = Number(del.getAttribute('data-i')) || 0;
          var row = desaRows[j];
          if (!row || !Number(row.id)) { AppToast('Simpan pengaturan dulu sebelum mengelola logo.', 'warn'); return; }
          var lidDel = currentLembagaId();
          if (!lidDel) { AppToast('Pilih kelembagaan terlebih dahulu.', 'error'); return; }
          AppConfirm('Yakin ingin menghapus logo desa ini?', function () {
            AppSettings.saveLogo('', lidDel, 'desa', row.id).then(function () {
              AppToast('Logo desa dihapus.');
              refresh(lidDel);
            }).catch(function (err) { AppToast(err.message, 'error'); });
          });
        }
      });
      desaWrap.addEventListener('change', function (e) {
        var fi = e.target.closest ? e.target.closest('.desa-logo-file') : null;
        if (!fi) return;
        var i = Number(fi.getAttribute('data-i')) || 0;
        var row = desaRows[i];
        var f = fi.files && fi.files[0];
        fi.value = '';
        if (!f || !row || !Number(row.id)) return;
        if (!/^image\//.test(f.type)) { AppToast('File harus berupa gambar.', 'error'); return; }
        if (f.size > 2 * 1024 * 1024) { AppToast('Ukuran gambar maksimal 2 MB.', 'error'); return; }
        var lidUp = currentLembagaId();
        if (!lidUp) { AppToast('Pilih kelembagaan terlebih dahulu.', 'error'); return; }
        var reader = new FileReader();
        reader.onload = function (ev) {
          AppSettings.saveLogo(ev.target.result, lidUp, 'desa', row.id).then(function () {
            AppToast('Logo desa berhasil diunggah.');
            refresh(lidUp);
          }).catch(function (err) { AppToast(err.message, 'error'); });
        };
        reader.readAsDataURL(f);
      });
    }

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
