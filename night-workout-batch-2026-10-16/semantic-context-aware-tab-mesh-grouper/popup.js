// Popup logic: rule-based tab grouping. Honest scope: matches tabs by
// domain and by user keyword rules — no AI, no semantic understanding.

// Group colors cycled across created groups.
var COLORS = ['blue', 'red', 'yellow', 'green', 'pink', 'purple', 'cyan', 'orange', 'grey'];
var colorIdx = 0;

// Extract the registrable-ish host (last two labels) for domain grouping.
function domainOf(url) {
  try {
    var host = new URL(url).hostname;
    var parts = host.split('.');
    return parts.length > 2 ? parts.slice(-2).join('.') : host;
  } catch (e) { return null; }
}

// Storage helpers for rules + options.
function getState() {
  return chrome.storage.local.get({ rules: [], byDomain: true, windowOnly: true });
}
function setStatus(msg) { document.getElementById('status').textContent = msg; }

// Render the keyword rule list.
function renderRules(rules) {
  var box = document.getElementById('rules');
  box.innerHTML = '';
  rules.forEach(function (r, i) {
    var div = document.createElement('div');
    div.className = 'rule';
    var span = document.createElement('span');
    span.textContent = r.name + '  →  ' + r.keywords.join(', ');
    var del = document.createElement('button');
    del.className = 'del'; del.textContent = '×'; del.title = 'Delete rule';
    del.addEventListener('click', function () {
      getState().then(function (s) {
        s.rules.splice(i, 1);
        return chrome.storage.local.set({ rules: s.rules });
      }).then(function () { renderRulesAfterSave(); });
    });
    div.appendChild(span); div.appendChild(del);
    box.appendChild(div);
  });
}
function renderRulesAfterSave() {
  getState().then(function (s) { renderRules(s.rules); });
}

// Group the matching tabs under one title/color.
function makeGroup(tabIds, title) {
  if (!tabIds.length) return Promise.resolve(0);
  return chrome.tabs.group({ tabIds: tabIds }).then(function (groupId) {
    var color = COLORS[colorIdx++ % COLORS.length];
    return chrome.tabGroups.update(groupId, { title: title, color: color }).then(function () {
      return tabIds.length;
    });
  });
}

// Main grouping pass.
function groupTabs() {
  getState().then(function (s) {
    return chrome.tabs.query({}).then(function (allTabs) {
      return chrome.windows.getCurrent().then(function (win) {
        var tabs = s.windowOnly ? allTabs.filter(function (t) { return t.windowId === win.id; }) : allTabs;
        var rules = s.rules.map(function (r) {
          return { name: r.name, keys: r.keywords.map(function (k) { return k.toLowerCase(); }) };
        });
        var assigned = {};   // tabId -> true
        var jobs = [];

        // 1) Keyword rules (user-defined names win).
        rules.forEach(function (r) {
          var ids = tabs.filter(function (t) {
            if (assigned[t.id] || t.pinned) return false;
            var hay = ((t.url || '') + ' ' + (t.title || '')).toLowerCase();
            return r.keys.some(function (k) { return k && hay.indexOf(k) !== -1; });
          }).map(function (t) { return t.id; });
          ids.forEach(function (id) { assigned[id] = true; });
          if (ids.length) jobs.push(makeGroup(ids, r.name));
        });

        // 2) Domain grouping for the rest (if enabled).
        if (s.byDomain) {
          var byDomain = {};
          tabs.forEach(function (t) {
            if (assigned[t.id] || t.pinned) return;
            var d = domainOf(t.url);
            if (!d) return;
            (byDomain[d] = byDomain[d] || []).push(t.id);
          });
          Object.keys(byDomain).forEach(function (d) {
            var ids = byDomain[d];
            if (ids.length >= 2) jobs.push(makeGroup(ids, d));
          });
        }
        return Promise.all(jobs);
      });
    });
  }).then(function (counts) {
    var total = counts.reduce(function (a, b) { return a + b; }, 0);
    setStatus('Grouped ' + total + ' tab' + (total === 1 ? '' : 's') + '.');
  }).catch(function () { setStatus('Grouping failed.'); });
}

// Ungroup everything in scope.
function ungroupAll() {
  chrome.tabs.query({}).then(function (tabs) {
    var ids = tabs.filter(function (t) { return t.groupId > 0; }).map(function (t) { return t.id; });
    if (!ids.length) { setStatus('No grouped tabs.'); return; }
    return chrome.tabs.ungroup(ids).then(function () {
      setStatus('Ungrouped ' + ids.length + ' tab' + (ids.length === 1 ? '' : 's') + '.');
    });
  }).catch(function () { setStatus('Ungroup failed.'); });
}

// Wire up controls.
document.getElementById('group').addEventListener('click', groupTabs);
document.getElementById('ungroup').addEventListener('click', ungroupAll);

document.getElementById('add').addEventListener('click', function () {
  var name = document.getElementById('rname').value.trim();
  var keys = document.getElementById('rkeys').value.split(',')
    .map(function (k) { return k.trim(); }).filter(Boolean);
  if (!name || !keys.length) { setStatus('Enter a name and at least one keyword.'); return; }
  getState().then(function (s) {
    s.rules.push({ name: name, keywords: keys });
    return chrome.storage.local.set({ rules: s.rules });
  }).then(function () {
    document.getElementById('rname').value = '';
    document.getElementById('rkeys').value = '';
    setStatus('Rule added.'); renderRulesAfterSave();
  });
});

document.getElementById('byDomain').addEventListener('change', function (e) {
  chrome.storage.local.set({ byDomain: e.target.checked });
});
document.getElementById('windowOnly').addEventListener('change', function (e) {
  chrome.storage.local.set({ windowOnly: e.target.checked });
});

// Init: load rules + options.
getState().then(function (s) {
  renderRules(s.rules);
  document.getElementById('byDomain').checked = !!s.byDomain;
  document.getElementById('windowOnly').checked = !!s.windowOnly;
});
