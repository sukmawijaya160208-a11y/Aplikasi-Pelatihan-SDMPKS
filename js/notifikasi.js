/* ============================================================
   SDMPKS - Notifikasi (bell + polling near real-time)
   Polling: 20 detik, jeda saat tab hidden
   ============================================================ */
(function () {
  if (!window.AppAuth || !window.Api) return;

  var POLL = 30000;
  var timer = null;
  var lastUnread = -1;
  var panelOpen = false;

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  var ICON = { info: 'i', sukses: 's', peringatan: 'w', error: 'e' };

  function setBadge(n) {
    var b = document.getElementById('notifBadge');
    if (!b) return;
    n = Number(n) || 0;
    b.textContent = n > 99 ? '99+' : String(n);
    b.hidden = n <= 0;
  }

  function itemHtml(n) {
    var t = ICON[n.tipe] || 'i';
    var ico = t === 'i' ? '!' : t === 's' ? '\u2713' : t === 'w' ? '!' : '\u2715';
    return '<button type="button" class="notif-item' + (n.dibaca ? '' : ' unread') +
      '" data-id="' + n.id + '" data-link="' + esc(n.link || '') + '">' +
      '<span class="notif-ico t-' + t + '">' + ico + '</span>' +
      '<span class="notif-txt"><strong>' + esc(n.judul) + '</strong>' +
      (n.pesan ? '<span>' + esc(n.pesan) + '</span>' : '') +
      '<em>' + esc(n.waktu_label || '') + '</em></span></button>';
  }

  function renderList(rows) {
    var list = document.getElementById('notifList');
    if (!list) return;
    if (!rows || !rows.length) {
      list.innerHTML = '<div class="notif-empty">Tidak ada notifikasi.</div>';
      return;
    }
    list.innerHTML = rows.map(itemHtml).join('');
  }

  function refreshList() {
    Api.get('notifikasi.php', 'list').then(function (j) {
      renderList(j.rows || []);
    }).catch(function () {});
  }

  function refreshCount(silent) {
    if (silent && document.hidden) return;
    Api.get('notifikasi.php', 'count').then(function (j) {
      var unread = Number(j.unread) || 0;
      if (!silent && lastUnread >= 0 && unread > lastUnread) {
        AppToast('Ada notifikasi baru.', 'info');
        if (panelOpen) refreshList();
      }
      lastUnread = unread;
      setBadge(unread);
    }).catch(function () {});
  }

  function toggle(forceOpen) {
    var panel = document.getElementById('notifPanel');
    if (!panel) return;
    panelOpen = (forceOpen === undefined) ? !panelOpen : !!forceOpen;
    panel.hidden = !panelOpen;
    if (panelOpen) refreshList();
  }

  function goLink(link) {
    var parts = String(link || '').split('?');
    var params = {};
    if (parts[1]) {
      parts[1].split('&').forEach(function (kv) {
        var p = kv.split('=');
        if (p[0]) params[decodeURIComponent(p[0])] = decodeURIComponent(p[1] || '');
      });
    }
    var page = parts[0] || 'dashboard';
    if (window.AppGo) AppGo(page, params);
    else window.location.href = 'dashboard.html#' + page;
  }

  function init() {
    var bell = document.getElementById('btnNotif');
    if (!bell) return;

    setBadge(0);
    refreshCount(true);

    bell.addEventListener('click', function (e) {
      e.stopPropagation();
      toggle();
    });

    document.addEventListener('click', function (e) {
      var wrap = document.getElementById('notifWrap');
      if (panelOpen && wrap && !wrap.contains(e.target)) toggle(false);
    });

    var list = document.getElementById('notifList');
    list.addEventListener('click', function (e) {
      var item = e.target.closest('.notif-item');
      if (!item) return;
      var id = Number(item.getAttribute('data-id')) || 0;
      var link = item.getAttribute('data-link') || '';
      Api.post('notifikasi.php', 'baca', { id: id }).then(function () {
        if (lastUnread > 0) { lastUnread--; setBadge(lastUnread); }
        if (link) {
          toggle(false);
          goLink(link);
        } else {
          refreshList();
        }
      }).catch(function () {});
    });

    document.getElementById('btnNotifSemua').addEventListener('click', function () {
      Api.post('notifikasi.php', 'baca', {}).then(function () {
        lastUnread = 0;
        setBadge(0);
        refreshList();
      }).catch(function () {});
    });

    timer = setInterval(function () { refreshCount(false); }, POLL);

    document.addEventListener('visibilitychange', function () {
      if (!document.hidden) refreshCount(true);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
