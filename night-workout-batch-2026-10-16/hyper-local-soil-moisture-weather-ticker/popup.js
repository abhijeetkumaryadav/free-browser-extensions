/* Garden Bed Log — popup logic.
   Manual garden logbook. All stats are computed from user-entered data.
   Storage: chrome.storage.local { beds: [], logs: [] }.
   Bed:   { id, name, plant, intervalDays, createdAt }
   Log:   { id, bedId, date (yyyy-mm-dd), watered, amountMl, moisture (1-5|null), weather, note } */
(function () {
  'use strict';

  var BEDS_KEY = 'garden_beds_v1';
  var LOGS_KEY = 'garden_logs_v1';

  // ---- Tabs -----------------------------------------------------------------
  document.querySelectorAll('.tab').forEach(function (tab) {
    tab.addEventListener('click', function () {
      document.querySelectorAll('.tab').forEach(function (t) { t.classList.remove('active'); });
      document.querySelectorAll('.panel').forEach(function (p) { p.classList.remove('active'); });
      tab.classList.add('active');
      document.getElementById('tab-' + tab.dataset.tab).classList.add('active');
    });
  });

  // ---- Storage helpers -------------------------------------------------------
  function loadAll(cb) {
    chrome.storage.local.get([BEDS_KEY, LOGS_KEY], function (res) {
      cb({
        beds: Array.isArray(res[BEDS_KEY]) ? res[BEDS_KEY] : [],
        logs: Array.isArray(res[LOGS_KEY]) ? res[LOGS_KEY] : []
      });
    });
  }
  function saveAll(data, cb) {
    var o = {}; o[BEDS_KEY] = data.beds; o[LOGS_KEY] = data.logs;
    chrome.storage.local.set(o, cb || function () {});
  }

  // ---- Small utils ------------------------------------------------------------
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function todayISO() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function daysBetween(aISO, bISO) {
    var ms = Date.parse(bISO + 'T00:00:00') - Date.parse(aISO + 'T00:00:00');
    return Math.round(ms / 86400000);
  }
  function prettyDate(iso) {
    var d = new Date(iso + 'T00:00:00');
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  }
  var MOISTURE_LABELS = { 1: 'bone dry', 2: 'dry', 3: 'moist', 4: 'wet', 5: 'soggy' };

  // ---- Bed stats ---------------------------------------------------------------
  // Watering interval = gaps between watered logs; avg of last 5 gaps.
  function bedStats(bed, logs) {
    var mine = logs.filter(function (l) { return l.bedId === bed.id; })
      .sort(function (a, b) { return a.date < b.date ? -1 : 1; });
    var watered = mine.filter(function (l) { return l.watered; });
    var lastWatered = watered.length ? watered[watered.length - 1].date : null;
    var daysSince = lastWatered ? daysBetween(lastWatered, todayISO()) : null;

    var gaps = [];
    for (var i = 1; i < watered.length && gaps.length < 5; i++) {
      gaps.push(daysBetween(watered[i - 1].date, watered[i].date));
    }
    var avgGap = gaps.length ? (gaps.reduce(function (a, b) { return a + b; }, 0) / gaps.length) : null;

    var interval = bed.intervalDays || 3;
    var status = 'ok', statusText = 'OK';
    if (daysSince === null) { status = 'due'; statusText = 'No data yet'; }
    else if (daysSince > interval * 1.5) { status = 'overdue'; statusText = 'Overdue'; }
    else if (daysSince >= interval) { status = 'due'; statusText = 'Due'; }

    return { lastWatered: lastWatered, daysSince: daysSince, avgGap: avgGap, status: status, statusText: statusText, count: mine.length };
  }

  // ---- Rendering -----------------------------------------------------------------
  function renderDashboard(data) {
    var wrap = document.getElementById('bedCards');
    wrap.innerHTML = '';
    if (!data.beds.length) {
      wrap.innerHTML = '<div class="card empty">No beds yet — add one in the Beds tab.</div>';
    } else {
      data.beds.forEach(function (bed) {
        var st = bedStats(bed, data.logs);
        var card = document.createElement('div');
        card.className = 'bed-card';
        card.innerHTML =
          '<div class="head"><div><div class="name">' + esc(bed.name) + '</div>' +
          (bed.plant ? '<div class="plant">' + esc(bed.plant) + '</div>' : '') + '</div>' +
          '<span class="status-chip ' + st.status + '">' + esc(st.statusText) + '</span></div>' +
          '<div class="stats">' +
          '<span>Last watered<b>' + (st.lastWatered ? esc(prettyDate(st.lastWatered)) : '—') + '</b></span>' +
          '<span>Days since<b>' + (st.daysSince === null ? '—' : st.daysSince) + '</b></span>' +
          '<span>Avg interval<b>' + (st.avgGap === null ? '—' : st.avgGap.toFixed(1) + 'd') + '</b></span>' +
          '<span>Target<b>every ' + (bed.intervalDays || 3) + 'd</b></span>' +
          '</div>';
        wrap.appendChild(card);
      });
    }

    // Latest weather notes (user-typed), newest first, up to 5.
    var wl = document.getElementById('weatherList');
    wl.innerHTML = '';
    var withWeather = data.logs.filter(function (l) { return l.weather && l.weather.trim(); })
      .sort(function (a, b) { return a.date < b.date ? 1 : -1; }).slice(0, 5);
    if (!withWeather.length) {
      wl.innerHTML = '<li class="empty">No weather notes yet — they appear when you log them.</li>';
    } else {
      var bedById = {};
      data.beds.forEach(function (b) { bedById[b.id] = b.name; });
      withWeather.forEach(function (l) {
        var li = document.createElement('li');
        li.innerHTML = '<span class="wdate">' + esc(prettyDate(l.date)) + '</span>' +
          esc(bedById[l.bedId] || 'Bed') + ': ' + esc(l.weather);
        wl.appendChild(li);
      });
    }
  }

  function renderLogTab(data) {
    var sel = document.getElementById('logBed');
    sel.innerHTML = '';
    data.beds.forEach(function (b) {
      var o = document.createElement('option');
      o.value = b.id; o.textContent = b.name;
      sel.appendChild(o);
    });
    if (!data.beds.length) {
      var o2 = document.createElement('option');
      o2.textContent = 'Add a bed first';
      sel.appendChild(o2);
    }

    var ul = document.getElementById('entryList');
    ul.innerHTML = '';
    var recent = data.logs.slice().sort(function (a, b) { return a.date < b.date ? 1 : -1; }).slice(0, 15);
    if (!recent.length) {
      ul.innerHTML = '<li class="empty">No entries yet.</li>';
      return;
    }
    var bedById = {};
    data.beds.forEach(function (b) { bedById[b.id] = b.name; });
    recent.forEach(function (l) {
      var li = document.createElement('li');
      var bits = [];
      bits.push(l.watered ? '💧 watered' + (l.amountMl ? ' ' + l.amountMl + 'ml' : '') : 'no watering');
      if (l.moisture) bits.push('soil: ' + MOISTURE_LABELS[l.moisture]);
      if (l.note) bits.push(esc(l.note));
      li.innerHTML = '<span class="edate">' + esc(prettyDate(l.date)) + '</span>' +
        '<strong>' + esc(bedById[l.bedId] || 'Bed') + '</strong> — ' + bits.join(' · ');
      ul.appendChild(li);
    });
  }

  function renderBedsTab(data) {
    var ul = document.getElementById('bedList');
    ul.innerHTML = '';
    if (!data.beds.length) {
      ul.innerHTML = '<li class="empty">No beds yet.</li>';
      return;
    }
    data.beds.forEach(function (bed) {
      var li = document.createElement('li');
      li.innerHTML = '<span class="bname">' + esc(bed.name) +
        (bed.plant ? '<span class="bmeta">' + esc(bed.plant) + ' · every ' + (bed.intervalDays || 3) + 'd</span>' : '<span class="bmeta">every ' + (bed.intervalDays || 3) + 'd</span>') + '</span>' +
        '<button class="icon-btn del" title="Delete bed and its entries"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>';
      li.querySelector('.del').addEventListener('click', function () {
        if (!confirm('Delete "' + bed.name + '" and all its log entries?')) return;
        loadAll(function (d2) {
          d2.beds = d2.beds.filter(function (b) { return b.id !== bed.id; });
          d2.logs = d2.logs.filter(function (l) { return l.bedId !== bed.id; });
          saveAll(d2, refresh);
        });
      });
      ul.appendChild(li);
    });
  }

  function refresh() {
    loadAll(function (data) {
      renderDashboard(data);
      renderLogTab(data);
      renderBedsTab(data);
    });
  }

  // ---- Actions ---------------------------------------------------------------------
  document.getElementById('addBedBtn').addEventListener('click', function () {
    var name = document.getElementById('bedName').value.trim();
    if (!name) return;
    var plant = document.getElementById('bedPlant').value.trim();
    var interval = Math.max(1, Math.min(60, parseInt(document.getElementById('bedInterval').value, 10) || 3));
    loadAll(function (data) {
      data.beds.push({ id: 'b' + Date.now(), name: name, plant: plant, intervalDays: interval, createdAt: Date.now() });
      saveAll(data, function () {
        document.getElementById('bedName').value = '';
        document.getElementById('bedPlant').value = '';
        refresh();
      });
    });
  });

  document.getElementById('saveLogBtn').addEventListener('click', function () {
    var bedId = document.getElementById('logBed').value;
    if (!bedId) return;
    var entry = {
      id: 'l' + Date.now(),
      bedId: bedId,
      date: document.getElementById('logDate').value || todayISO(),
      watered: document.getElementById('logWatered').checked,
      amountMl: parseInt(document.getElementById('logAmount').value, 10) || null,
      moisture: parseInt(document.getElementById('logMoisture').value, 10) || null,
      weather: document.getElementById('logWeather').value.trim(),
      note: document.getElementById('logNote').value.trim()
    };
    loadAll(function (data) {
      data.logs.push(entry);
      saveAll(data, function () {
        document.getElementById('logAmount').value = '';
        document.getElementById('logWeather').value = '';
        document.getElementById('logNote').value = '';
        document.getElementById('logMoisture').value = '';
        refresh();
      });
    });
  });

  document.getElementById('logDate').value = todayISO();
  refresh();
})();
