/* SitemapForge — visual sitemap builder, 100% client-side.
   No network submission anywhere; fetching a sitemap URL happens in the
   active tab's page context so it only works same-origin (browser CORS). */

// --- State ---------------------------------------------------------------
const state = { items: [] }; // [{loc, lastmod, priority, changefreq}]
const CHANGEFREQS = ['always','hourly','daily','weekly','monthly','yearly','never'];
const PRIORITIES = ['0.0','0.1','0.2','0.3','0.4','0.5','0.6','0.7','0.8','0.9','1.0'];

// --- DOM -----------------------------------------------------------------
const $ = (id) => document.getElementById(id);

// --- XML parsing / building ----------------------------------------------
function parseSitemapXml(xmlText) {
  const doc = new DOMParser().parseFromString(xmlText, 'text/xml');
  if (doc.querySelector('parsererror')) throw new Error('That is not valid XML.');
  const out = [];
  doc.querySelectorAll('url').forEach((u) => {
    const loc = u.querySelector('loc')?.textContent?.trim();
    if (!loc) return;
    out.push({
      loc,
      lastmod: u.querySelector('lastmod')?.textContent?.trim() || '',
      priority: u.querySelector('priority')?.textContent?.trim() || '0.5',
      changefreq: u.querySelector('changefreq')?.textContent?.trim() || 'weekly',
    });
  });
  if (!out.length) throw new Error('No <url> entries with <loc> found.');
  return out;
}

function escapeXml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

function buildSitemapXml(items) {
  const urls = items.map((it) => {
    let x = '  <url>\n    <loc>' + escapeXml(it.loc) + '</loc>';
    if (it.lastmod) x += '\n    <lastmod>' + escapeXml(it.lastmod) + '</lastmod>';
    if (it.changefreq) x += '\n    <changefreq>' + escapeXml(it.changefreq) + '</changefreq>';
    if (it.priority) x += '\n    <priority>' + escapeXml(it.priority) + '</priority>';
    return x + '\n  </url>';
  });
  return '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    urls.join('\n') + '\n</urlset>\n';
}

// --- Grouping ------------------------------------------------------------
function groupKey(loc) {
  try {
    const u = new URL(loc);
    const segs = u.pathname.split('/').filter(Boolean);
    return u.host + (segs.length ? '/' + segs[0] : '');
  } catch { return 'other'; }
}

function setNote(msg, cls) {
  const n = $('loadNote');
  n.textContent = msg || '';
  n.className = 'note' + (cls ? ' ' + cls : '');
}

// --- Rendering -----------------------------------------------------------
function renderTree() {
  const tree = $('tree');
  const items = state.items;
  $('treeCard').hidden = items.length === 0;
  $('urlCount').textContent = items.length ? items.length + ' URLs' : '';
  $('exportBtn').disabled = items.length === 0;
  $('clearBtn').disabled = items.length === 0;
  if (!items.length) { tree.innerHTML = ''; return; }

  const groups = new Map();
  items.forEach((it, i) => {
    const k = groupKey(it.loc);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push({ it, i });
  });

  tree.innerHTML = '';
  for (const [key, rows] of groups) {
    const det = document.createElement('details');
    det.className = 'group';
    det.open = groups.size <= 4;
    const sum = document.createElement('summary');
    sum.innerHTML = '';
    const name = document.createElement('span');
    name.textContent = key;
    const cnt = document.createElement('span');
    cnt.textContent = rows.length + ' URL' + (rows.length > 1 ? 's' : '');
    sum.append(name, cnt);
    det.append(sum);
    for (const { it, i } of rows) det.append(nodeEl(it, i));
    tree.append(det);
  }
}

function nodeEl(it, idx) {
  const li = document.createElement('li');
  li.className = 'node';
  const loc = document.createElement('div');
  loc.className = 'loc';
  loc.textContent = it.loc;
  const ctrls = document.createElement('div');
  ctrls.className = 'ctrls';

  const pl = document.createElement('label'); pl.textContent = 'priority';
  const ps = document.createElement('select');
  PRIORITIES.forEach((p) => {
    const o = document.createElement('option');
    o.value = p; o.textContent = p;
    if (p === it.priority) o.selected = true;
    ps.append(o);
  });
  ps.addEventListener('change', () => { state.items[idx].priority = ps.value; persist(); });

  const fl = document.createElement('label'); fl.textContent = 'changefreq';
  const fs = document.createElement('select');
  CHANGEFREQS.forEach((f) => {
    const o = document.createElement('option');
    o.value = f; o.textContent = f;
    if (f === it.changefreq) o.selected = true;
    fs.append(o);
  });
  fs.addEventListener('change', () => { state.items[idx].changefreq = fs.value; persist(); });

  const del = document.createElement('button');
  del.className = 'del'; del.textContent = 'Remove';
  del.addEventListener('click', () => {
    state.items.splice(idx, 1);
    persist(); renderTree();
  });

  ctrls.append(pl, ps, fl, fs, del);
  li.append(loc, ctrls);
  return li;
}

// --- Persistence ---------------------------------------------------------
async function persist() {
  await chrome.storage.local.set({ sitemapforge: state.items });
}
async function restore() {
  const r = await chrome.storage.local.get('sitemapforge');
  if (Array.isArray(r.sitemapforge)) state.items = r.sitemapforge;
  renderTree();
}

// --- Loading -------------------------------------------------------------
async function loadFromText(xmlText) {
  try {
    state.items = parseSitemapXml(xmlText);
    setNote('Loaded ' + state.items.length + ' URLs.', 'ok');
  } catch (e) {
    setNote('Could not parse: ' + e.message, 'err');
    return;
  }
  await persist(); renderTree();
}

async function loadFromUrl() {
  const url = $('urlInput').value.trim();
  if (!url) { setNote('Enter a sitemap.xml URL first.', 'err'); return; }
  let xml;
  try {
    // Same-origin fetch executed in the page context: works for the site
    // you are currently on, blocked by CORS elsewhere — by design.
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const res = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      world: 'MAIN',
      func: async (u) => {
        const r = await fetch(u, { credentials: 'omit' });
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return await r.text();
      },
      args: [url],
    });
    xml = res[0].result;
  } catch (e) {
    setNote('Fetch failed (works same-origin only): ' + e.message + '. Try pasting the XML instead.', 'err');
    return;
  }
  await loadFromText(xml);
}

async function buildFromPage() {
  setNote('Collecting links from this page…');
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    // Inject the collector into the page's main world, then call it.
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['content.js'],
      world: 'MAIN',
    });
    const res = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      world: 'MAIN',
      func: () => window.__sitemapforge_collect(),
    });
    const links = res[0].result || [];
    state.items = links.map((loc) => ({
      loc,
      lastmod: new Date().toISOString().slice(0, 10),
      priority: '0.5',
      changefreq: 'weekly',
    }));
    setNote('Collected ' + state.items.length + ' same-site links.', 'ok');
  } catch (e) {
    setNote('Could not read page links: ' + e.message, 'err');
    return;
  }
  await persist(); renderTree();
}

// --- Export --------------------------------------------------------------
function exportXml() {
  const xml = buildSitemapXml(state.items);
  const blob = new Blob([xml], { type: 'application/xml' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'sitemap.xml';
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

function addUrl() {
  const v = $('addInput').value.trim();
  try {
    const u = new URL(v);
    if (!/^https?:$/.test(u.protocol)) throw new Error('bad protocol');
    if (state.items.some((it) => it.loc === u.href)) { setNote('That URL is already listed.', 'err'); return; }
    state.items.push({
      loc: u.href,
      lastmod: new Date().toISOString().slice(0, 10),
      priority: '0.5',
      changefreq: 'weekly',
    });
    $('addInput').value = '';
    persist(); renderTree(); setNote('Added.', 'ok');
  } catch { setNote('Enter a valid http(s) URL.', 'err'); }
}

// --- Init ----------------------------------------------------------------
$('loadUrlBtn').addEventListener('click', loadFromUrl);
$('parseBtn').addEventListener('click', () => loadFromText($('pasteArea').value));
$('pageBtn').addEventListener('click', buildFromPage);
$('exportBtn').addEventListener('click', exportXml);
$('addBtn').addEventListener('click', addUrl);
$('clearBtn').addEventListener('click', async () => {
  state.items = []; await persist(); renderTree(); setNote('');
});
restore();
