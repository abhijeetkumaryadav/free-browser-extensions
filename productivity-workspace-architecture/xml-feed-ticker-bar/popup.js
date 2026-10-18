/* XML Feed Ticker Bar — popup UI. All feed work happens in background.js;
 * the popup only sends messages and renders state. */
'use strict';

const $ = (id) => document.getElementById(id);
const send = (msg) => chrome.runtime.sendMessage(msg);

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

function timeAgo(ts) {
  if (!ts) return '';
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

let state = { feeds: [], items: [] };

async function load() {
  state = await send({ type: 'get-state' });
  render();
}

function render() {
  const { feeds, items } = state;
  const unread = items.filter((i) => !i.read).length;
  $('unreadBadge').textContent = unread;
  $('feedCount').textContent = feeds.length ? `(${feeds.length})` : '';
  renderItems(items);
  renderFeeds(feeds);
}

/* ---------- headlines ---------- */
function renderItems(items) {
  const list = $('itemList');
  list.innerHTML = '';
  $('emptyItems').classList.toggle('hidden', items.length > 0);

  const latest = items.slice(0, 60);
  const newestCheck = Math.max(0, ...state.feeds.map((f) => f.lastChecked || 0));
  $('statusLine').textContent = newestCheck
    ? `Updated ${timeAgo(newestCheck)} · refreshes every 15 min`
    : '';

  for (const it of latest) {
    const el = document.createElement('div');
    el.className = 'item' + (it.read ? ' read' : '');
    el.innerHTML = `
      <span class="dot" aria-hidden="true"></span>
      <div class="body">
        <div class="title">${esc(it.title)}</div>
        <div class="meta">${esc(it.feedName || '')}${it.pubDate ? ' &middot; ' + timeAgo(it.pubDate) : ''}</div>
      </div>`;
    el.title = it.link;
    el.addEventListener('click', async () => {
      await send({ type: 'mark-read', id: it.id });
      it.read = true; // optimistic local update
      render();
      chrome.tabs.create({ url: it.link });
    });
    list.appendChild(el);
  }
}

/* ---------- feeds ---------- */
function renderFeeds(feeds) {
  const list = $('feedList');
  list.innerHTML = '';
  $('emptyFeeds').classList.toggle('hidden', feeds.length > 0);

  for (const f of feeds) {
    const el = document.createElement('div');
    el.className = 'feed' + (f.muted ? ' muted' : '');
    el.innerHTML = `
      <div class="feed-top">
        <span class="feed-name" title="${esc(f.title)}">${esc(f.title)}</span>
        <span class="feed-actions">
          <button class="mute-btn" data-act="mute" type="button">${f.muted ? 'Unmute' : 'Mute'}</button>
          <button class="btn icon danger" data-act="remove" type="button" title="Remove feed">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>
          </button>
        </span>
      </div>
      <div class="feed-url" title="${esc(f.url)}">${esc(f.url)}</div>
      ${f.error ? `<div class="feed-err">Last fetch failed: ${esc(f.error)}</div>` : ''}`;

    el.addEventListener('click', async (e) => {
      const btn = e.target.closest('[data-act]');
      if (!btn) return;
      if (btn.dataset.act === 'mute') {
        await send({ type: 'toggle-mute', id: f.id });
        f.muted = !f.muted;
        render();
      } else if (btn.dataset.act === 'remove') {
        if (!btn.classList.contains('confirm')) {
          btn.classList.add('confirm');
          btn.title = 'Click again to confirm';
          setTimeout(() => { btn.classList.remove('confirm'); btn.title = 'Remove feed'; }, 3000);
          return;
        }
        await send({ type: 'remove-feed', id: f.id });
        await load();
      }
    });
    list.appendChild(el);
  }
}

/* ---------- events ---------- */
function setTab(which) {
  const items = which === 'items';
  $('tabItems').classList.toggle('active', items);
  $('tabFeeds').classList.toggle('active', !items);
  $('viewItems').classList.toggle('hidden', !items);
  $('viewFeeds').classList.toggle('hidden', items);
}
$('tabItems').addEventListener('click', () => setTab('items'));
$('tabFeeds').addEventListener('click', () => setTab('feeds'));

async function addFeed() {
  const input = $('feedUrl');
  const hint = $('feedHint');
  const url = input.value.trim();
  if (!url) { hint.textContent = 'Paste a feed URL first.'; hint.className = 'hint warn'; return; }
  hint.textContent = 'Fetching feed…';
  hint.className = 'hint';
  const res = await send({ type: 'add-feed', url });
  if (res.ok) {
    input.value = '';
    hint.textContent = 'Feed added.';
    hint.className = 'hint ok';
  } else {
    hint.textContent = res.error || 'Could not add feed.';
    hint.className = 'hint warn';
  }
  await load();
}
$('addBtn').addEventListener('click', addFeed);
$('feedUrl').addEventListener('keydown', (e) => { if (e.key === 'Enter') addFeed(); });

$('markAllBtn').addEventListener('click', async () => {
  await send({ type: 'mark-all-read' });
  await load();
});

$('refreshBtn').addEventListener('click', async (e) => {
  const btn = $('refreshBtn');
  btn.classList.add('spin');
  await send({ type: 'refresh-now' });
  await load();
  btn.classList.remove('spin');
});

load();
