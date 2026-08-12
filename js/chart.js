(function () {
  var BULAN_PENDEK = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

  function monthKeys() {
    var out = [];
    var now = new Date();
    for (var i = 5; i >= 0; i--) {
      var d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      out.push({
        key: d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2),
        label: BULAN_PENDEK[d.getMonth()] + ' ' + String(d.getFullYear()).slice(2)
      });
    }
    return out;
  }

  window.AppChart = {
    draw: function (stats) {
      if (!window.Chart) return;
      stats = stats || {};
      var bulanan = {};
      (stats.bulanan || []).forEach(function (b) { bulanan[b.bulan] = Number(b.n) || 0; });

      var ctx1 = document.getElementById('chartJK');
      if (ctx1) {
        if (window._chartJK) window._chartJK.destroy();
        var empty1 = document.getElementById('chartJKEmpty');
        var pel = (stats.stats && stats.stats.per_pelatihan) || stats.per_pelatihan || [];
        var isEmpty = !pel.length;
        if (empty1) empty1.hidden = !isEmpty;
        ctx1.style.display = isEmpty ? 'none' : 'block';
        if (!isEmpty) {
          var PALET = ['#0f7a54', '#16a34a', '#f59e0b', '#6366f1', '#0ea5e9', '#ef4444', '#9333ea', '#d97706'];
          var labels = pel.map(function (x) { return x.jenis_pelatihan || '-'; });
          window._chartJK = new Chart(ctx1, {
            type: 'bar',
            data: {
              labels: labels,
              datasets: [{
                label: 'Peserta',
                data: pel.map(function (x) { return Number(x.n) || 0; }),
                backgroundColor: labels.map(function (_, i) { return PALET[i % PALET.length]; }),
                borderRadius: 6,
                maxBarThickness: 30
              }]
            },
            options: {
              indexAxis: 'y',
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: { display: false },
                tooltip: { callbacks: { label: function (c) { return ' ' + c.parsed.x + ' orang'; } } }
              },
              scales: {
                x: { beginAtZero: true, ticks: { precision: 0, font: { size: 11 } }, grid: { color: '#eef2f1' } },
                y: { ticks: { font: { size: 11, weight: '600' } }, grid: { display: false } }
              }
            }
          });
        }
      }

      var ctx2 = document.getElementById('chartBulan');
      if (ctx2) {
        var mks = monthKeys();
        if (window._chartBulan) window._chartBulan.destroy();
        window._chartBulan = new Chart(ctx2, {
          type: 'bar',
          data: {
            labels: mks.map(function (m) { return m.label; }),
            datasets: [{
              label: 'Pekebun',
              data: mks.map(function (m) { return bulanan[m.key] || 0; }),
              backgroundColor: '#16a34a',
              hoverBackgroundColor: '#0c5f43',
              borderRadius: 6,
              maxBarThickness: 42
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
              y: { beginAtZero: true, ticks: { precision: 0, font: { size: 11 } }, grid: { color: '#eef2f1' } },
              x: { ticks: { font: { size: 11, weight: '600' } }, grid: { display: false } }
            }
          }
        });
      }
    }
  };
})();
