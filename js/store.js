/* ============================================================
   SDMPKS - Store Terpusat (server-backed)
   AppData (pekebun), AppLetter (arsip surat), AppSettings (pengaturan)
   ============================================================ */
(function () {
  /* ============ AppData : Data Pekebun ============ */
  var rows = null;
  var loading = null;

  window.AppData = {
    get: function () { return rows || []; },
    getById: function (id) {
      var list = AppData.get();
      for (var i = 0; i < list.length; i++) {
        if (String(list[i].id) === String(id)) return list[i];
      }
      return null;
    },
    load: function (force) {
      if (!force && rows) return Promise.resolve(rows);
      if (loading) return loading;
      loading = Api.get('pekebun.php', 'list').then(function (j) {
        rows = j.rows || [];
        loading = null;
        return rows;
      }, function (e) {
        loading = null;
        throw e;
      });
      return loading;
    },
    reload: function () { return AppData.load(true); },
    add: function (data) {
      return Api.post('pekebun.php', 'save', data).then(function (j) {
        return AppData.load(true).then(function () { return j; });
      });
    },
    update: function (data) {
      return Api.post('pekebun.php', 'save', data).then(function (j) {
        return AppData.load(true).then(function () { return j; });
      });
    },
    remove: function (id) {
      return Api.post('pekebun.php', 'delete', { id: id }).then(function (j) {
        rows = (rows || []).filter(function (p) { return String(p.id) !== String(id); });
        return j;
      });
    },
    import: function (list, lembagaId) {
      return Api.post('pekebun.php', 'import', { rows: list, lembaga_id: lembagaId || 0 }).then(function (j) {
        return AppData.load(true).then(function () { return j; });
      });
    }
  };

  /* ============ AppDokumen : Dokumen (PDF) Pekebun ============ */
  var docCache = {};

  window.AppDokumen = {
    MAX_MB: 5,
    url: function (id) {
      return 'api/dokumen.php?act=download&id=' + encodeURIComponent(id);
    },
    list: function (pekebunId) {
      return Api.get('dokumen.php', 'list', { pekebun_id: pekebunId }).then(function (j) {
        docCache[pekebunId] = j.rows || [];
        return docCache[pekebunId];
      });
    },
    count: function (pekebunId) {
      if (docCache[pekebunId] !== undefined) {
        return Promise.resolve(docCache[pekebunId].length);
      }
      return AppDokumen.list(pekebunId).then(function (rows) { return rows.length; });
    },
    upload: function (file, pekebunId) {
      return Api.upload('dokumen.php', 'upload', { pekebun_id: pekebunId, file: file }).then(function (j) {
        docCache[pekebunId] = undefined;
        return j;
      });
    },
    hapus: function (id, pekebunId) {
      return Api.post('dokumen.php', 'hapus', { id: id }).then(function (j) {
        docCache[pekebunId] = undefined;
        return j;
      });
    }
  };

  /* ============ AppLetter : Arsip Surat ============ */
  var letters = [];
  var lettersLoaded = false;

  window.AppLetter = {
    get: function () { return letters; },
    load: function (force, params) {
      if (!force && lettersLoaded && !params) return Promise.resolve(letters);
      return Api.get('surat.php', 'list', params || {}).then(function (j) {
        letters = j.rows || [];
        lettersLoaded = true;
        return letters;
      });
    },
    add: function (rec) {
      return Api.post('surat.php', 'save', rec).then(function (j) {
        return AppLetter.load(true).then(function () { return j; });
      });
    },
    remove: function (id) {
      return Api.post('surat.php', 'delete', { id: id }).then(function (j) {
        letters = letters.filter(function (x) { return String(x.id) !== String(id); });
        return j;
      });
    }
  };

  /* ============ AppSettings : Pengaturan Kelembagaan ============ */
  var DEFAULTS = {
    jenis_lembaga: 'KOPERASI UNIT DESA (KUD)',
    singkatan: 'KUD SARI SUBUR',
    nama_lembaga: 'KOPERASI UNIT DESA SARI SUBUR',
    ketua: 'PARJIMAN',
    jabatan: 'Ketua',
    ketua_hp: '',
    alamat: 'Desa Tegal Sari Kecamatan Megang Sakti Kabupaten Musi Rawas Provinsi Sumatera Selatan',
    tempat: 'Megang Sakti',
    kode_surat: 'KUD-SS/MURA',
    kode_surat_desa: '',
    tahun_anggaran: '2025',
    batas_usulan: '',
    kepala_desa: '',
    nama_desa: '',
    kepala_desa_hp: '',
    desa_alamat: '',
    logo: '',
    logo_desa: ''
  };

  var settingsCache = {};
  var settingsLoaded = {};

  function defaultsFor() {
    var out = {};
    for (var k in DEFAULTS) out[k] = DEFAULTS[k];
    return out;
  }

  window.AppSettings = {
    defaults: DEFAULTS,
    isLoaded: function (lembagaId) { return !!settingsLoaded[lembagaId || 0]; },
    get: function (lembagaId) {
      var s = settingsCache[lembagaId || 0] || defaultsFor();
      var out = defaultsFor();
      for (var k in s) if (out[k] !== undefined) out[k] = s[k];
      return out;
    },
    load: function (lembagaId) {
      var params = {};
      if (lembagaId) params.lembaga_id = lembagaId;
      return Api.get('settings.php', 'get', params).then(function (j) {
        var s = j.settings || {};
        settingsCache[lembagaId || 0] = s;
        settingsLoaded[lembagaId || 0] = true;
        return s;
      });
    },
    save: function (s, lembagaId) {
      var params = {};
      if (lembagaId) params.lembaga_id = lembagaId;
      return Api.post('settings.php', 'save', s, params).then(function (j) {
        settingsCache[lembagaId || 0] = s;
        settingsLoaded[lembagaId || 0] = true;
        return j;
      });
    },
    saveLogo: function (logo, lembagaId, target) {
      var kolom = target === 'desa' ? 'logo_desa' : 'logo';
      var params = {};
      if (lembagaId) params.lembaga_id = lembagaId;
      return Api.post('settings.php', 'logo', { logo: logo || '', jenis: target === 'desa' ? 'desa' : '' }, params).then(function (j) {
        var s = AppSettings.get(lembagaId);
        s[kolom] = logo || '';
        settingsCache[lembagaId || 0] = s;
        settingsLoaded[lembagaId || 0] = true;
        return j;
      });
    }
  };
})();
