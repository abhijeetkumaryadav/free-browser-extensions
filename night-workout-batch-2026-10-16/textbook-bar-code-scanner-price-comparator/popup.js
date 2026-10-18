// Textbook Price Log — engine: price entries, best-price per book, history, import/export.
// Honest scope: your price log — manual entries, no barcode scanning, no live prices.
// ============ ENGINE-START ============

/** Parse a price string into a number. Returns NaN on invalid input. */
function parsePrice(raw) {
  const s = String(raw == null ? '' : raw).trim().replace(/[,$\s]/g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return NaN;
  const n = Number(s);
  return n > 0 && n <= 1000000 ? n : NaN;
}

/** Build a validated price entry. Returns entry or null on invalid input. */
function makeEntry(title, isbn, store, priceRaw, currency) {
  const t = String(title || '').trim().slice(0, 120);
  const st = String(store || '').trim().slice(0, 60);
  const p = parsePrice(priceRaw);
  if (!t || !st || Number.isNaN(p)) return null;
  const cur = String(currency || 'USD').trim().toUpperCase().slice(0, 3) || 'USD';
  return {
    title: t,
    isbn: String(isbn || '').trim().replace(/[-\s]/g, '').slice(0, 17),
    store: st,
    price: p,
    currency: cur,
    at: Date.now(),
  };
}

/** Group entries by normalized title. Returns [{title, isbn, entries[]}] sorted by title. */
function groupByBook(entries) {
  const map = new Map();
  for (const e of entries) {
    const key = e.title.toLowerCase();
    if (!map.has(key)) map.set(key, { title: e.title, isbn: e.isbn || '', entries: [] });
    map.get(key).entries.push(e);
  }
  const groups = [...map.values()];
  for (const g of groups) g.entries.sort((a, b) => b.at - a.at);
  return groups.sort((a, b) => a.title.localeCompare(b.title));
}

/** Lowest-priced entry in a group (or null). */
function bestPrice(entries) {
  if (!entries.length) return null;
  return entries.reduce((min, e) => (e.price < min.price ? e : min));
}

/** Format a price with currency code, e.g. "249.99 USD". */
function fmtPrice(entry) {
  return entry.price.toFixed(2) + ' ' + entry.currency;
}

/** Case-insensitive filter on title/store/ISBN. Empty query returns all. */
function filterEntries(entries, query) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return [...entries];
  return entries.filter(e =>
    e.title.toLowerCase().includes(q) ||
    e.store.toLowerCase().includes(q) ||
    e.isbn.toLowerCase().includes(q));
}

/** Validate imported JSON. Returns array of entries or throws. */
function parseImport(raw) {
  const data = JSON.parse(raw);
  if (!Array.isArray(data)) throw new Error('not an array');
  return data.filter(e =>
    e && typeof e.title === 'string' && typeof e.store === 'string' &&
    typeof e.price === 'number' && e.price > 0);
}

/** Escape HTML for safe rendering. */
function esc(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
// ============ ENGINE-END ============

const $ = id => document.getElementById(id);
let entries = [];

function save() { chrome.storage.local.set({ entries }); }

function fmtDate(ms) {
  const d = new Date(ms);
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) + ' ' +
    d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

function render() {
  const filtered = filterEntries(entries, $('f-search').value);
  const groups = groupByBook(filtered);
  const ul = $('books');
  ul.innerHTML = '';
  $('empty').hidden = entries.length !== 0;
  groups.forEach((g, gi) => {
    const best = bestPrice(g.entries);
    const li = document.createElement('li');
    li.className = 'book';
    li.innerHTML =
      '<div class="t">' + esc(g.title) + '</div>' +
      (g.isbn ? '<div class="isbn">ISBN ' + esc(g.isbn) + '</div>' : '') +
      '<div class="best">Best: ' + esc(fmtPrice(best)) + ' @ ' + esc(best.store) + '</div>' +
      '<ul class="hist">' + g.entries.map((e, ei) =>
        '<li><span>' + esc(fmtDate(e.at)) + ' · ' + esc(e.store) + '</span>' +
        '<span>' + esc(fmtPrice(e)) + ' <button data-gi="' + gi + '" data-ei="' + ei + '">✕</button></span></li>'
      ).join('') + '</ul>';
    ul.appendChild(li);
  });
  ul.querySelectorAll('button[data-gi]').forEach(btn => {
    btn.addEventListener('click', () => {
      const target = groupByBook(filtered)[Number(btn.dataset.gi)].entries[Number(btn.dataset.ei)];
      entries = entries.filter(e => e !== target);
      save(); render();
    });
  });
}

function showErr(msg) { const e = $('err'); e.textContent = msg; e.hidden = !msg; }

function init() {
  chrome.storage.local.get({ entries: [] }, data => { entries = data.entries; render(); });
  $('btn-add').addEventListener('click', () => {
    const e = makeEntry($('f-title').value, $('f-isbn').value, $('f-store').value, $('f-price').value, $('f-cur').value);
    if (!e) { showErr('Fill in title, store, and a valid price (e.g. 249.99).'); return; }
    entries.push(e); save(); render(); showErr('');
    $('f-title').value = ''; $('f-isbn').value = ''; $('f-store').value = ''; $('f-price').value = ''; $('f-cur').value = '';
  });
  $('f-search').addEventListener('input', render);
  $('btn-export').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(entries, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'textbook-price-log.json';
    a.click();
  });
  $('btn-import').addEventListener('click', () => $('f-import').click());
  $('f-import').addEventListener('change', ev => {
    const f = ev.target.files[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      try {
        const data = parseImport(r.result);
        entries = entries.concat(data); save(); render(); showErr('');
      } catch { showErr('Import failed — not a valid price-log JSON file.'); }
    };
    r.readAsText(f);
    ev.target.value = '';
  });
  $('btn-clear').addEventListener('click', () => {
    if (!entries.length || !confirm('Clear your whole price log?')) return;
    entries = []; save(); render();
  });
}
init();
