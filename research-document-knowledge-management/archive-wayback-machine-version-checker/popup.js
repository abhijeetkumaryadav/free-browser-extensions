/**
 * popup.js — Wayback Lens archive lookup.
 *
 * Read-only: on user click, queries the public Wayback Machine availability
 * API for the closest snapshot and the CDX API for a recent-snapshot
 * timeline. Nothing is stored; requests only ever go to web.archive.org /
 * archive.org.
 */

'use strict';

const AVAILABILITY_URL = 'https://archive.org/wayback/available';
const CDX_URL = 'https://web.archive.org/cdx/search/cdx';
const MAX_TIMELINE = 20; // cap on CDX rows fetched

const $ = id => document.getElementById(id);

function setStatus(msg, isError = false) {
  const el = $('status');
  el.textContent = msg;
  el.classList.toggle('error', isError);
}

/** "20240115123045" -> Date (UTC). */
function parseTimestamp(ts) {
  return new Date(Date.UTC(
    +ts.slice(0, 4), +ts.slice(4, 6) - 1, +ts.slice(6, 8),
    +ts.slice(8, 10), +ts.slice(10, 12), +ts.slice(12, 14)
  ));
}

function formatDate(ts) {
  return parseTimestamp(ts).toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

/** Canonicalize the tab URL for archive lookup (drop hash/fragment). */
function canonicalize(url) {
  try {
    const u = new URL(url);
    u.hash = '';
    return u.toString();
  } catch {
    return url;
  }
}

/** Fetch the closest available snapshot. */
async function fetchClosest(url) {
  const res = await fetch(
    `${AVAILABILITY_URL}?url=${encodeURIComponent(url)}&timestamp=${Date.now().toString().slice(0, 8)}`
  );
  if (!res.ok) throw new Error(`Archive API error (${res.status}).`);
  const data = await res.json();
  return data.archived_snapshots?.closest || null;
}

/** Fetch up to MAX_TIMELINE recent snapshots via the CDX API. */
async function fetchTimeline(url) {
  const params = new URLSearchParams({
    url,
    output: 'json',
    fl: 'timestamp,statuscode',
    filter: 'statuscode:200',
    collapse: 'digest',
    limit: String(MAX_TIMELINE)
  });
  const res = await fetch(`${CDX_URL}?${params}`);
  if (!res.ok) throw new Error(`CDX API error (${res.status}).`);
  const rows = await res.json();
  if (!Array.isArray(rows) || rows.length < 2) return []; // row 0 is the header
  return rows.slice(1).map(r => r[0]).filter(Boolean).sort().reverse();
}

/** Lightweight total-snapshot estimate (single capped CDX query). */
async function fetchSnapshotCount(url) {
  const params = new URLSearchParams({
    url,
    output: 'json',
    fl: 'timestamp',
    filter: 'statuscode:200',
    collapse: 'digest',
    limit: '10001'
  });
  const res = await fetch(`${CDX_URL}?${params}`);
  if (!res.ok) return null;
  const rows = await res.json();
  if (!Array.isArray(rows) || rows.length < 2) return 0;
  const count = rows.length - 1;
  return count >= 10001 ? '10,000+' : count.toLocaleString();
}

function renderTimeline(timeline, url) {
  const list = $('timeline');
  list.innerHTML = '';
  if (!timeline.length) {
    const li = document.createElement('li');
    li.className = 'empty';
    li.textContent = 'No recent successful snapshots found.';
    list.appendChild(li);
    return;
  }
  for (const ts of timeline) {
    const li = document.createElement('li');
    const span = document.createElement('span');
    span.className = 'ts';
    span.textContent = formatDate(ts);
    const btn = document.createElement('button');
    btn.className = 'link';
    btn.textContent = 'Open';
    btn.addEventListener('click', () => {
      chrome.tabs.create({ url: `https://web.archive.org/web/${ts}/${url}` });
    });
    li.appendChild(span);
    li.appendChild(btn);
    list.appendChild(li);
  }
}

async function onCheck() {
  const btn = $('checkBtn');
  const pageUrl = $('pageUrl').dataset.url;
  if (!pageUrl) { setStatus('No page URL available.', true); return; }
  btn.disabled = true;
  setStatus('Querying the Wayback Machine…');
  $('results').classList.add('hidden');
  try {
    const [closest, timeline, count] = await Promise.all([
      fetchClosest(pageUrl),
      fetchTimeline(pageUrl),
      fetchSnapshotCount(pageUrl)
    ]);
    if (!closest) {
      setStatus('No archived snapshots found for this URL.', true);
      return;
    }
    $('snapshotDate').textContent = formatDate(closest.timestamp);
    $('snapshotMeta').textContent =
      `Status ${closest.status || '—'} · ${closest.timestamp}`;
    $('openBtn').onclick = () => chrome.tabs.create({ url: closest.url });
    $('snapshotCount').textContent = count === null ? '—' : count;
    renderTimeline(timeline, pageUrl);
    $('results').classList.remove('hidden');
    setStatus('Lookup complete.');
  } catch (err) {
    setStatus(err.message || 'Lookup failed.', true);
  } finally {
    btn.disabled = false;
  }
}

async function init() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const url = tab?.url || '';
  const label = $('pageUrl');
  if (!url || /^(chrome|edge|about|brave):/.test(url)) {
    label.textContent = 'Not available on this page';
    $('checkBtn').disabled = true;
    return;
  }
  const clean = canonicalize(url);
  label.textContent = clean;
  label.dataset.url = clean;
  label.title = clean;
  $('checkBtn').addEventListener('click', onCheck);
}

document.addEventListener('DOMContentLoaded', init);
