/* Clip Tagger — popup logic. Read-only interaction with the YouTube page. */
'use strict';

/** Runs in the page to read the player state (MAIN world, no page modification). */
function probePlayer() {
  const video = document.querySelector('video');
  const url = new URL(location.href);
  return {
    isWatch: /(^|\.)youtube\.com$/.test(location.hostname) && url.pathname === '/watch' && !!url.searchParams.get('v'),
    videoId: url.searchParams.get('v') || null,
    title: document.title.replace(/ - YouTube$/, '') || 'Untitled video',
    time: video ? Math.floor(video.currentTime) : null,
    pageUrl: location.href.split('&')[0]
  };
}

/** Runs in the page to seek the video to a timestamp. */
function seekVideo(seconds) {
  const video = document.querySelector('video');
  if (video) { video.currentTime = seconds; video.play().catch(() => {}); }
  return !!video;
}

/* ---------- helpers ---------- */
const $ = (id) => document.getElementById(id);
const state = { videoId: null, title: '', pageUrl: '', clips: [] };

function fmt(total) {
  const h = Math.floor(total / 3600), m = Math.floor((total % 3600) / 60), s = total % 60;
  const mm = h > 0 ? String(m).padStart(2, '0') : String(m);
  return (h > 0 ? h + ':' : '') + mm + ':' + String(s).padStart(2, '0');
}
function esc(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function storeKey() { return 'clips:' + state.videoId; }

async function loadClips() {
  const data = await chrome.storage.local.get(storeKey());
  state.clips = data[storeKey()] || [];
}
async function saveClips() {
  await chrome.storage.local.set({ [storeKey()]: state.clips });
}

/* ---------- rendering ---------- */
function render() {
  const list = $('clipList');
  list.innerHTML = '';
  const clips = [...state.clips].sort((a, b) => a.time - b.time);
  $('emptyState').classList.toggle('hidden', clips.length > 0 || !state.videoId);
  $('actionsCard').classList.toggle('hidden', clips.length === 0);

  for (const c of clips) {
    const li = document.createElement('li');
    li.className = 'clip';
    li.innerHTML =
      '<button class="time-badge" data-seek="' + c.time + '" title="Seek to ' + fmt(c.time) + '">' + fmt(c.time) + '</button>' +
      '<div class="clip-body"><span class="chip">' + esc(c.label) + '</span>' +
      (c.note ? '<div class="note">' + esc(c.note) + '</div>' : '') + '</div>' +
      '<button class="icon-btn del" data-del="' + c.id + '" title="Delete">' +
      '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 6h18"/><path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg></button>';
    list.appendChild(li);
  }
  list.querySelectorAll('[data-seek]').forEach((b) =>
    b.addEventListener('click', () => seekTo(Number(b.dataset.seek))));
  list.querySelectorAll('[data-del]').forEach((b) =>
    b.addEventListener('click', async () => {
      state.clips = state.clips.filter((c) => c.id !== b.dataset.del);
      await saveClips();
      render();
    }));
}

async function seekTo(seconds) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id) chrome.scripting.executeScript({ target: { tabId: tab.id }, func: seekVideo, args: [seconds] });
}

/* ---------- export ---------- */
function download(filename, text, mime) {
  const blob = new Blob([text], { type: mime });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
function sortedClips() { return [...state.clips].sort((a, b) => a.time - b.time); }

function exportMarkdown() {
  const lines = ['# ' + state.title, '', 'Source: ' + state.pageUrl, ''];
  for (const c of sortedClips()) {
    const link = state.pageUrl + '&t=' + c.time + 's';
    lines.push('- [' + fmt(c.time) + '](' + link + ') **' + c.label + '**' + (c.note ? ' — ' + c.note : ''));
  }
  download('clips-' + state.videoId + '.md', lines.join('\n'), 'text/markdown');
  navigator.clipboard?.writeText(lines.join('\n')).catch(() => {});
}
function exportCSV() {
  const rows = [['timestamp', 'seconds', 'label', 'note', 'url']];
  for (const c of sortedClips()) {
    rows.push(['"' + fmt(c.time) + '"', c.time, '"' + c.label.replace(/"/g, '""') + '"',
      '"' + (c.note || '').replace(/"/g, '""') + '"', state.pageUrl + '&t=' + c.time + 's']);
  }
  download('clips-' + state.videoId + '.csv', rows.map((r) => r.join(',')).join('\n'), 'text/csv');
}

/* ---------- init ---------- */
async function init() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) { $('notYoutube').classList.remove('hidden'); return; }

  let probe;
  try {
    const res = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: probePlayer });
    probe = res?.[0]?.result;
  } catch { probe = null; }

  if (!probe?.isWatch) { $('notYoutube').classList.remove('hidden'); return; }

  state.videoId = probe.videoId;
  state.title = probe.title;
  state.pageUrl = 'https://www.youtube.com/watch?v=' + probe.videoId;
  $('videoTitle').textContent = probe.title;
  $('captureCard').classList.remove('hidden');

  await loadClips();
  render();

  $('captureBtn').addEventListener('click', async () => {
    const res = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: probePlayer });
    const t = res?.[0]?.result?.time;
    if (t == null) return;
    state.clips.push({
      id: 'c' + Date.now().toString(36),
      time: t,
      label: $('labelSel').value,
      note: $('noteInput').value.trim()
    });
    $('noteInput').value = '';
    await saveClips();
    render();
  });

  $('mdBtn').addEventListener('click', exportMarkdown);
  $('csvBtn').addEventListener('click', exportCSV);
  $('clearBtn').addEventListener('click', async () => {
    if (!confirm('Delete all timestamps for this video?')) return;
    state.clips = [];
    await saveClips();
    render();
  });
}

document.addEventListener('DOMContentLoaded', init);
