/* Worker Route Tester — fires requests ONLY at URLs the user types. All on-device. */
'use strict';

const $ = (id) => document.getElementById(id);
const baseUrlEl = $('baseUrl'), methodEl = $('method'), timeoutEl = $('timeout'), pathsEl = $('paths');
const runBtn = $('runBtn'), clearBtn = $('clearBtn'), exportBtn = $('exportBtn'), saveSuiteBtn = $('saveSuiteBtn');
const resultsEl = $('results'), summaryEl = $('summary'), suitesEl = $('suites');

let lastResults = []; // [{path, url, status, ms, headers, error}]

/* ---------- storage: restore last session + suites ---------- */
chrome.storage.local.get(['wrtBase', 'wrtMethod', 'wrtTimeout', 'wrtPaths', 'wrtSuites'], (d) => {
  if (d.wrtBase) baseUrlEl.value = d.wrtBase;
  if (d.wrtMethod) methodEl.value = d.wrtMethod;
  if (d.wrtTimeout) timeoutEl.value = d.wrtTimeout;
  if (d.wrtPaths) pathsEl.value = d.wrtPaths;
  renderSuites(d.wrtSuites || []);
});
[baseUrlEl, methodEl, timeoutEl, pathsEl].forEach((el) =>
  el.addEventListener('input', () => chrome.storage.local.set({
    wrtBase: baseUrlEl.value, wrtMethod: methodEl.value,
    wrtTimeout: timeoutEl.value, wrtPaths: pathsEl.value
  }))
);

/* ---------- run tests ---------- */
runBtn.addEventListener('click', async () => {
  const base = baseUrlEl.value.trim().replace(/\/+$/, '');
  const paths = pathsEl.value.split('\n').map((p) => p.trim()).filter(Boolean);
  if (!base) return flash(baseUrlEl);
  if (!paths.length) return flash(pathsEl);
  let timeoutSec = Math.min(60, Math.max(2, parseInt(timeoutEl.value, 10) || 15));

  runBtn.disabled = true;
  runBtn.textContent = 'Running…';
  lastResults = [];
  resultsEl.innerHTML = '';

  for (const path of paths) {
    const url = base + (path.startsWith('/') ? path : '/' + path);
    const row = addRow(path);
    const res = await fire(url, methodEl.value, timeoutSec);
    lastResults.push({ path, url, ...res });
    fillRow(row, res);
  }

  renderSummary();
  exportBtn.disabled = saveSuiteBtn.disabled = lastResults.length === 0;
  runBtn.disabled = false;
  runBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="6 3 20 12 6 21 6 3"/></svg> Run tests';
});

/* Fire a single request with timing. Never touches any URL the user didn't enter. */
async function fire(url, method, timeoutSec) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutSec * 1000);
  const start = performance.now();
  try {
    const resp = await fetch(url, { method, signal: ctrl.signal, redirect: 'follow' });
    // Drain a small chunk so timing reflects a real round-trip, without storing the body.
    try { await resp.clone().arrayBuffer(); } catch (_) { /* ignore */ }
    const ms = Math.round(performance.now() - start);
    const headers = {};
    resp.headers.forEach((v, k) => { headers[k] = v; });
    return { status: resp.status, ms, headers, error: null };
  } catch (e) {
    return { status: null, ms: Math.round(performance.now() - start), headers: {}, error: e.name === 'AbortError' ? 'Timeout' : (e.message || 'Network error') };
  } finally {
    clearTimeout(t);
  }
}

/* ---------- results rendering ---------- */
function badgeFor(r) {
  if (r.error) return ['err', r.error];
  const s = r.status;
  if (s >= 200 && s < 300) return ['ok', s];
  if (s >= 300 && s < 400) return ['redirect', s];
  if (s >= 400 && s < 500) return ['client', s];
  return ['server', s];
}

function addRow(path) {
  const div = document.createElement('div');
  div.className = 'result';
  div.innerHTML = '<div class="result-top"><span class="badge">…</span><span class="path"></span></div><div class="meta"><span>…</span></div>';
  div.querySelector('.path').textContent = path;
  resultsEl.appendChild(div);
  resultsEl.querySelector('.empty')?.remove();
  return div;
}

function fillRow(div, r) {
  const [cls, label] = badgeFor(r);
  const badge = div.querySelector('.badge');
  badge.className = 'badge ' + cls;
  badge.textContent = label;
  const meta = div.querySelector('.meta');
  const keyHeaders = ['content-type', 'content-length', 'cache-control', 'cf-ray', 'server'];
  const shown = keyHeaders.filter((h) => r.headers[h]).map((h) => `<span>${h}: <b>${escapeHtml(r.headers[h])}</b></span>`).join('');
  meta.innerHTML = `<span>Time: <b>${r.ms} ms</b></span>` + (shown || '<span>No key headers</span>');

  const names = Object.keys(r.headers);
  if (names.length) {
    const btn = document.createElement('button');
    btn.className = 'toggle';
    btn.textContent = `Show all ${names.length} headers`;
    const wrap = document.createElement('div');
    wrap.className = 'headers';
    wrap.innerHTML = '<table>' + names.map((k) =>
      `<tr><td>${escapeHtml(k)}</td><td>${escapeHtml(r.headers[k])}</td></tr>`).join('') + '</table>';
    btn.addEventListener('click', () => {
      const open = wrap.classList.toggle('open');
      btn.textContent = open ? 'Hide headers' : `Show all ${names.length} headers`;
    });
    div.appendChild(btn);
    div.appendChild(wrap);
  }
}

function renderSummary() {
  const ok = lastResults.filter((r) => !r.error && r.status < 400).length;
  const times = lastResults.filter((r) => !r.error).map((r) => r.ms);
  const avg = times.length ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : 0;
  summaryEl.classList.remove('hidden');
  summaryEl.innerHTML =
    `<span class="stat"><b>${lastResults.length}</b> routes</span>` +
    `<span class="stat"><b>${ok}</b> healthy</span>` +
    `<span class="stat"><b>${avg} ms</b> avg</span>`;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function flash(el) {
  el.style.borderColor = '#f87171';
  setTimeout(() => { el.style.borderColor = ''; }, 900);
  el.focus();
}

clearBtn.addEventListener('click', () => {
  lastResults = [];
  resultsEl.innerHTML = '<p class="empty">No tests run yet.</p>';
  summaryEl.classList.add('hidden');
  summaryEl.innerHTML = '';
  exportBtn.disabled = saveSuiteBtn.disabled = true;
});

/* ---------- CSV export ---------- */
exportBtn.addEventListener('click', () => {
  const rows = [['path', 'url', 'method', 'status', 'time_ms', 'error']];
  for (const r of lastResults) {
    rows.push([r.path, r.url, methodEl.value, r.status ?? '', r.ms, r.error ?? '']);
  }
  const csv = rows.map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'route-test-results.csv';
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
});

/* ---------- saved suites ---------- */
saveSuiteBtn.addEventListener('click', () => {
  const name = prompt('Name this test suite:', new URL(baseUrlEl.value || 'https://example.com').hostname || 'Suite');
  if (!name) return;
  chrome.storage.local.get(['wrtSuites'], (d) => {
    const suites = d.wrtSuites || [];
    suites.push({
      name: name.trim(), base: baseUrlEl.value.trim(),
      method: methodEl.value, timeout: timeoutEl.value, paths: pathsEl.value
    });
    chrome.storage.local.set({ wrtSuites: suites }, () => renderSuites(suites));
  });
});

function renderSuites(suites) {
  if (!suites.length) { suitesEl.innerHTML = '<p class="empty">No saved suites.</p>'; return; }
  suitesEl.innerHTML = '';
  suites.forEach((s, i) => {
    const div = document.createElement('div');
    div.className = 'suite';
    const nPaths = s.paths.split('\n').filter((p) => p.trim()).length;
    div.innerHTML = `<span class="name"></span><span class="count">${nPaths} paths</span>`;
    div.querySelector('.name').textContent = s.name;
    const load = document.createElement('button');
    load.title = 'Load suite';
    load.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>';
    load.addEventListener('click', () => {
      baseUrlEl.value = s.base; methodEl.value = s.method;
      timeoutEl.value = s.timeout; pathsEl.value = s.paths;
    });
    const del = document.createElement('button');
    del.title = 'Delete suite'; del.className = 'danger';
    del.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>';
    del.addEventListener('click', () => {
      chrome.storage.local.get(['wrtSuites'], (d) => {
        const next = (d.wrtSuites || []).filter((_, j) => j !== i);
        chrome.storage.local.set({ wrtSuites: next }, () => renderSuites(next));
      });
    });
    div.append(load, del);
    suitesEl.appendChild(div);
  });
}
