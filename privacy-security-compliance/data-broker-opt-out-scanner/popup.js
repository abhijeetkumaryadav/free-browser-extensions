/* Data Broker Opt-Out Scanner — popup logic.
 * Curated broker directory + personal status checklist, all in
 * chrome.storage.local. Honest scope: a tracker, never a scraper.
 */
(function () {
  'use strict';

  var STORE_KEY = 'brokers';

  // Curated directory of major data brokers with their official opt-out pages.
  // Links verified as the brokers' published opt-out / suppression endpoints.
  var DEFAULT_BROKERS = [
    { id: 'spokeo',          name: 'Spokeo',             url: 'https://www.spokeo.com/optout' },
    { id: 'beenverified',    name: 'BeenVerified',       url: 'https://www.beenverified.com/app/optout/search' },
    { id: 'whitepages',      name: 'Whitepages',         url: 'https://www.whitepages.com/suppression_requests' },
    { id: 'intelius',        name: 'Intelius',           url: 'https://www.intelius.com/opt-out' },
    { id: 'truthfinder',     name: 'TruthFinder',        url: 'https://www.truthfinder.com/opt-out' },
    { id: 'peoplefinders',   name: 'PeopleFinders',      url: 'https://www.peoplefinders.com/opt-out' },
    { id: 'ussearch',        name: 'USSearch',           url: 'https://www.ussearch.com/opt-out' },
    { id: 'peekyou',         name: 'PeekYou',            url: 'https://www.peekyou.com/about/contact/optout/' },
    { id: 'mylife',          name: 'MyLife',             url: 'https://www.mylife.com/ccpa' },
    { id: 'instantcheckmate', name: 'Instant Checkmate',  url: 'https://www.instantcheckmate.com/opt-out' },
    { id: 'checkpeople',     name: 'CheckPeople',        url: 'https://www.checkpeople.com/opt-out' },
    { id: 'clustrmaps',      name: 'ClustrMaps',         url: 'https://clustrmaps.com/bl/opt-out' },
    { id: 'radaris',         name: 'Radaris',            url: 'https://radaris.com/control/privacy' },
    { id: 'fastpeoplesearch', name: 'FastPeopleSearch',   url: 'https://www.fastpeoplesearch.com/removal' },
    { id: 'nuwber',          name: 'Nuwber',             url: 'https://nuwber.com/removal/link' },
    { id: 'thatsthem',       name: "ThatsThem",          url: 'https://thatsthem.com/optout' }
  ];

  var STATUS_LABEL = {
    'not-started': 'Not started',
    'submitted': 'Submitted',
    'confirmed': 'Confirmed'
  };
  // Status cycle order when clicking the status button.
  var NEXT_STATUS = {
    'not-started': 'submitted',
    'submitted': 'confirmed',
    'confirmed': 'not-started'
  };

  var brokers = [];       // [{id,name,url,status,reminder,custom}]
  var editingId = null;   // broker id being edited, or null for "add"

  var els = {};
  ['progressCount', 'progressFill', 'statNotStarted', 'statSubmitted',
   'statConfirmed', 'statDue', 'searchInput', 'addBtn', 'brokerList',
   'modalBackdrop', 'modalTitle', 'brokerName', 'brokerUrl',
   'modalCancel', 'modalSave'].forEach(function (id) { els[id] = document.getElementById(id); });

  /* ---------- storage ---------- */
  function blankBroker(def) {
    return {
      id: def.id, name: def.name, url: def.url,
      status: 'not-started', reminder: null, custom: false
    };
  }

  function load() {
    return new Promise(function (resolve) {
      chrome.storage.local.get({ brokers: null }, function (res) {
        if (Array.isArray(res.brokers) && res.brokers.length) {
          brokers = res.brokers;
        } else {
          brokers = DEFAULT_BROKERS.map(blankBroker);
          save();
        }
        resolve();
      });
    });
  }

  function save() {
    return new Promise(function (resolve) {
      chrome.storage.local.set({ brokers: brokers }, resolve);
    });
  }

  /* ---------- helpers ---------- */
  function isDue(b) {
    if (!b.reminder || b.status === 'confirmed') return false;
    var today = new Date(); today.setHours(0, 0, 0, 0);
    return new Date(b.reminder + 'T00:00:00') <= today;
  }

  function fmtReminder(iso) {
    try {
      return new Date(iso + 'T00:00:00').toLocaleDateString(undefined, {
        month: 'short', day: 'numeric', year: 'numeric'
      });
    } catch (e) { return iso; }
  }

  function uid() {
    return 'custom-' + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36);
  }

  /* ---------- stats ---------- */
  function renderStats() {
    var total = brokers.length;
    var counts = { 'not-started': 0, 'submitted': 0, 'confirmed': 0 };
    var due = 0;
    brokers.forEach(function (b) {
      counts[b.status] = (counts[b.status] || 0) + 1;
      if (isDue(b)) due++;
    });
    els.progressCount.textContent = counts.confirmed + ' / ' + total;
    els.progressFill.style.width = total ? (counts.confirmed / total * 100) + '%' : '0';
    els.statNotStarted.textContent = counts['not-started'];
    els.statSubmitted.textContent = counts.submitted;
    els.statConfirmed.textContent = counts.confirmed;
    els.statDue.textContent = due;
  }

  /* ---------- list ---------- */
  function renderList() {
    var q = els.searchInput.value.trim().toLowerCase();
    els.brokerList.innerHTML = '';
    var shown = brokers.filter(function (b) {
      return !q || b.name.toLowerCase().indexOf(q) >= 0;
    });
    if (!shown.length) {
      var empty = document.createElement('p');
      empty.className = 'disclaimer';
      empty.textContent = q ? 'No brokers match your search.' : 'No brokers yet — add one.';
      els.brokerList.appendChild(empty);
      return;
    }
    // Due reminders first, then by name.
    shown.sort(function (a, b) {
      var da = isDue(a) ? 0 : 1, db = isDue(b) ? 0 : 1;
      return da - db || a.name.localeCompare(b.name);
    });

    shown.forEach(function (b) {
      var card = document.createElement('div');
      card.className = 'broker';

      var top = document.createElement('div');
      top.className = 'broker-top';
      var name = document.createElement('span');
      name.className = 'broker-name';
      name.textContent = b.name;
      name.title = b.name;
      var badge = document.createElement('span');
      badge.className = 'badge ' + b.status;
      badge.textContent = STATUS_LABEL[b.status];
      top.appendChild(name);
      top.appendChild(badge);
      card.appendChild(top);

      var actions = document.createElement('div');
      actions.className = 'broker-actions';

      // Open official opt-out page.
      var openBtn = document.createElement('button');
      openBtn.className = 'btn btn-ghost';
      openBtn.textContent = 'Open opt-out page';
      openBtn.addEventListener('click', function () {
        chrome.tabs.create({ url: b.url });
      });
      actions.appendChild(openBtn);

      // Cycle status.
      var statusBtn = document.createElement('button');
      statusBtn.className = 'btn btn-ghost';
      statusBtn.textContent = 'Mark: ' + STATUS_LABEL[NEXT_STATUS[b.status]];
      statusBtn.addEventListener('click', function () {
        b.status = NEXT_STATUS[b.status];
        if (b.status === 'confirmed') b.reminder = null;
        save().then(refresh);
        chrome.runtime.sendMessage({ type: 'dbos-check-now' });
      });
      actions.appendChild(statusBtn);

      // Reminder toggle: set for 30 days out, or clear.
      var remBtn = document.createElement('button');
      remBtn.className = 'btn btn-ghost';
      remBtn.textContent = b.reminder ? 'Clear reminder' : 'Remind in 30 days';
      remBtn.addEventListener('click', function () {
        if (b.reminder) {
          b.reminder = null;
        } else {
          var d = new Date();
          d.setDate(d.getDate() + 30);
          b.reminder = d.toISOString().slice(0, 10);
        }
        save().then(refresh);
        chrome.runtime.sendMessage({ type: 'dbos-check-now' });
      });
      actions.appendChild(remBtn);

      // Edit (custom brokers) / delete.
      if (b.custom) {
        var editBtn = document.createElement('button');
        editBtn.className = 'btn-icon';
        editBtn.textContent = '✎';
        editBtn.title = 'Edit';
        editBtn.setAttribute('aria-label', 'Edit ' + b.name);
        editBtn.addEventListener('click', function () { openModal(b.id); });
        actions.appendChild(editBtn);
      }
      var delBtn = document.createElement('button');
      delBtn.className = 'btn-icon danger';
      delBtn.textContent = '🗑';
      delBtn.title = b.custom ? 'Delete' : 'Hide from list';
      delBtn.setAttribute('aria-label', 'Remove ' + b.name);
      delBtn.addEventListener('click', function () {
        if (confirm('Remove "' + b.name + '" from your list?')) {
          brokers = brokers.filter(function (x) { return x.id !== b.id; });
          save().then(refresh);
        }
      });
      actions.appendChild(delBtn);

      card.appendChild(actions);

      if (b.reminder) {
        var rem = document.createElement('div');
        var due = isDue(b);
        rem.className = 'reminder' + (due ? ' overdue' : '');
        rem.textContent = (due ? '⚠ Follow-up due since ' : '⏰ Reminder: ') + fmtReminder(b.reminder);
        card.appendChild(rem);
      }

      els.brokerList.appendChild(card);
    });
  }

  function refresh() {
    renderStats();
    renderList();
  }

  /* ---------- modal (add / edit) ---------- */
  function openModal(id) {
    editingId = id || null;
    els.modalTitle.textContent = id ? 'Edit broker' : 'Add broker';
    var b = id ? brokers.find(function (x) { return x.id === id; }) : null;
    els.brokerName.value = b ? b.name : '';
    els.brokerUrl.value = b ? b.url : '';
    els.modalBackdrop.hidden = false;
    els.brokerName.focus();
  }

  function closeModal() {
    els.modalBackdrop.hidden = true;
    editingId = null;
  }

  els.addBtn.addEventListener('click', function () { openModal(null); });
  els.modalCancel.addEventListener('click', closeModal);
  els.modalBackdrop.addEventListener('click', function (e) {
    if (e.target === els.modalBackdrop) closeModal();
  });
  els.modalSave.addEventListener('click', function () {
    var name = els.brokerName.value.trim();
    var url = els.brokerUrl.value.trim();
    if (!name || !url) { els.brokerName.focus(); return; }
    if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
    if (editingId) {
      var b = brokers.find(function (x) { return x.id === editingId; });
      if (b) { b.name = name; b.url = url; }
    } else {
      brokers.push({ id: uid(), name: name, url: url, status: 'not-started', reminder: null, custom: true });
    }
    save().then(function () { closeModal(); refresh(); });
  });

  els.searchInput.addEventListener('input', renderList);

  /* ---------- init ---------- */
  load().then(refresh);
})();
