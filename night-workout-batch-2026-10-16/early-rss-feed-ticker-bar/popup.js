// RSS Ticker — popup controller.
// Fetches ONLY the feed URLs the user adds (RSS 2.0 + Atom), parses them with
// DOMParser, and renders headlines. Clicking a headline opens the article in a
// new tab. Engine functions sit between ENGINE markers so they can be tested
// headlessly with node.

/* ============ ENGINE-START ============ */
function parseFeed(xmlText, feedUrl) {
  // Returns { title, items: [{title, link, date}] } or throws on bad XML.
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, 'text/xml');
  if (doc.querySelector('parsererror')) throw new Error('Not a valid feed XML.');
  const items = [];
  // RSS 2.0
  const channel = doc.querySelector('channel');
  if (channel) {
    const title = (channel.querySelector(':scope > title') || {}).textContent || feedUrl;
    channel.querySelectorAll(':scope > item').forEach((it) => {
      items.push({
        title: textOf(it, 'title') || '(untitled)',
        link: textOf(it, 'link') || '',
        date: dateOf(textOf(it, 'pubDate'))
      });
    });
    return { title: title.trim(), items };
  }
  // Atom
  const feedTitle = doc.querySelector('feed > title');
  doc.querySelectorAll('feed > entry').forEach((en) => {
    const linkEl = en.querySelector('link[rel="alternate"]') || en.querySelector('link[href]');
    items.push({
      title: textOf(en, 'title') || '(untitled)',
      link: linkEl ? (linkEl.getAttribute('href') || '') : '',
      date: dateOf(textOf(en, 'updated') || textOf(en, 'published'))
    });
  });
  return { title: feedTitle ? feedTitle.textContent.trim() : feedUrl, items };
}

function textOf(parent, tag) {
  const el = parent.querySelector(':scope > ' + tag);
  return el ? el.textContent.trim() : '';
}

function dateOf(s) {
  if (!s) return 0;
  const t = Date.parse(s);
  return Number.isNaN(t) ? 0 : t;
}

function normaliseUrl(raw) {
  const u = (raw || '').trim();
  if (!u) throw new Error('Enter a feed URL.');
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(u) && !/^https?:\/\//i.test(u)) {
    throw new Error('Only http(s) feeds are supported.');
  }
  const withScheme = /^https?:\/\//i.test(u) ? u : 'https://' + u;
  const parsed = new URL(withScheme); // throws on garbage
  if (!/^https?:$/.test(parsed.protocol)) throw new Error('Only http(s) feeds are supported.');
  return parsed.href;
}
/* ============ ENGINE-END ============ */

const $ = (id) => document.getElementById(id);
const feedUrlInput = $('feedUrl'), addBtn = $('addBtn'), refreshBtn = $('refreshBtn');
const feedListEl = $('feedList'), itemListEl = $('itemList'), tickerEl = $('ticker');
const errorMsg = $('errorMsg'), statusLine = $('statusLine');

const STORE_KEY = 'rssTicker.feeds.v1';
let feeds = []; // [{url, title}]
let allItems = []; // [{title, link, date, src}]

async function loadFeeds() {
  const data = await chrome.storage.local.get(STORE_KEY);
  feeds = data[STORE_KEY] || [];
}
async function saveFeeds() {
  await chrome.storage.local.set({ [STORE_KEY]: feeds });
}

function showError(msg) { errorMsg.textContent = msg || ''; }

async function fetchFeed(url) {
  // The only network requests this extension ever makes: user-added feeds.
  const res = await fetch(url, { headers: { Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml' } });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const text = await res.text();
  return parseFeed(text, url);
}

function renderFeeds() {
  feedListEl.innerHTML = '';
  feeds.forEach((f, i) => {
    const chip = document.createElement('span');
    chip.className = 'chip';
    const nm = document.createElement('span');
    nm.className = 'nm';
    nm.textContent = f.title || f.url;
    nm.title = f.url;
    const x = document.createElement('button');
    x.textContent = '×';
    x.title = 'Remove feed';
    x.addEventListener('click', async () => {
      feeds.splice(i, 1);
      await saveFeeds();
      renderFeeds();
      refreshAll();
    });
    chip.append(nm, x);
    feedListEl.appendChild(chip);
  });
}

function renderItems() {
  itemListEl.innerHTML = '';
  const sorted = allItems.slice().sort((a, b) => b.date - a.date).slice(0, 60);
  if (!sorted.length) {
    itemListEl.innerHTML = '<p class="empty">No headlines yet — add a feed and hit refresh.</p>';
    return;
  }
  sorted.forEach((it) => {
    const b = document.createElement('button');
    b.className = 'item';
    const src = document.createElement('span');
    src.className = 'src';
    src.textContent = it.src;
    const t = document.createElement('span');
    t.textContent = it.title;
    b.append(src, t);
    if (it.date) {
      const d = document.createElement('span');
      d.className = 'dt';
      d.textContent = new Date(it.date).toLocaleString();
      b.appendChild(d);
    }
    b.addEventListener('click', () => {
      if (it.link) chrome.tabs.create({ url: it.link });
    });
    itemListEl.appendChild(b);
  });
  // Ticker: top 8 headlines scrolling.
  const heads = sorted.slice(0, 8).map((it) => it.title.replace(/\s+/g, ' ').trim());
  tickerEl.textContent = heads.join('  •  ');
  tickerEl.classList.remove('paused');
}

async function refreshAll() {
  showError('');
  if (!feeds.length) {
    statusLine.textContent = 'No feeds yet.';
    tickerEl.textContent = 'Add a feed to start the ticker.';
    renderItems();
    return;
  }
  refreshBtn.classList.add('spin');
  allItems = [];
  let ok = 0, failed = 0;
  for (const f of feeds) {
    try {
      const parsed = await fetchFeed(f.url);
      if (parsed.title && parsed.title !== f.url) {
        f.title = parsed.title;
        await saveFeeds();
      }
      parsed.items.forEach((it) => allItems.push({ ...it, src: parsed.title }));
      ok++;
    } catch (err) {
      failed++;
      console.warn('Feed failed:', f.url, err);
    }
  }
  renderFeeds();
  renderItems();
  statusLine.textContent = failed
    ? ok + ' feed(s) updated, ' + failed + ' failed.'
    : ok + ' feed(s) updated just now.';
  refreshBtn.classList.remove('spin');
}

addBtn.addEventListener('click', async () => {
  showError('');
  try {
    const url = normaliseUrl(feedUrlInput.value);
    if (feeds.some((f) => f.url === url)) {
      showError('That feed is already added.');
      return;
    }
    feeds.push({ url, title: url });
    await saveFeeds();
    feedUrlInput.value = '';
    renderFeeds();
    refreshAll();
  } catch (err) {
    showError(err.message);
  }
});
feedUrlInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') addBtn.click(); });
refreshBtn.addEventListener('click', refreshAll);

(async function init() {
  await loadFeeds();
  renderFeeds();
  refreshAll();
})();
