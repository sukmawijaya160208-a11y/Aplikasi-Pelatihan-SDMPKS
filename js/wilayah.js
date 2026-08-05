/* ============================================================
   SDMPKS - Wilayah (data offline Kepmendagri 2025)
   AppWilayah: cascade Provinsi -> Kabupaten -> Kecamatan -> Desa
   ============================================================ */
(function () {
  var BASE = 'assets/data/wilayah/';
  var cache = { provinsi: null, kabupaten: null, kecamatan: null, desa: {} };

  window.AppWilayah = {
    OPSI_PELATIHAN: [
      'Budidaya Kelapa Sawit',
      'Panen dan Pascapanen',
      'Implementasi ISPO',
      'Sarana Prasarana',
      'Pemetaan Lokasi'
    ],
    OPSI_JALUR: [
      'Pekebun',
      'Keluarga Pekebun',
      'Karyawan/Pekerja',
      'Keluarga Karyawan/Pekerja',
      'Pengurus Kelembagaan Pekebun',
      'Pengurus Asosiasi Pekebun',
      'ASN & Penyuluh'
    ],

    init: function (prefix) {
      var sel = document.getElementById(prefix + 'Provinsi');
      if (!sel) return Promise.resolve();
      return Promise.all([
        fetchJson('provinsi.json').then(function (rows) {
          cache.provinsi = rows;
          fill(sel, rows, '-- Pilih Provinsi --');
        }),
        fetchJson('kabupaten.json').then(function (rows) {
          cache.kabupaten = groupBy(rows, 2);
        }),
        fetchJson('kecamatan.json').then(function (rows) {
          cache.kecamatan = groupBy(rows, 4);
        })
      ]);
    },

    bindRegionSelects: function (prefix, opts) {
      opts = opts || {};
      var ids = ['Provinsi', 'Kabupaten', 'Kecamatan', 'Desa'];
      ids.forEach(function (suffix, i) {
        var sel = document.getElementById(prefix + suffix);
        if (!sel) return;
        sel.addEventListener('change', function () {
          resetBelow(prefix + ids[i]);
          var after = function () {
            if (opts.onAlamat) opts.onAlamat(AppWilayah.composeAlamat(prefix));
          };
          if (i === 0) loadKabupaten(prefix, sel.value, after);
          else if (i === 1) loadKecamatan(prefix, sel.value, after);
          else if (i === 2) loadDesa(prefix, sel.value, after);
          else after();
        });
      });
    },

    setValues: function (prefix, values, done) {
      var v = values || {};
      var p = document.getElementById(prefix + 'Provinsi');
      var k = document.getElementById(prefix + 'Kabupaten');
      var c = document.getElementById(prefix + 'Kecamatan');
      var d = document.getElementById(prefix + 'Desa');
      if (!p) { if (done) done(); return; }
      selectByNama(p, v.provinsi || '');
      if (p.value) loadKabupaten(prefix, p.value, function () {
        selectByNama(k, v.kabupaten || '');
        if (k.value) loadKecamatan(prefix, k.value, function () {
          selectByNama(c, v.kecamatan || '');
          if (c.value) loadDesa(prefix, c.value, function () {
            selectByNama(d, v.desa || '');
            if (done) done();
          });
        });
      });
    },

    readValues: function (prefix) {
      return {
        provinsi: selectNama(prefix + 'Provinsi'),
        kabupaten: selectNama(prefix + 'Kabupaten'),
        kecamatan: selectNama(prefix + 'Kecamatan'),
        desa: selectNama(prefix + 'Desa')
      };
    },

    composeAlamat: function (prefix) {
      var v = AppWilayah.readValues(prefix);
      if (!v.desa) return '';
      return [
        'Desa ' + v.desa.replace(/^Desa\s+/i, ''),
        'Kecamatan ' + v.kecamatan.replace(/^Kecamatan\s+/i, ''),
        'Kabupaten ' + v.kabupaten.replace(/^(Kabupaten|Kota)\s+/i, ''),
        'Provinsi ' + v.provinsi.replace(/^Provinsi\s+/i, '')
      ].join(', ');
    }
  };

  function selectNama(id) {
    var sel = document.getElementById(id);
    return sel && sel.value ? (sel.options[sel.selectedIndex] || {}).textContent || '' : '';
  }

  function selectByNama(sel, nama) {
    if (!sel) return;
    var found = false;
    for (var i = 0; i < sel.options.length; i++) {
      if (sel.options[i].textContent === nama) { sel.selectedIndex = i; found = true; break; }
    }
    if (!found) sel.value = '';
  }

  function fill(sel, rows, placeholder) {
    if (!sel) return;
    sel.innerHTML = '';
    var ph = document.createElement('option');
    ph.value = '';
    ph.textContent = placeholder || '';
    sel.appendChild(ph);
    rows.forEach(function (r) {
      var o = document.createElement('option');
      o.value = r.kode;
      o.textContent = r.nama;
      sel.appendChild(o);
    });
  }

  function groupBy(rows, prefixLen) {
    var map = {};
    rows.forEach(function (r) {
      var key = r.kode.slice(0, prefixLen);
      (map[key] = map[key] || []).push(r);
    });
    return map;
  }

  var ORDER = ['Provinsi', 'Kabupaten', 'Kecamatan', 'Desa'];

  function suffixOf(id) {
    for (var i = 0; i < ORDER.length; i++) {
      if (id.slice(-ORDER[i].length) === ORDER[i]) return ORDER[i];
    }
    return null;
  }

  function resetBelow(id) {
    var suffix = suffixOf(id);
    var next = suffix ? ORDER[ORDER.indexOf(suffix) + 1] : null;
    if (!next) return;
    var sel = document.getElementById(id.slice(0, id.length - suffix.length) + next);
    if (!sel) return;
    sel.innerHTML = '';
    var ph = document.createElement('option');
    ph.value = '';
    ph.textContent = '-- Pilih --';
    sel.appendChild(ph);
    sel.disabled = true;
    resetBelow(sel.id);
  }

  function loadKabupaten(prefix, kodeProv, done) {
    var sel = document.getElementById(prefix + 'Kabupaten');
    if (!sel || !kodeProv) return;
    var rows = (cache.kabupaten || {})[kodeProv] || [];
    fill(sel, rows, '-- Pilih Kabupaten/Kota --');
    sel.disabled = false;
    if (done) done();
  }

  function loadKecamatan(prefix, kodeKab, done) {
    var sel = document.getElementById(prefix + 'Kecamatan');
    if (!sel || !kodeKab) return;
    var rows = (cache.kecamatan || {})[kodeKab.slice(0, 4)] || [];
    fill(sel, rows, '-- Pilih Kecamatan --');
    sel.disabled = false;
    if (done) done();
  }

  function loadDesa(prefix, kodeKec, done) {
    var sel = document.getElementById(prefix + 'Desa');
    if (!sel || !kodeKec) return;
    var kabKey = kodeKec.slice(0, 4);
    var kecKey = kodeKec.slice(0, 6);
    var fillKec = function () {
      var rows = (cache.desa[kabKey] || {})[kecKey] || [];
      fill(sel, rows, '-- Pilih Desa --');
      sel.disabled = false;
      if (done) done();
    };
    if (cache.desa[kabKey]) { fillKec(); return; }
    sel.disabled = true;
    fetchJson('desa/' + kabKey + '.json').then(function (rows) {
      var map = {};
      rows.forEach(function (r) {
        var k = r.kode.slice(0, 6);
        (map[k] = map[k] || []).push(r);
      });
      cache.desa[kabKey] = map;
      fillKec();
    }).catch(function () {
      sel.innerHTML = '';
      var o = document.createElement('option');
      o.value = '';
      o.textContent = 'Data desa tidak tersedia';
      sel.appendChild(o);
      if (done) done();
    });
  }

  function fetchJson(name) {
    return fetch(BASE + name).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    });
  }
})();
