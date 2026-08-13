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
  var uploadLimits = null;

  function mb(n) {
    return Math.max(1, Math.round(n / 1048576 * 10) / 10);
  }

  window.AppDokumen = {
    MAX_MB: 5,
    limits: function (force) {
      if (uploadLimits && !force) return Promise.resolve(uploadLimits);
      return Api.get('sysinfo.php', 'upload_limits').then(function (j) {
        uploadLimits = j || null;
        return uploadLimits;
      }).catch(function () {
        uploadLimits = null;
        return null;
      });
    },
    effectiveMax: function () {
      if (!uploadLimits) return 5 * 1024 * 1024;
      var up = uploadLimits.upload_max_filesize_byte || 0;
      var post = uploadLimits.post_max_size_byte || 0;
      var a = up > 0 ? up : Infinity;
      var b = post > 768 * 1024 ? post - 512 * 1024 : post;
      return Math.min(5 * 1024 * 1024, a, b > 0 ? b : Infinity);
    },
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
      return AppDokumen.limits().then(function (lim) {
        var cap = AppDokumen.effectiveMax();
        if (file && file.size > cap) {
          var up = lim ? lim.upload_max_filesize : '';
          var po = lim ? lim.post_max_size : '';
          throw new Error(
            'Batas unggah efektif server saat ini ' + mb(cap) + ' MB (upload_max_filesize=' + up +
            ', post_max_size=' + po + '). File ' + mb(file.size) + ' MB melebihi batas tersebut. ' +
            'Minta administrator menaikkan upload_max_filesize dan post_max_size di php.ini / panel hosting.'
          );
        }
        return Api.upload('dokumen.php', 'upload', { pekebun_id: pekebunId, file: file }).then(function (j) {
          docCache[pekebunId] = undefined;
          return j;
        });
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
