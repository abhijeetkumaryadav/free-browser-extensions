/* XML Feed Ticker Bar — service worker.
 * Refreshes the user's own RSS/Atom feeds on a 15-minute alarm, parses them
 * with DOMParser, and keeps unread items in chrome.storage.local.
 * Only feed URLs the user explicitly added are ever fetched. */
'use strict';

const REFRESH_MINUTES = 15;
const MAX_ITEMS = 200;      // cap stored items so storage stays small
const FETCH_TIMEOUT_MS = 15000;

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

async function getState() {
  const { feeds = [], items = [] } = await chrome.storage.local.get(['feeds', 'items']);
  return {
    feeds: Array.isArray(feeds) ? feeds : [],
    items: Array.isArray(items) ? items : []
  };
}

/* ---------- lifecycle ---------- */
chrome.runtime.onInstalled.addListener(async () => {
  chrome.alarms.create('refresh-feeds', { periodInMinutes: REFRESH_MINUTES });
  await refreshAllFeeds();
});
chrome.runtime.onStartup.addListener(() => refreshAllFeeds());
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'refresh-feeds') refreshAllFeeds();
});

/* ---------- fetching & parsing ---------- */

/** Fetch a feed URL with a hard timeout. Throws on network/HTTP failure. */
async function fetchFeed(url) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: ctrl.signal, redirect: 'follow' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    if (!text.trim()) throw new Error('Empty response');
    return text;
  } catch (err) {
    if (err.name === 'AbortError') throw new Error('Timed out');
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

const textOf = (el, sel) => el.querySelector(sel)?.textContent?.trim() || '';

/** Parse RSS 2.0 or Atom XML into { title, entries: [{title, link, pubDate}] }. */
function parseFeed(xmlText) {
  const doc = new DOMParser().parseFromString(xmlText, 'text/xml');
  if (doc.querySelector('parsererror')) throw new Error('Not a valid XML feed');

  const entries = [];
  const seen = new Set();

  // RSS 2.0: <channel><item>
  doc.querySelectorAll('channel > item').forEach((el) => {
    const link = textOf(el, 'link');
    if (!link || seen.has(link)) return;
    seen.add(link);
    entries.push({
      title: textOf(el, 'title') || '(untitled)',
      link,
      pubDate: Date.parse(textOf(el, 'pubDate')) || 0
    });
  });

  // Atom: <feed><entry>
  if (!entries.length) {
    doc.querySelectorAll('feed > entry').forEach((el) => {
      const linkEl = el.querySelector('link[href]') || el.querySelector('link');
      const link = linkEl?.getAttribute('href')?.trim() || textOf(el, 'link');
      if (!link || seen.has(link)) return;
      seen.add(link);
      entries.push({
        title: textOf(el, 'title') || '(untitled)',
        link,
        pubDate: Date.parse(textOf(el, 'updated') || textOf(el, 'published')) || 0
      });
    });
  }

  if (!entries.length) throw new Error('No items found (RSS/Atom required)');

  const title =
    textOf(doc, 'channel > title') || textOf(doc, 'feed > title') || 'Untitled feed';
  return { title, entries };
}

/* ---------- refresh ---------- */

/** Refresh every unmuted feed; errors are recorded per-feed, never thrown. */
async function refreshAllFeeds() {
  const { feeds, items } = await getState();
  const known = new Set(items.map((i) => i.feedId + '|' + i.link));

  for (const feed of feeds) {
    if (feed.muted) continue;
    try {
      const { title, entries } = parseFeed(await fetchFeed(feed.url));
      feed.title = title;
      feed.error = null;
      feed.lastChecked = Date.now();
      for (const e of entries) {
        const key = feed.id + '|' + e.link;
        if (known.has(key)) continue;
        known.add(key);
        items.push({
          id: uid(), feedId: feed.id, feedName: title,
          title: e.title, link: e.link, pubDate: e.pubDate,
          read: false, receivedAt: Date.now()
        });
      }
    } catch (err) {
      feed.error = err.message || 'Fetch failed';
      feed.lastChecked = Date.now();
    }
  }

  // Newest first, capped.
  items.sort((a, b) => (b.pubDate || b.receivedAt) - (a.pubDate || a.receivedAt));
  const trimmed = items.slice(0, MAX_ITEMS);

  await chrome.storage.local.set({ feeds, items: trimmed });
  await updateBadge(trimmed);
}

/** Toolbar badge shows the unread count. */
async function updateBadge(items) {
  const unread = items.filter((i) => !i.read).length;
  await chrome.action.setBadgeText({ text: unread > 0 ? String(Math.min(unread, 99)) : '' });
  await chrome.action.setBadgeBackgroundColor({ color: '#10b981' });
}

/* ---------- messages from the popup ---------- */
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  (async () => {
    const { feeds, items } = await getState();

    switch (msg.type) {
      case 'get-state':
        sendResponse({ feeds, items });
        break;

      case 'add-feed': {
        const url = String(msg.url || '').trim();
        if (!/^https?:\/\//i.test(url)) {
          sendResponse({ ok: false, error: 'Enter a full http(s) URL.' });
          break;
        }
        if (feeds.some((f) => f.url === url)) {
          sendResponse({ ok: false, error: 'That feed is already added.' });
          break;
        }
        const feed = { id: uid(), url, title: url, muted: false, error: null, lastChecked: 0 };
        feeds.push(feed);
        await chrome.storage.local.set({ feeds });
        // Fetch immediately so the user gets feedback.
        try {
          const { title, entries } = parseFeed(await fetchFeed(url));
          feed.title = title; feed.lastChecked = Date.now();
          const known = new Set(items.map((i) => i.feedId + '|' + i.link));
          for (const e of entries) {
            const key = feed.id + '|' + e.link;
            if (known.has(key)) continue;
            known.add(key);
            items.push({ id: uid(), feedId: feed.id, feedName: title, title: e.title, link: e.link, pubDate: e.pubDate, read: false, receivedAt: Date.now() });
          }
          items.sort((a, b) => (b.pubDate || b.receivedAt) - (a.pubDate || a.receivedAt));
          await chrome.storage.local.set({ feeds, items: items.slice(0, MAX_ITEMS) });
          await updateBadge(items);
          sendResponse({ ok: true });
        } catch (err) {
          feed.error = err.message || 'Fetch failed';
          feed.lastChecked = Date.now();
          await chrome.storage.local.set({ feeds });
          sendResponse({ ok: false, error: `Added, but couldn't fetch: ${feed.error}` });
        }
        break;
      }

      case 'remove-feed': {
        const id = msg.id;
        const keptFeeds = feeds.filter((f) => f.id !== id);
        const keptItems = items.filter((i) => i.feedId !== id);
        await chrome.storage.local.set({ feeds: keptFeeds, items: keptItems });
        await updateBadge(keptItems);
        sendResponse({ ok: true });
        break;
      }

      case 'toggle-mute': {
        const f = feeds.find((x) => x.id === msg.id);
        if (f) { f.muted = !f.muted; await chrome.storage.local.set({ feeds }); }
        sendResponse({ ok: true });
        break;
      }

      case 'mark-read': {
        const it = items.find((x) => x.id === msg.id);
        if (it) { it.read = true; await chrome.storage.local.set({ items }); await updateBadge(items); }
        sendResponse({ ok: true });
        break;
      }

      case 'mark-all-read': {
        items.forEach((i) => { i.read = true; });
        await chrome.storage.local.set({ items });
        await updateBadge(items);
        sendResponse({ ok: true });
        break;
      }

      case 'refresh-now':
        await refreshAllFeeds();
        sendResponse({ ok: true });
        break;

      default:
        sendResponse({ ok: false, error: 'Unknown message' });
    }
  })();
  return true; // async response
});
