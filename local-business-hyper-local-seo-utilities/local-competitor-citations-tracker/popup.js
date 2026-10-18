/* Citation Tracker — popup logic
 * Manual NAP (name, address, phone) consistency tracker.
 * Nothing is scraped or fetched; every listing is typed in by the user.
 * All data lives in chrome.storage.local on this device. */

'use strict';

/* ---------- constants ---------- */

// Built-in directory list; users can add custom ones at log time.
const PRESET_DIRS = [
  'Google Business Profile', 'Yelp', 'Bing Places', 'Apple Business Connect',
  'Facebook', 'Tripadvisor', 'Yellow Pages', 'Foursquare', 'BBB', 'MapQuest'
];

// Severity-free status labels for listings.
const STATUS = { OPEN: 'open', FIXED: 'fixed' };

/* ---------- tiny store ---------- */

const store = {
  state: { businesses: [], listings: [] },

  async load() {
    const d = await chrome.storage.local.get(['ct_businesses', 'ct_listings']);
    this.state.businesses = d.ct_businesses || [];
    this.state.listings = d.ct_listings || [];
  },

  async save() {
    await chrome.storage.local.set({
      ct_businesses: this.state.businesses,
      ct_listings: this.state.listings
    });
  }
};

const uid = () => Math.random().toString(36).slice(2, 10);

/* ---------- NAP normalization & comparison ---------- */

/** Digits-only phone comparison. */
function normPhone(p) {
  return (p || '').replace(/\D/g, '');
}

/** Case/punctuation-insensitive text comparison. */
function normText(t) {
  return (t || '')
    .toLowerCase()
    .replace(/[.,#\-–—/\\()]/g, ' ')   // punctuation -> space
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Compare one field. Returns:
 *   'ok'   — listed value normalizes to the canonical value
 *   'bad'  — both present but differ
 *   'skip' — no listed value entered (excluded from scoring)
 */
function compareField(canonical, listed, kind) {
  if (!listed || !listed.trim()) return 'skip';
  const n = kind === 'phone' ? normPhone : normText;
  return n(canonical) === n(listed) ? 'ok' : 'bad';
}

/** Compare a whole listing; returns per-field results. */
function compareListing(biz, listing) {
  return {
    name: compareField(biz.name, listing.name, 'text'),
    address: compareField(biz.address, listing.address, 'text'),
    phone: compareField(biz.phone, listing.phone, 'phone')
  };
}

/** Consistency score (0–100) for a business across its listings. */
function businessScore(biz, listings) {
  let ok = 0, total = 0;
  for (const l of listings) {
    if (l.bizId !== biz.id) continue;
    const c = compareListing(biz, l);
    for (const k of Object.keys(c)) {
      if (c[k] === 'skip') continue;
      total++;
      if (c[k] === 'ok' || l.status === STATUS.FIXED) ok++;
    }
  }
  return total === 0 ? null : Math.round((ok / total) * 100);
}

function scoreClass(s) {
  if (s === null) return 'mid';
  if (s >= 90) return 'good';
  if (s >= 70) return 'mid';
  return 'low';
}

/* ---------- DOM helpers ---------- */

const $ = (sel) => document.querySelector(sel);

function el(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

function esc(s) {
  return (s || '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/* ---------- tabs ---------- */

function initTabs() {
  document.querySelectorAll('.tab').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach((b) => b.classList.remove('active'));
      document.querySelectorAll('.panel').forEach((p) => p.classList.remove('active'));
      btn.classList.add('active');
      $('#panel-' + btn.dataset.tab).classList.add('active');
    });
  });
}

/* ---------- businesses panel ---------- */

function renderBusinesses() {
  const box = $('#bizList');
  box.innerHTML = '';
  const { businesses, listings } = store.state;

  if (!businesses.length) {
    box.appendChild(el('<div class="empty">No businesses yet.<br>Add your business and competitors above.</div>'));
    return;
  }

  for (const b of businesses) {
    const s = businessScore(b, listings);
    const n = listings.filter((l) => l.bizId === b.id).length;
    const card = el(`
      <div class="card biz">
        <div class="top">
          <div class="name">${esc(b.name)}</div>
          <span class="score ${scoreClass(s)}">${s === null ? '—' : s + '%'}</span>
        </div>
        <div class="nap">${esc(b.address)} · ${esc(b.phone)}<br>${n} listing${n === 1 ? '' : 's'} logged</div>
        <div class="actions">
          <button class="btn ghost small" data-act="goto" data-id="${b.id}">View report</button>
          <button class="btn danger small" data-act="delbiz" data-id="${b.id}">Delete</button>
        </div>
      </div>`);
    box.appendChild(card);
  }

  box.querySelectorAll('[data-act="delbiz"]').forEach((btn) =>
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id;
      if (!confirm('Delete this business and all its listings?')) return;
      store.state.businesses = store.state.businesses.filter((b) => b.id !== id);
      store.state.listings = store.state.listings.filter((l) => l.bizId !== id);
      await store.save();
      refreshAll();
    }));

  box.querySelectorAll('[data-act="goto"]').forEach((btn) =>
    btn.addEventListener('click', () => {
      $('#repBiz').value = btn.dataset.id;
      document.querySelector('[data-tab="report"]').click();
      renderReport();
    }));
}

function initBizForm() {
  $('#bizForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = $('#bizName').value.trim();
    const address = $('#bizAddr').value.trim();
    const phone = $('#bizPhone').value.trim();
    if (!name || !address || !phone) return;
    store.state.businesses.push({ id: uid(), name, address, phone, created: Date.now() });
    await store.save();
    e.target.reset();
    refreshAll();
  });
}

/* ---------- log listing panel ---------- */

function directoryOptions() {
  const custom = [...new Set(store.state.listings.map((l) => l.directory))]
    .filter((d) => !PRESET_DIRS.includes(d));
  return [...PRESET_DIRS, ...custom];
}

function refreshLogSelects() {
  const bizSel = $('#logBiz');
  bizSel.innerHTML = store.state.businesses
    .map((b) => `<option value="${b.id}">${esc(b.name)}</option>`).join('');
  const dirSel = $('#logDir');
  dirSel.innerHTML = directoryOptions()
    .map((d) => `<option value="${esc(d)}">${esc(d)}</option>`).join('');
}

function initLogForm() {
  $('#logForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const bizId = $('#logBiz').value;
    if (!bizId) { alert('Add a business first.'); return; }
    const custom = $('#logDirCustom').value.trim();
    const directory = custom || $('#logDir').value;
    const name = $('#logName').value.trim();
    const address = $('#logAddr').value.trim();
    const phone = $('#logPhone').value.trim();
    if (!name && !address && !phone) {
      alert('Enter at least one listed field.');
      return;
    }
    store.state.listings.push({
      id: uid(), bizId, directory, name, address, phone,
      status: STATUS.OPEN, updated: Date.now()
    });
    await store.save();
    e.target.reset();
    refreshAll();
    document.querySelector('[data-tab="report"]').click();
    $('#repBiz').value = bizId;
    renderReport();
  });
}

/* ---------- report panel ---------- */

function ringSvg(score) {
  const pct = score === null ? 0 : score;
  const c = 2 * Math.PI * 26;
  const off = c - (c * pct) / 100;
  const col = scoreClass(score) === 'good' ? '#34d399'
    : scoreClass(score) === 'mid' ? '#fbbf24' : '#f87171';
  return `
    <svg class="ring" viewBox="0 0 64 64">
      <circle cx="32" cy="32" r="26" fill="none" stroke="rgba(255,255,255,.08)" stroke-width="7"/>
      <circle cx="32" cy="32" r="26" fill="none" stroke="${col}" stroke-width="7"
        stroke-linecap="round" stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${off.toFixed(1)}"
        transform="rotate(-90 32 32)"/>
    </svg>`;
}

function renderReport() {
  const sel = $('#repBiz');
  const bizId = sel.value;
  const biz = store.state.businesses.find((b) => b.id === bizId);
  const rows = $('#repRows');
  const scoreBox = $('#repScore');
  rows.innerHTML = '';

  if (!biz) {
    scoreBox.innerHTML = '<div class="empty">Add a business to see its report.</div>';
    return;
  }

  const listings = store.state.listings.filter((l) => l.bizId === biz.id);
  const s = businessScore(biz, listings);
  const bad = listings.filter((l) => {
    const c = compareListing(biz, l);
    return l.status !== STATUS.FIXED && Object.values(c).includes('bad');
  }).length;

  scoreBox.innerHTML = `
    ${ringSvg(s)}
    <div>
      <div class="big">${s === null ? '—' : s + '%'}</div>
      <div class="cap">NAP consistency · ${listings.length} listings · ${bad} with issues</div>
    </div>`;

  if (!listings.length) {
    rows.appendChild(el('<div class="empty">No listings logged for this business yet.</div>'));
    return;
  }

  const labels = { name: 'Name', address: 'Address', phone: 'Phone' };
  for (const l of listings) {
    const c = compareListing(biz, l);
    const fixed = l.status === STATUS.FIXED;
    const badges = Object.keys(labels).map((k) => {
      const st = fixed ? 'ok' : c[k];
      const icon = st === 'ok' ? '✓' : st === 'bad' ? '✕' : '–';
      return `<span class="field ${st}">${icon} ${labels[k]}</span>`;
    }).join('');
    const listed = [l.name, l.address, l.phone].filter(Boolean).map(esc).join(' · ');
    const row = el(`
      <div class="card dirrow">
        <div class="top">
          <div class="dname">${esc(l.directory)}${fixed ? ' <span class="field ok">fixed</span>' : ''}</div>
          <button class="btn danger small" data-act="dellog" data-id="${l.id}">Remove</button>
        </div>
        <div class="fields">${badges}</div>
        ${listed ? `<div class="listed">Listed as: ${listed}</div>` : ''}
        <div class="acts">
          ${fixed ? '' : `<button class="btn ghost small" data-act="fix" data-id="${l.id}">Mark fixed</button>`}
        </div>
      </div>`);
    rows.appendChild(row);
  }

  rows.querySelectorAll('[data-act="dellog"]').forEach((btn) =>
    btn.addEventListener('click', async () => {
      if (!confirm('Remove this listing?')) return;
      store.state.listings = store.state.listings.filter((l) => l.id !== btn.dataset.id);
      await store.save();
      refreshAll();
    }));

  rows.querySelectorAll('[data-act="fix"]').forEach((btn) =>
    btn.addEventListener('click', async () => {
      const l = store.state.listings.find((x) => x.id === btn.dataset.id);
      if (l) { l.status = STATUS.FIXED; l.updated = Date.now(); }
      await store.save();
      refreshAll();
    }));
}

function refreshReportSelect() {
  const sel = $('#repBiz');
  const prev = sel.value;
  sel.innerHTML = store.state.businesses
    .map((b) => `<option value="${b.id}">${esc(b.name)}</option>`).join('');
  if ([...sel.options].some((o) => o.value === prev)) sel.value = prev;
}

/* ---------- export ---------- */

function csvCell(v) {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

function buildCsv() {
  const lines = [['Business', 'Directory', 'Listed name', 'Listed address', 'Listed phone', 'Name match', 'Address match', 'Phone match', 'Status']];
  for (const b of store.state.businesses) {
    for (const l of store.state.listings.filter((x) => x.bizId === b.id)) {
      const c = compareListing(b, l);
      lines.push([b.name, l.directory, l.name, l.address, l.phone, c.name, c.address, c.phone, l.status].map(csvCell));
    }
  }
  return lines.map((r) => r.join(',')).join('\n');
}

function download(filename, text, mime) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: mime }));
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}

function initExport() {
  $('#exportCsv').addEventListener('click', () =>
    download('citation-report.csv', buildCsv(), 'text/csv'));
  $('#exportJson').addEventListener('click', async () => {
    const json = JSON.stringify(store.state, null, 2);
    try {
      await navigator.clipboard.writeText(json);
      $('#exportJson').textContent = 'Copied!';
      setTimeout(() => { $('#exportJson').textContent = 'Export JSON'; }, 1500);
    } catch {
      download('citation-report.json', json, 'application/json');
    }
  });
}

/* ---------- boot ---------- */

function refreshAll() {
  renderBusinesses();
  refreshLogSelects();
  refreshReportSelect();
  renderReport();
}

document.addEventListener('DOMContentLoaded', async () => {
  initTabs();
  initBizForm();
  initLogForm();
  initExport();
  await store.load();
  refreshAll();
});
