/* My Feeds — popup logic.
 * Plain RSS reader for feeds the user chooses. It is explicitly NOT a
 * neutral or impartial news service: every feed listed is one the user added. */

// Starter feeds the user may keep or remove. Everything below is editable.
const STARTER_FEEDS = [
  'https://feeds.bbci.co.uk/news/rss.xml',
  'https://www.theguardian.com/world/rss',
  'https://feeds.npr.org/1004/rss.xml',
  'https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml',
];

const itemsEl = document.getElementById('items');
const feedsEl = document.getElementById('feeds');
const statusEl = document.getElementById('status');
const refreshBtn = document.getElementById('refresh');

async function getFeeds() {
  const data = await chrome.storage.local.get({ feeds: STARTER_FEEDS });
  return data.feeds;
}

/* ---------- RSS parsing (DOMParser, no libraries) ---------- */
function parseFeed(xmlText, feedUrl) {
  const doc = new DOMParser().parseFromString(xmlText, 'text/xml');
  const items = [];
  const nodes = doc.querySelectorAll('item, entry');
  nodes.forEach((n) => {
    const title = n.querySelector('title')?.textContent?.trim() || '(untitled)';
    let link = n.querySelector('link')?.getAttribute('href') || n.querySelector('link')?.textContent?.trim();
    const source = doc.querySelector('channel > title, feed > title')?.textContent?.trim() || new URL(feedUrl).hostname;
    if (link) items.push({ title, link, source });
  });
  return items;
}

async function fetchFeed(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return parseFeed(await res.text(), url);
  } catch {
    return [];
  }
}

/* ---------- rendering ---------- */
function renderFeeds(feeds) {
  feedsEl.innerHTML = '';
  feeds.forEach((url, i) => {
    const li = document.createElement('li');
    const name = document.createElement('span');
    name.className = 'fname';
    name.textContent = url;
    const del = document.createElement('button');
    del.className = 'del';
    del.textContent = '×';
    del.title = 'Remove feed';
    del.addEventListener('click', async () => {
      feeds.splice(i, 1);
      await chrome.storage.local.set({ feeds });
      renderFeeds(feeds);
    });
    li.append(name, del);
    feedsEl.appendChild(li);
  });
}

function renderItems(items) {
  itemsEl.innerHTML = '';
  if (!items.length) {
    const li = document.createElement('li');
    li.className = 'empty';
    li.textContent = 'No headlines yet. Add a feed or hit Refresh.';
    itemsEl.appendChild(li);
    return;
  }
  // Newest-ish first: keep per-feed order, interleave round-robin for variety.
  items.slice(0, 60).forEach((it) => {
    const li = document.createElement('li');
    const a = document.createElement('a');
    a.href = it.link;
    a.target = '_blank';
    a.rel = 'noopener';
    const t = document.createElement('div');
    t.className = 'title';
    t.textContent = it.title;
    const m = document.createElement('div');
    m.className = 'meta';
    m.textContent = it.source;
    a.append(t, m);
    li.appendChild(a);
    itemsEl.appendChild(li);
  });
}

/* ---------- actions ---------- */
async function refresh() {
  const feeds = await getFeeds();
  renderFeeds(feeds);
  statusEl.textContent = 'Refreshing…';
  refreshBtn.disabled = true;
  const results = await Promise.all(feeds.map(fetchFeed));
  // Round-robin interleave so one big feed can't dominate the list.
  const merged = [];
  const lists = results.map((r) => r.slice(0, 12));
  for (let i = 0; ; i++) {
    let added = false;
    for (const list of lists) {
      if (list[i]) { merged.push(list[i]); added = true; }
    }
    if (!added) break;
  }
  renderItems(merged);
  statusEl.textContent = merged.length ? merged.length + ' headlines' : 'No headlines fetched';
  refreshBtn.disabled = false;
}

refreshBtn.addEventListener('click', refresh);

document.getElementById('feed-add').addEventListener('click', async () => {
  const input = document.getElementById('feed-url');
  const url = input.value.trim();
  if (!/^https?:\/\//i.test(url)) { input.focus(); return; }
  const feeds = await getFeeds();
  if (!feeds.includes(url)) {
    feeds.push(url);
    await chrome.storage.local.set({ feeds });
    renderFeeds(feeds);
  }
  input.value = '';
});

/* ---------- init ---------- */
refresh();
