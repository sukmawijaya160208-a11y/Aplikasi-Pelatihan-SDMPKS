/* ============================================================
   SDMPKS - Autentikasi, Toast & Profil
   ============================================================ */
(function () {
  var ROLES = {
    admin: { label: 'Administrator', chip: 'a' },
    dinas: { label: 'Dinas Perkebunan', chip: 'd' },
    lembaga: { label: 'Lembaga Pekebun', chip: 'l' }
  };

  window.AppToast = function (msg, type) {
    var wrap = document.getElementById('toastWrap');
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.id = 'toastWrap';
      document.body.appendChild(wrap);
    }
    var t = document.createElement('div');
    t.className = 'toast ' + (type || 'info');
    t.textContent = msg;
    wrap.appendChild(t);
    setTimeout(function () { t.classList.add('show'); }, 10);
    setTimeout(function () {
      t.classList.remove('show');
      setTimeout(function () { t.remove(); }, 300);
    }, 3400);
  };

  window.AppAuth = {
    ROLES: ROLES,
    _user: null,

    user: function () { return this._user; },
    setUser: function (u) { this._user = u || null; },
    role: function () { var u = this._user; return u ? u.role : null; },
    roleLabel: function () {
      var r = this.role();
      return (r && ROLES[r]) ? ROLES[r].label : '';
    },
    nama: function () {
      var u = this._user;
      return u ? (u.nama || u.username) : '';
    },
    isLembaga: function () { return this.role() === 'lembaga'; },
    isDinas: function () { return this.role() === 'dinas'; },
    isAdmin: function () { return this.role() === 'admin'; },

    /** Pastikan sesi valid; redirect ke halaman masuk jika tidak. */
    ensure: function () {
      var self = this;
      return Api.get('auth.php', 'me').then(function (j) {
        self.setUser(j.user);
        return j.user;
      }).catch(function (e) {
        if (e.status === 401) {
          window.location.href = 'index.html';
          return null;
        }
        throw e;
      });
    },

    login: function (u, p, role) {
      var self = this;
      return Api.post('auth.php', 'login', { username: u, password: p, role: role || '' })
        .then(function (j) { self.setUser(j.user); return j; });
    },

    logout: function () {
      var self = this;
      return Api.post('auth.php', 'logout', {}).then(function () {
        self.setUser(null);
        window.location.href = 'index.html';
      }).catch(function () {
        window.location.href = 'index.html';
      });
    }
  };

  function initials(name) {
    var parts = String(name || '?').trim().split(/\s+/);
    return (parts[0].charAt(0) + (parts[1] ? parts[1].charAt(0) : '')).toUpperCase();
  }

  /* ============ Halaman Masuk ============ */
  function initRoleSegmented() {
    var seg = document.getElementById('roleSeg');
    var roleInput = document.getElementById('loginRole');
    if (!seg || !roleInput) return;
    var btns = seg.querySelectorAll('.seg-btn');
    btns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        roleInput.value = btn.getAttribute('data-role');
        btns.forEach(function (b) {
          var on = b === btn;
          b.classList.toggle('active', on);
          b.setAttribute('aria-pressed', on ? 'true' : 'false');
        });
      });
    });
  }

  function initLoginPage() {
    initRoleSegmented();

    var loginForm = document.getElementById('loginForm');
    if (!loginForm) return;
    var savedUser = localStorage.getItem('sdmpks_remember');
    if (savedUser) {
      document.getElementById('loginUser').value = savedUser;
      var rm = document.getElementById('rememberMe');
      if (rm) rm.checked = true;
    }

    var errBox = document.getElementById('loginError');
    var card = document.getElementById('loginCard');
    var btnLogin = document.getElementById('btnLogin');

    loginForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var u = document.getElementById('loginUser').value.trim();
      var p = document.getElementById('loginPass').value;
      var roleSel = document.getElementById('loginRole');
      var role = roleSel ? roleSel.value : 'lembaga';
      if (!u || !p) {
        errBox.textContent = 'Username dan password wajib diisi.';
        errBox.hidden = false;
        return;
      }
      if (btnLogin) btnLogin.disabled = true;
      errBox.classList.remove('success');
      AppAuth.login(u, p, role).then(function () {
        if (document.getElementById('rememberMe').checked) {
          localStorage.setItem('sdmpks_remember', u);
        } else {
          localStorage.removeItem('sdmpks_remember');
        }
        window.location.href = 'dashboard.html';
      }).catch(function (err) {
        if (btnLogin) btnLogin.disabled = false;
        errBox.textContent = err.message || 'Gagal masuk. Silakan coba lagi.';
        errBox.hidden = false;
        card.classList.remove('shake');
        void card.offsetWidth;
        card.classList.add('shake');
      });
    });

    var tp = document.getElementById('togglePass');
    if (tp) {
      tp.addEventListener('click', function () {
        var inp = document.getElementById('loginPass');
        inp.type = inp.type === 'password' ? 'text' : 'password';
        tp.classList.toggle('active');
      });
    }
  }

  function selectRole(role) {
    var seg = document.getElementById('roleSeg');
    var roleInput = document.getElementById('loginRole');
    if (!seg || !roleInput) return;
    roleInput.value = role;
    var btns = seg.querySelectorAll('.seg-btn');
    btns.forEach(function (b) {
      var on = b.getAttribute('data-role') === role;
      b.classList.toggle('active', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  }

  function showRegister() {
    var loginCard = document.getElementById('loginCard');
    var regCard = document.getElementById('registerCard');
    var regErr = document.getElementById('regError');
    var tahun = document.getElementById('rTahunAnggaran');
    var wrap = document.querySelector('.login-wrap');
    if (wrap) wrap.classList.add('wrap-wide');
    if (tahun && !tahun.value) tahun.value = String(new Date().getFullYear());
    if (regErr) regErr.hidden = true;
    if (loginCard) loginCard.hidden = true;
    if (regCard) regCard.hidden = false;
    var f = document.getElementById('rNamaLembaga');
    if (f) setTimeout(function () { f.focus(); }, 60);
    window.scrollTo(0, 0);
  }

  function showLogin(msg) {
    var loginCard = document.getElementById('loginCard');
    var regCard = document.getElementById('registerCard');
    var errBox = document.getElementById('loginError');
    var wrap = document.querySelector('.login-wrap');
    if (wrap) wrap.classList.remove('wrap-wide');
    if (loginCard) loginCard.hidden = false;
    if (regCard) regCard.hidden = true;
    if (msg && errBox) {
      errBox.textContent = msg;
      errBox.classList.add('success');
      errBox.hidden = false;
    }
  }

  function initRegisterPage() {
    var btnDaftar = document.getElementById('btnDaftar');
    if (btnDaftar) btnDaftar.addEventListener('click', showRegister);

    var btnBack = document.getElementById('btnBackLogin');
    if (btnBack) btnBack.addEventListener('click', function () { showLogin(null); });

    var form = document.getElementById('registerForm');
    if (!form) return;
    var errBox = document.getElementById('regError');
    var btnReg = document.getElementById('btnRegister');
    var regCard = document.getElementById('registerCard');

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var v = function (id) { var el = document.getElementById(id); return el ? el.value.trim() : ''; };
      var nama = v('rNamaLembaga');
      var hp = v('rHp').replace(/[^\d]/g, '');
      var p1 = v('rPassword');
      var p2 = v('rPassword2');
      var tahun = v('rTahunAnggaran');

      if (!nama) { errBox.textContent = 'Nama kelembagaan wajib diisi.'; errBox.hidden = false; return; }
      if (!/^08\d{8,12}$/.test(hp)) { errBox.textContent = 'Nomor HP tidak valid. Gunakan format 08xxxxxxxxxx.'; errBox.hidden = false; return; }
      if (p1.length < 6) { errBox.textContent = 'Password minimal 6 karakter.'; errBox.hidden = false; return; }
      if (p1 !== p2) { errBox.textContent = 'Konfirmasi password tidak sama.'; errBox.hidden = false; return; }
      if (tahun && !/^\d{4}$/.test(tahun)) { errBox.textContent = 'Tahun anggaran tidak valid.'; errBox.hidden = false; return; }

      if (btnReg) btnReg.disabled = true;
      Api.post('register.php', 'register', {
        nama_lembaga: nama,
        jenis_lembaga: v('rJenisLembaga') || 'KOPERASI UNIT DESA (KUD)',
        singkatan: v('rSingkatan'),
        ketua: v('rKetua'),
        jabatan: v('rJabatan'),
        alamat: v('rAlamat'),
        tempat: v('rTempat'),
        kode_surat: v('rKodeSurat'),
        tahun_anggaran: tahun,
        kepala_desa: v('rKepalaDesa'),
        no_hp: hp,
        password: p1
      }).then(function () {
        if (btnReg) btnReg.disabled = false;
        document.getElementById('loginUser').value = hp;
        selectRole('lembaga');
        showLogin('Pendaftaran berhasil. Akun Anda menunggu persetujuan Administrator sebelum dapat masuk.');
        form.reset();
        document.getElementById('rTahunAnggaran').value = String(new Date().getFullYear());
        document.getElementById('rJenisLembaga').value = 'KOPERASI UNIT DESA (KUD)';
      }).catch(function (err) {
        if (btnReg) btnReg.disabled = false;
        errBox.textContent = err.message || 'Pendaftaran gagal. Silakan coba lagi.';
        errBox.hidden = false;
        regCard.classList.remove('shake');
        void regCard.offsetWidth;
        regCard.classList.add('shake');
      });
    });
  }

  /* ============ Dashboard: Profil & Ganti Password ============ */
  function initProfileMenu() {
    var btnProfile = document.getElementById('btnProfile');
    var dd = document.getElementById('pmDropdown');
    if (!btnProfile || !dd) return;

    btnProfile.addEventListener('click', function (e) {
      e.stopPropagation();
      dd.hidden = !dd.hidden;
    });
    document.addEventListener('click', function () { dd.hidden = true; });
    dd.addEventListener('click', function (e) { e.stopPropagation(); });

    dd.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-act]');
      if (!btn) return;
      var act = btn.getAttribute('data-act');
      if (act === 'password') {
        dd.hidden = true;
        var mp = document.getElementById('modalPassword');
        if (mp) {
          mp.hidden = false;
          document.getElementById('pwOld').value = '';
          document.getElementById('pwNew').value = '';
          document.getElementById('pwNew2').value = '';
          setTimeout(function () { document.getElementById('pwOld').focus(); }, 60);
        }
      } else if (act === 'logout') {
        dd.hidden = true;
        AppAuth.logout();
      }
    });

    var mp = document.getElementById('modalPassword');
    if (mp) {
      var closeModal = function () { mp.hidden = true; };
      document.getElementById('btnTutupPassword').addEventListener('click', closeModal);
      document.getElementById('btnBatalPassword').addEventListener('click', closeModal);
      mp.addEventListener('click', function (e) { if (e.target === mp) closeModal(); });
      document.getElementById('btnSimpanPassword').addEventListener('click', function () {
        var old = document.getElementById('pwOld').value;
        var n1 = document.getElementById('pwNew').value;
        var n2 = document.getElementById('pwNew2').value;
        if (!old) { AppToast('Password lama wajib diisi.', 'error'); return; }
        if (n1.length < 6) { AppToast('Password baru minimal 6 karakter.', 'error'); return; }
        if (n1 !== n2) { AppToast('Konfirmasi password baru tidak sama.', 'error'); return; }
        Api.post('auth.php', 'change_password', { old: old, new: n1 }).then(function () {
          mp.hidden = true;
          AppToast('Password berhasil diganti.');
        }).catch(function (err) { AppToast(err.message, 'error'); });
      });
    }

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && mp) mp.hidden = true;
    });
  }

  function initLogoutButton() {
    var btn = document.getElementById('btnLogout');
    if (btn) btn.addEventListener('click', function () { AppAuth.logout(); });
  }

  /* ============ Modal Konfirmasi Custom ============ */
  var confirmCb = null;

  window.AppConfirm = function (message, onYes, opts) {
    var m = document.getElementById('modalConfirm');
    if (!m) { if (window.confirm(message)) onYes(); return; }
    confirmCb = onYes || null;
    document.getElementById('cfTitle').textContent = (opts && opts.title) || 'Konfirmasi';
    document.getElementById('cfMessage').textContent = message;
    var yes = document.getElementById('btnYaConfirm');
    yes.textContent = (opts && opts.yesLabel) || 'Ya, Lanjutkan';
    yes.className = 'btn ' + ((opts && opts.danger === false) ? 'btn-primary' : 'btn-danger');
    m.hidden = false;
  };

  function initConfirmModal() {
    var m = document.getElementById('modalConfirm');
    if (!m) return;
    var close = function () { m.hidden = true; confirmCb = null; };
    document.getElementById('btnTutupConfirm').addEventListener('click', close);
    document.getElementById('btnBatalConfirm').addEventListener('click', close);
    m.addEventListener('click', function (e) { if (e.target === m) close(); });
    document.getElementById('btnYaConfirm').addEventListener('click', function () {
      var cb = confirmCb;
      m.hidden = true;
      confirmCb = null;
      if (cb) cb();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !m.hidden) close();
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    initLoginPage();
    initRegisterPage();
    initProfileMenu();
    initLogoutButton();
    initConfirmModal();
  });
})();
