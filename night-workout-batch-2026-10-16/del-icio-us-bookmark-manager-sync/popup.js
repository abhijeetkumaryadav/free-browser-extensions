/* Del-ish Bookmark Manager — del-icio-us-bookmark-manager-sync
 * MV3 popup. Retro tag-based bookmark manager.
 * Storage: chrome.storage.sync where available (quotas: 8KB/item, 100KB total);
 * falls back to chrome.storage.local when sync is unavailable or quota fails.
 * Honest scope: local + browser sync — not the Delicious service. */

'use strict';

const $ = (id) => document.getElementById(id);
const STORAGE_KEY = 'bookmarks';

// --- Storage layer: sync preferred, local fallback --------------------------
const store = {
  area: null,
  async init() {
    try {
      await chrome.storage.sync.get('__probe__');
      this.area = chrome.storage.sync;
    } catch {
      this.area = chrome.storage.local;
    }
  },
  async read() {
    const data = await this.area.get(STORAGE_KEY);
    return Array.isArray(data[STORAGE_KEY]) ? data[STORAGE_KEY] : [];
  },
  async write(bms) {
    try {
      await this.area.set({ [STORAGE_KEY]: bms });
    } catch (e) {
      // sync quota hit → fall back to local
      if (this.area === chrome.storage.sync) {
        this.area = chrome.storage.local;
        await this.area.set({ [STORAGE_KEY]: bms });
      } else {
        throw e;
      }
    }
  }
};

// --- Helpers ----------------------------------------------------------------
function parseTags(raw) {
  return raw.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean);
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function unescapeHtml(s) {
  return s.replace(/&(amp|lt|gt|quot|#39);/g, (m, e) => (
    { amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'" }[e]));
}

// Netscape bookmark HTML export (the classic format)
function exportHtml(bms) {
  const items = bms.map((b) =>
    `    <DT><A HREF="${escapeHtml(b.url)}" TAGS="${escapeHtml(b.tags.join(','))}">${escapeHtml(b.title)}</A>`
  ).join('\n');
  return `<!DOCTYPE NETSCAPE-Bookmark-file-1>\n<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">\n<TITLE>Bookmarks</TITLE>\n<H1>Bookmarks</H1>\n<DL><p>\n${items}\n</DL><p>\n`;
}

// Import the same format back
function importHtml(text) {
  const out = [];
  const re = /<a[^>]*href="([^"]+)"[^>]*>([^<]*)<\/a>/gi;
  let m;
  while ((m = re.exec(text))) {
    const attrStr = m[0].slice(0, m[0].indexOf('>'));
    const tagsMatch = attrStr.match(/tags="([^"]*)"/i);
    out.push({
      id: 'bm_' + Date.now() + '_' + out.length,
      title: unescapeHtml((m[2] || m[1]).trim()) || m[1],
      url: unescapeHtml(m[1]),
      tags: tagsMatch ? parseTags(tagsMatch[1]) : [],
      created: Date.now()
    });
  }
  return out;
}

function download(filename, text) {
  const blob = new Blob([text], { type: 'text/html;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// --- State ------------------------------------------------------------------
let bookmarks = [];
let activeTag = null;

// --- Rendering --------------------------------------------------------------
function tagCounts() {
  const counts = {};
  for (const b of bookmarks) for (const t of b.tags) counts[t] = (counts[t] || 0) + 1;
  return counts;
}

function renderTags() {
  const cloud = $('tagcloud');
  cloud.innerHTML = '';
  const counts = tagCounts();
  const tags = Object.keys(counts).sort();
  if (!tags.length) {
    cloud.innerHTML = '<p class="hint">No tags yet.</p>';
    return;
  }
  for (const t of tags) {
    const btn = document.createElement('button');
    btn.className = 'tag' + (activeTag === t ? ' active' : '');
    btn.innerHTML = `${escapeHtml(t)} <span class="n">${counts[t]}</span>`;
    btn.addEventListener('click', () => {
      activeTag = activeTag === t ? null : t;
      renderTags();
      renderList();
    });
    cloud.append(btn);
  }
}

function filteredBookmarks() {
  const q = $('search').value.trim().toLowerCase();
  return bookmarks.filter((b) => {
    if (activeTag && !b.tags.includes(activeTag)) return false;
    if (!q) return true;
    return b.title.toLowerCase().includes(q) ||
           b.url.toLowerCase().includes(q) ||
           b.tags.some((t) => t.includes(q));
  });
}

function renderList() {
  const list = $('list');
  list.innerHTML = '';
  const items = filteredBookmarks().slice().reverse();
  $('count').textContent = `(${items.length})`;
  if (!items.length) {
    list.innerHTML = '<div class="empty">Nothing here yet — save a bookmark above.</div>';
    return;
  }
  for (const b of items) {
    const div = document.createElement('div');
    div.className = 'bm';
    const a = document.createElement('a');
    a.href = b.url;
    a.target = '_blank';
    a.rel = 'noopener';
    a.textContent = b.title;
    const url = document.createElement('div');
    url.className = 'url';
    url.textContent = b.url;
    const tags = document.createElement('div');
    tags.className = 'tags';
    for (const t of b.tags) {
      const s = document.createElement('span');
      s.textContent = t;
      tags.append(s);
    }
    const row = document.createElement('div');
    row.className = 'row';
    const del = document.createElement('button');
    del.className = 'icon-btn';
    del.title = 'Delete bookmark';
    del.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>';
    del.addEventListener('click', async () => {
      bookmarks = bookmarks.filter((x) => x.id !== b.id);
      await store.write(bookmarks);
      renderTags();
      renderList();
    });
    row.append(del);
    div.append(a, url);
    if (b.tags.length) div.append(tags);
    div.append(row);
    list.append(div);
  }
}

// --- Actions ----------------------------------------------------------------
async function addBookmark(title, url, tagRaw) {
  let clean;
  try { clean = new URL(url).toString(); } catch { return false; }
  bookmarks.push({
    id: 'bm_' + Date.now() + '_' + bookmarks.length,
    title: title.trim() || clean,
    url: clean,
    tags: parseTags(tagRaw),
    created: Date.now()
  });
  await store.write(bookmarks);
  renderTags();
  renderList();
  return true;
}

// --- Init -------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', async () => {
  await store.init();
  bookmarks = await store.read();
  renderTags();
  renderList();

  $('search').addEventListener('input', renderList);

  $('saveTab').addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.url || !tab.url.startsWith('http')) return;
    const ok = await addBookmark(tab.title || tab.url, tab.url, $('newTags').value);
    if (ok) $('newTags').value = '';
  });

  $('saveManual').addEventListener('click', async () => {
    const ok = await addBookmark($('newTitle').value, $('newUrl').value, $('newTags').value);
    if (ok) { $('newTitle').value = ''; $('newUrl').value = ''; $('newTags').value = ''; }
  });

  $('export').addEventListener('click', () => {
    download('bookmarks.html', exportHtml(bookmarks));
  });

  $('importBtn').addEventListener('click', () => $('importFile').click());
  $('importFile').addEventListener('change', async (ev) => {
    const file = ev.target.files[0];
    if (!file) return;
    const text = await file.text();
    const imported = importHtml(text);
    bookmarks.push(...imported);
    await store.write(bookmarks);
    renderTags();
    renderList();
    ev.target.value = '';
  });
});
