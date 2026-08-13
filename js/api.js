/* ============================================================
   SDMPKS - Klien API (fetch wrapper)
   ============================================================ */
(function () {
  function buildUrl(file, act, params) {
    var url = 'api/' + file + '?act=' + encodeURIComponent(act);
    if (params) {
      for (var k in params) {
        if (!Object.prototype.hasOwnProperty.call(params, k)) continue;
        var v = params[k];
        if (v === '' || v === null || v === undefined) continue;
        url += '&' + encodeURIComponent(k) + '=' + encodeURIComponent(v);
      }
    }
    return url;
  }

  function handle(resp) {
    if (resp.status === 401 && fileOf(resp.url) !== 'auth.php') {
      window.location.href = 'index.html';
      return Promise.reject(new Error('Sesi berakhir.'));
    }
    var ct = (resp.headers.get('content-type') || '').toLowerCase();
    if (ct.indexOf('application/json') === -1) {
      var m = resp.status === 413
        ? 'Server menolak permintaan (HTTP 413). Ukuran request melebihi batas web server/proxy (mis. client_max_body_size nginx / LimitRequestBody Apache).'
        : 'Tanggapan server tidak valid (HTTP ' + resp.status + ' — bukan JSON). ' +
          (resp.status >= 500 ? 'Terjadi kesalahan server. Hubungi administrator.' : 'Coba lagi.');
      console.error('[SDMPKS] Respons non-JSON', resp.status, resp.url);
      var err = new Error(m);
      err.status = resp.status;
      return Promise.reject(err);
    }
    return resp.json().then(function (j) {
      // Simpan token CSRF terbaru bila server mengirimkannya
      // (respons login / me). Dipakai untuk permintaan berikutnya.
      if (j && typeof j.csrf === 'string' && j.csrf) {
        csrf = j.csrf;
      }
      if (!j || j.ok === false) {
        var msg = (j && j.error) || 'Terjadi kesalahan pada server.';
        var err = new Error(msg);
        err.status = resp.status;
        err.code = (j && j.code) || '';
        err.detail = (j && j.detail) || null;
        // Token CSRF basi (sesi kedaluwarsa/berubah): kembali ke halaman masuk.
        if (err.code === 'csrf_invalid' && fileOf(resp.url) !== 'auth.php') {
          window.location.href = 'index.html';
        }
        return Promise.reject(err);
      }
      return j;
    }).catch(function (e) {
      if (e instanceof Error && e.code) throw e;
      console.error('[SDMPKS] Gagal parsing JSON', resp.status, resp.url, e);
      var err = new Error('Tanggapan server tidak valid (HTTP ' + resp.status + '). Hubungi administrator bila berlanjut.');
      err.status = resp.status;
      return Promise.reject(err);
    });
  }

  function fileOf(url) {
    var m = url.match(/\/api\/([a-z]+)\.php/i);
    return m ? m[1] : '';
  }

  var csrf = '';

  function csrfHeaders(base) {
    var h = base || {};
    if (csrf) h['X-CSRF-Token'] = csrf;
    return h;
  }

  window.Api = {
    get: function (file, act, params) {
      return fetch(buildUrl(file, act, params), {
        method: 'GET',
        credentials: 'same-origin',
        headers: { 'X-Requested-With': 'XMLHttpRequest' }
      }).then(handle);
    },
    post: function (file, act, data, params) {
      return fetch(buildUrl(file, act, params), {
        method: 'POST',
        credentials: 'same-origin',
        headers: csrfHeaders({ 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' }),
        body: JSON.stringify(data || {})
      }).then(handle);
    },
    upload: function (file, act, fields) {
      var fd = new FormData();
      var f = fields && fields.file;
      if (f instanceof File) {
        fd.append('file', f);
      }
      if (fields) {
        for (var k in fields) {
          if (!Object.prototype.hasOwnProperty.call(fields, k)) continue;
          var v = fields[k];
          if (v === '' || v === null || v === undefined || k === 'file') continue;
          fd.append(k, v);
        }
      }
      return fetch('api/' + file + '?act=' + encodeURIComponent(act), {
        method: 'POST',
        credentials: 'same-origin',
        headers: csrfHeaders({ 'X-Requested-With': 'XMLHttpRequest' }),
        body: fd
      }).then(handle);
    }
  };

  /* ============================================================
     Lazy-load library CDN (hanya saat benar-benar dibutuhkan)
     ============================================================ */
  var scriptCache = {};

  window.loadScript = function (url) {
    if (scriptCache[url]) return scriptCache[url];
    scriptCache[url] = new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = url;
      s.onload = function () { resolve(); };
      s.onerror = function () { scriptCache[url] = null; reject(new Error('Gagal memuat ' + url)); };
      document.head.appendChild(s);
    });
    return scriptCache[url];
  };

  window.loadChartLib = function () {
    return window.Chart
      ? Promise.resolve()
      : window.loadScript('https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js');
  };

  window.loadExcelLib = function () {
    return window.XLSX
      ? Promise.resolve()
      : window.loadScript('https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js');
  };

  window.loadPdfLib = function () {
    var p = Promise.resolve();
    if (!window.jspdf) {
      p = p.then(function () {
        return window.loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
      });
    }
    if (!window.jspdf || !window.jspdf.jsPDF || !window.jspdf.jsPDF.API || !window.jspdf.jsPDF.API.autoTable) {
      p = p.then(function () {
        return window.loadScript('https://cdn.jsdelivr.net/npm/jspdf-autotable@3.8.2/dist/jspdf.plugin.autotable.min.js');
      });
    }
    if (!window.html2canvas) {
      p = p.then(function () {
        return window.loadScript('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js');
      });
    }
    return p;
  };
})();
