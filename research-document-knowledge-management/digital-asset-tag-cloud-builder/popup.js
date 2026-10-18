/* TagCloud — Bookmark Tag Explorer
 * All data lives in chrome.storage.local. Nothing leaves the device.
 * State: links = [{ id, title, url, tags:[...], createdAt }]
 */

'use strict';

/* ---------- Lucide-style stroke icons (inline SVG) ---------- */
const ICONS = {
  cloud: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.5 19a4.5 4.5 0 0 0 0-9 6 6 0 0 0-11.5 1.5A4 4 0 0 0 7 19h10.5z"/></svg>',
  search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
  download: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12"/><path d="m7 11 5 5 5-5"/><path d="M4 21h16"/></svg>',
  upload: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 15V3"/><path d="m7 7 5-5 5 5"/><path d="M4 21h16"/></svg>',
  trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>',
  external: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><path d="M15 3h6v6"/><path d="M10 14 21 3"/></svg>',
};

/* ---------- DOM refs ---------- */
const $ = (id) => document.getElementById(id);
const tagCloudEl = $('tag-cloud');
const cloudResultsEl = $('cloud-results');
const allLinksEl = $('all-links');
const searchInput = $('search-input');
const linkCountEl = $('link-count');

let links = [];            // full collection
let activeTag = null;      // currently selected cloud tag filter

/* ---------- Storage ---------- */
async function loadLinks() {
  const { links: stored } = await chrome.storage.local.get('links');
  links = Array.isArray(stored) ? stored : [];
}

async function saveLinks() {
  await chrome.storage.local.set({ links });
}

/* ---------- Helpers ---------- */
// Normalize raw tag input into a clean, deduped list.
function parseTags(raw) {
  return [...new Set(
    raw.split(',')
      .map((t) => t.trim().toLowerCase().replace(/\s+/g, '-'))
      .filter((t) => t.length > 0 && t.length <= 40)
  )].slice(0, 12);
}

function tagFrequencies() {
  const freq = new Map();
  for (const link of links) {
    for (const tag of link.tags) freq.set(tag, (freq.get(tag) || 0) + 1);
  }
  return freq;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

// Safe URL check — only http(s) links may be saved/opened.
function isSafeUrl(raw) {
  try {
    const u = new URL(raw);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch { return false; }
}

/* ---------- Rendering ---------- */
function renderCloud() {
  const freq = tagFrequencies();
  tagCloudEl.innerHTML = '';

  if (freq.size === 0) {
    tagCloudEl.innerHTML = '<p class="cloud-empty">No tags yet.<br/>Add some links to grow your cloud.</p>';
    return;
  }

  const counts = [...freq.values()];
  const min = Math.min(...counts);
  const max = Math.max(...counts);
  const MIN_PX = 12, MAX_PX = 26;

  // Sort alphabetically for a stable, scannable cloud.
  const sorted = [...freq.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  for (const [tag, count] of sorted) {
    const btn = document.createElement('button');
    btn.className = 'tag-chip' + (tag === activeTag ? ' selected' : '');
    btn.textContent = tag;
    // Scale font size by frequency (linear interpolation).
    const size = max === min ? (MIN_PX + MAX_PX) / 2
      : MIN_PX + ((count - min) / (max - min)) * (MAX_PX - MIN_PX);
    btn.style.fontSize = `${size.toFixed(1)}px`;
    btn.title = `${count} link${count === 1 ? '' : 's'}`;
    btn.addEventListener('click', () => {
      activeTag = (activeTag === tag) ? null : tag;
      renderCloud();
      renderCloudResults();
    });
    tagCloudEl.appendChild(btn);
  }
}

function linkCard(link) {
  const card = document.createElement('div');
  card.className = 'link-card';
  card.innerHTML = `
    <div class="link-title"><a href="${escapeHtml(link.url)}" target="_blank" rel="noopener">${escapeHtml(link.title)}</a></div>
    <div class="link-url">${escapeHtml(link.url)}</div>
    <div class="link-tags"></div>
    <div class="link-actions">
      <button class="danger-link" data-del="${link.id}">${ICONS.trash} Delete</button>
    </div>`;
  const tagsWrap = card.querySelector('.link-tags');
  for (const tag of link.tags) {
    const t = document.createElement('button');
    t.className = 'mini-tag';
    t.textContent = tag;
    t.addEventListener('click', () => {
      activeTag = tag;
      switchTab('cloud');
      renderCloud();
      renderCloudResults();
    });
    tagsWrap.appendChild(t);
  }
  card.querySelector('[data-del]').addEventListener('click', async () => {
    links = links.filter((l) => l.id !== link.id);
    if (activeTag && !tagFrequencies().has(activeTag)) activeTag = null;
    await saveLinks();
    renderAll();
  });
  return card;
}

function filteredLinks() {
  let out = [...links].sort((a, b) => b.createdAt - a.createdAt);
  const q = searchInput.value.trim().toLowerCase();
  if (q) {
    out = out.filter((l) =>
      l.title.toLowerCase().includes(q) ||
      l.url.toLowerCase().includes(q) ||
      l.tags.some((t) => t.includes(q)));
  }
  if (activeTag) out = out.filter((l) => l.tags.includes(activeTag));
  return out;
}

function renderCloudResults() {
  const list = filteredLinks();
  cloudResultsEl.innerHTML = '';
  if (list.length === 0) {
    cloudResultsEl.innerHTML = '<div class="empty-state">No links match this filter.</div>';
    return;
  }
  for (const link of list.slice(0, 50)) cloudResultsEl.appendChild(linkCard(link));
  if (list.length > 50) {
    const more = document.createElement('div');
    more.className = 'empty-state';
    more.textContent = `…and ${list.length - 50} more — see the Links tab.`;
    cloudResultsEl.appendChild(more);
  }
}

function renderAllLinks() {
  allLinksEl.innerHTML = '';
  if (links.length === 0) {
    allLinksEl.innerHTML = '<div class="empty-state">Nothing saved yet.<br/>Use the Add tab to save your first link.</div>';
    return;
  }
  const sorted = [...links].sort((a, b) => b.createdAt - a.createdAt);
  for (const link of sorted) allLinksEl.appendChild(linkCard(link));
}

function renderAll() {
  linkCountEl.textContent = links.length;
  renderCloud();
  renderCloudResults();
  renderAllLinks();
}

/* ---------- Tabs ---------- */
function switchTab(name) {
  document.querySelectorAll('.tab').forEach((t) =>
    t.classList.toggle('active', t.dataset.tab === name));
  document.querySelectorAll('.panel').forEach((p) =>
    p.classList.toggle('active', p.id === `tab-${name}`));
}
document.querySelectorAll('.tab').forEach((t) =>
  t.addEventListener('click', () => switchTab(t.dataset.tab)));

/* ---------- Add form ---------- */
$('add-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const note = $('add-note');
  const title = $('f-title').value.trim();
  let url = $('f-url').value.trim();
  const tags = parseTags($('f-tags').value);

  if (!isSafeUrl(url)) {
    note.textContent = 'Please enter a valid http(s) URL.';
    note.className = 'form-note';
    return;
  }
  if (links.some((l) => l.url === url)) {
    note.textContent = 'This URL is already saved.';
    note.className = 'form-note';
    return;
  }

  links.push({
    id: 'l' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
    title: title || url,
    url,
    tags,
    createdAt: Date.now(),
  });
  await saveLinks();
  renderAll();
  e.target.reset();
  note.textContent = 'Saved ✓';
  note.className = 'form-note ok';
  setTimeout(() => { note.textContent = ''; }, 1800);
});

/* ---------- Search ---------- */
searchInput.addEventListener('input', renderCloudResults);

/* ---------- Export / Import ---------- */
$('export-btn').innerHTML = ICONS.download;
$('import-btn').innerHTML = ICONS.upload;
$('brand-icon').innerHTML = ICONS.cloud;
$('search-icon').innerHTML = ICONS.search;

$('export-btn').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify({ app: 'tagcloud', version: 1, links }, null, 2)],
    { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `tagcloud-export-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
});

$('import-btn').addEventListener('click', () => $('import-file').click());

$('import-file').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    const incoming = Array.isArray(data) ? data : data.links;
    if (!Array.isArray(incoming)) throw new Error('bad format');
    const seen = new Set(links.map((l) => l.url));
    let added = 0;
    for (const item of incoming) {
      if (!item || typeof item.url !== 'string' || !isSafeUrl(item.url)) continue;
      if (seen.has(item.url)) continue;
      links.push({
        id: 'l' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7) + added,
        title: String(item.title || item.url).slice(0, 120),
        url: item.url,
        tags: Array.isArray(item.tags) ? parseTags(item.tags.join(',')) : [],
        createdAt: Number(item.createdAt) || Date.now(),
      });
      seen.add(item.url);
      added++;
    }
    await saveLinks();
    renderAll();
    alert(`Import complete — ${added} new link${added === 1 ? '' : 's'} added.`);
  } catch {
    alert('Could not import: not a valid TagCloud JSON file.');
  }
});

/* ---------- Init ---------- */
(async function init() {
  await loadLinks();
  renderAll();
})();
