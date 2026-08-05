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
      var pria = stats.pria || 0;
      var wanita = stats.wanita || 0;
      var bulanan = {};
      (stats.bulanan || []).forEach(function (b) { bulanan[b.bulan] = Number(b.n) || 0; });

      var ctx1 = document.getElementById('chartJK');
      if (ctx1) {
        if (window._chartJK) window._chartJK.destroy();
        window._chartJK = new Chart(ctx1, {
          type: 'pie',
          data: {
            labels: ['LAKI-LAKI', 'PEREMPUAN'],
            datasets: [{
              data: [pria, wanita],
              backgroundColor: ['#0f7a54', '#f59e0b'],
              borderColor: '#fff',
              borderWidth: 2
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { position: 'bottom', labels: { boxWidth: 14, padding: 16, font: { size: 12, weight: '600' } } } }
          }
        });
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
