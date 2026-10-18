/* LinkSentry popup — orchestrates on-demand link checks.
   All network checks run from the extension context (host_permissions justify
   cross-origin checks); content script only collects links / reveals elements.
   Honest classification: blocked-by-bot/CORS => "uncheckable", never "broken". */

'use strict';

const SLOW_MS = 3000;        // links slower than this are flagged "slow"
const TIMEOUT_MS = 15000;    // per-link hard timeout
const CONCURRENCY = 4;       // rate limit: 4 checks in flight at once
const BATCH_PAUSE_MS = 250;  // breather between batches, kind to servers

let findings = [];           // [{url,text,path,status,httpStatus,ms,note,finalUrl}]
let activeFilter = 'all';
let scanToken = 0;           // invalidates stale scans

const $ = (id) => document.getElementById(id);

/** HEAD first, fall back to ranged GET (some servers reject HEAD). */
async function checkOne(url) {
  const t0 = performance.now();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  const opts = { signal: ctrl.signal, credentials: 'omit', redirect: 'follow' };
  try {
    let res = await fetch(url, { ...opts, method: 'HEAD' });
    if (res.status === 405 || res.status === 501) {
      res = await fetch(url, { ...opts, method: 'GET', headers: { Range: 'bytes=0-0' } });
    }
    const ms = Math.round(performance.now() - t0);
    clearTimeout(timer);
    const out = { ms, httpStatus: res.status, finalUrl: res.url };
    if (res.ok) {
      out.status = res.redirected ? 'redirect' : 'ok';
      if (ms > SLOW_MS) out.slow = true;
      if (res.redirected) out.note = `Redirected to ${res.url}`;
      else if (ms > SLOW_MS) out.note = `OK but slow (${ms} ms)`;
    } else if (res.status >= 400) {
      out.status = 'broken';
      out.note = `HTTP ${res.status} ${res.statusText || ''}`.trim();
    } else {
      out.status = 'uncheckable';
      out.note = `Unexpected status ${res.status} — left unverified, not counted as broken.`;
    }
    return out;
  } catch (e) {
    clearTimeout(timer);
    const ms = Math.round(performance.now() - t0);
    if (e && e.name === 'AbortError') {
      return { status: 'broken', ms, note: `Timed out after ${TIMEOUT_MS / 1000}s — server unreachable or hanging.` };
    }
    // Network/DNS/CORS/bot-wall failures: honest "uncheckable", NOT broken.
    return { status: 'uncheckable', ms, note: 'Request blocked (bot protection, CORS, or network). Could not verify — not counted as broken.' };
  }
}

async function runScan() {
  const token = ++scanToken;
  findings = [];
  activeFilter = 'all';
  document.querySelectorAll('.chip').forEach(c => c.classList.toggle('active', c.dataset.f === 'all'));
  $('findings').innerHTML = '';
  ['summary', 'filters', 'actions'].forEach(id => $(id).classList.add('hidden'));
  $('progressWrap').classList.remove('hidden');
  $('scanBtn').disabled = true;

  const setProgress = (done, total, label) => {
    $('progressLabel').textContent = label;
    const pct = total ? Math.round((done / total) * 100) : 0;
    $('progressBar').style.width = pct + '%';
    $('progressPct').textContent = pct + '%';
  };

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id || !/^https?:/.test(tab.url || '')) {
      throw new Error('Open a regular web page (http/https) to scan it.');
    }
    setProgress(0, 1, 'Collecting links…');
    const [inject] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['content.js'],
    });
    const [collected] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => collectLinks(),
    });
    let links = (collected && collected.result) || [];
    // Same-origin first: most reliable, most relevant for CMS editors.
    links.sort((a, b) => (b.sameOrigin ? 1 : 0) - (a.sameOrigin ? 1 : 0));
    const max = parseInt($('maxLinks').value, 10) || 100;
    links = links.slice(0, max);
    if (token !== scanToken) return;

    if (!links.length) {
      $('findings').innerHTML = '<p class="empty">No external links found on this page.</p>';
      $('progressWrap').classList.add('hidden');
      $('scanBtn').disabled = false;
      return;
    }

    let done = 0;
    for (let i = 0; i < links.length; i += CONCURRENCY) {
      if (token !== scanToken) return; // superseded
      const batch = links.slice(i, i + CONCURRENCY);
      const results = await Promise.all(batch.map(async (l) => {
        const r = await checkOne(l.url);
        return { ...l, ...r, status: r.slow && r.status === 'ok' ? 'slow' : r.status };
      }));
      findings.push(...results);
      done += batch.length;
      setProgress(done, links.length, `Checking ${done} of ${links.length}…`);
      render(false);
      await new Promise(r => setTimeout(r, BATCH_PAUSE_MS));
    }
    if (token !== scanToken) return;
    render(true);
    chrome.storage.local.set({ linksentry_last: { at: Date.now(), findings } });
  } catch (err) {
    $('findings').innerHTML = `<p class="empty">Scan failed: ${escapeHtml(err.message || String(err))}</p>`;
  } finally {
    if (token === scanToken) {
      $('progressWrap').classList.add('hidden');
      $('scanBtn').disabled = false;
    }
  }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function counts() {
  const c = { ok: 0, broken: 0, redirect: 0, slow: 0, uncheckable: 0 };
  findings.forEach(f => { if (c[f.status] !== undefined) c[f.status]++; });
  return c;
}

function render(finished) {
  const c = counts();
  $('nOk').textContent = c.ok; $('nBroken').textContent = c.broken;
  $('nRedirect').textContent = c.redirect; $('nSlow').textContent = c.slow;
  $('nBlocked').textContent = c.uncheckable;
  ['summary', 'filters', 'actions'].forEach(id => $(id).classList.remove('hidden'));

  const list = findings.filter(f => activeFilter === 'all' || f.status === activeFilter);
  const box = $('findings');
  if (!list.length) {
    box.innerHTML = `<p class="empty">${finished ? 'Nothing in this filter. Clean bill of health 🎉' : 'Checking…'}</p>`;
    return;
  }
  // Worst first.
  const rank = { broken: 0, uncheckable: 1, redirect: 2, slow: 3, ok: 4 };
  list.sort((a, b) => rank[a.status] - rank[b.status]);
  box.innerHTML = list.map((f, i) => `
    <div class="finding" data-idx="${findings.indexOf(f)}">
      <div class="top"><span class="badge ${f.status}">${f.status}</span></div>
      <div class="url">${escapeHtml(f.url)}</div>
      <div class="meta">${escapeHtml(f.note || '')}${f.httpStatus ? ` · HTTP ${f.httpStatus}` : ''}${f.ms != null ? ` · ${f.ms} ms` : ''}${f.text ? `<br>Link text: “${escapeHtml(f.text)}”` : ''}<br><span title="${escapeHtml(f.path)}">Location: ${escapeHtml(f.path.slice(0, 60))}${f.path.length > 60 ? '…' : ''}</span></div>
      <button class="reveal" data-reveal="${findings.indexOf(f)}">Reveal on page</button>
    </div>`).join('');
  box.querySelectorAll('[data-reveal]').forEach(btn => {
    btn.addEventListener('click', () => reveal(findings[parseInt(btn.dataset.reveal, 10)]));
  });
}

async function reveal(f) {
  if (!f) return;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.id) return;
  await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });
  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: (p) => revealElement(p),
    args: [f.path],
  });
}

function download(name, mime, text) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: mime }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

document.addEventListener('DOMContentLoaded', () => {
  $('scanBtn').addEventListener('click', runScan);
  document.querySelectorAll('.chip').forEach(chip => {
    chip.addEventListener('click', () => {
      activeFilter = chip.dataset.f;
      document.querySelectorAll('.chip').forEach(c => c.classList.toggle('active', c === chip));
      render(true);
    });
  });
  $('exportJson').addEventListener('click', () => {
    download('linksentry-report.json', 'application/json', JSON.stringify({ exportedAt: new Date().toISOString(), findings }, null, 2));
  });
  $('exportCsv').addEventListener('click', () => {
    const rows = [['status', 'http_status', 'ms', 'url', 'link_text', 'location', 'note']];
    findings.forEach(f => rows.push([f.status, f.httpStatus || '', f.ms ?? '', `"${(f.url || '').replace(/"/g, '""')}"`, `"${(f.text || '').replace(/"/g, '""')}"`, `"${(f.path || '').replace(/"/g, '""')}"`, `"${(f.note || '').replace(/"/g, '""')}"`]));
    download('linksentry-report.csv', 'text/csv', rows.map(r => r.join(',')).join('\n'));
  });
  $('clearBtn').addEventListener('click', () => {
    scanToken++;
    findings = [];
    $('findings').innerHTML = '';
    ['summary', 'filters', 'actions', 'progressWrap'].forEach(id => $(id).classList.add('hidden'));
    chrome.storage.local.remove('linksentry_last');
  });
});
