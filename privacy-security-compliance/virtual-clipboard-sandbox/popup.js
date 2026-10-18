/* ==========================================================================
   Virtual Clipboard Sandbox — popup logic
   Renders on-device clip history with search, pin, copy-back and delete.
   ========================================================================== */

'use strict';

/** Storage keys */
const CLIPS_KEY = 'clips';
const SETTINGS_KEY = 'settings';

/** Max unpinned clips kept (pinned clips are always preserved). */
const MAX_CLIPS = 50;

/** Two-step confirm state for the Clear button. */
let clearArmed = false;
let clearArmTimer = null;

/** In-memory copy of clips for rendering/filtering. */
let clips = [];

/** Currently active search query. */
let query = '';

/* ------------------------------------------------------------------ */
/* Storage helpers                                                    */
/* ------------------------------------------------------------------ */

/** Load clips + settings from chrome.storage.local. */
async function loadState() {
  const data = await chrome.storage.local.get({ [CLIPS_KEY]: [], [SETTINGS_KEY]: { autoCapture: true } });
  clips = Array.isArray(data[CLIPS_KEY]) ? data[CLIPS_KEY] : [];
  return data[SETTINGS_KEY];
}

/** Persist the current clip list. */
async function saveClips() {
  await chrome.storage.local.set({ [CLIPS_KEY]: clips });
}

/* ------------------------------------------------------------------ */
/* Formatting helpers                                                 */
/* ------------------------------------------------------------------ */

/** Human-friendly relative timestamp. */
function relativeTime(ts) {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return mins + 'm ago';
  const hours = Math.floor(mins / 60);
  if (hours < 24) return hours + 'h ago';
  const days = Math.floor(hours / 24);
  return days + 'd ago';
}

/** Escape HTML so clip text can never break out of the DOM. */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/* ------------------------------------------------------------------ */
/* Rendering                                                          */
/* ------------------------------------------------------------------ */

/** Render the clip list (pinned first), honoring the search query. */
function render() {
  const list = document.getElementById('clipList');
  const empty = document.getElementById('emptyState');
  list.innerHTML = '';

  const q = query.trim().toLowerCase();
  const filtered = q
    ? clips.filter(c => c.text.toLowerCase().includes(q) || (c.source || '').toLowerCase().includes(q))
    : clips;

  document.getElementById('clipCount').textContent = clips.length;

  if (filtered.length === 0) {
    empty.classList.remove('hidden');
    if (q) empty.querySelector('p').innerHTML = 'No clips match “' + escapeHtml(query.trim()) + '”.';
    return;
  }
  empty.classList.add('hidden');

  const pinned = filtered.filter(c => c.pinned);
  const rest = filtered.filter(c => !c.pinned);

  if (pinned.length && !q) appendSection(list, 'Pinned');
  pinned.forEach(c => list.appendChild(clipCard(c)));
  if (pinned.length && rest.length && !q) appendSection(list, 'History');
  rest.forEach(c => list.appendChild(clipCard(c)));
}

/** Append a section label row. */
function appendSection(list, label) {
  const el = document.createElement('div');
  el.className = 'section-label';
  el.textContent = label;
  list.appendChild(el);
}

/** Build a single clip card element. */
function clipCard(clip) {
  const card = document.createElement('div');
  card.className = 'clip' + (clip.pinned ? ' pinned' : '');

  const text = document.createElement('div');
  text.className = 'clip-text';
  text.textContent = clip.text; // textContent: never interpreted as HTML
  card.appendChild(text);

  const meta = document.createElement('div');
  meta.className = 'clip-meta';

  const source = document.createElement('span');
  source.className = 'clip-source';
  source.textContent = (clip.source || 'unknown') + ' · ' + relativeTime(clip.ts);
  meta.appendChild(source);

  const tools = document.createElement('div');
  tools.className = 'clip-tools';

  // Pin toggle
  const pinBtn = document.createElement('button');
  pinBtn.className = 'icon-btn' + (clip.pinned ? ' active' : '');
  pinBtn.title = clip.pinned ? 'Unpin' : 'Pin';
  pinBtn.innerHTML = pinSvg();
  pinBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
    clip.pinned = !clip.pinned;
    await saveClips();
    render();
  });
  tools.appendChild(pinBtn);

  // Delete
  const delBtn = document.createElement('button');
  delBtn.className = 'icon-btn';
  delBtn.title = 'Delete clip';
  delBtn.innerHTML = trashSvg();
  delBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
    clips = clips.filter(c => c.id !== clip.id);
    await saveClips();
    render();
  });
  tools.appendChild(delBtn);

  meta.appendChild(tools);
  card.appendChild(meta);

  // Click the card itself to copy the clip back to the clipboard.
  card.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(clip.text);
      text.textContent = '✓ Copied!';
      setTimeout(() => { text.textContent = clip.text; }, 700);
    } catch (err) {
      console.warn('Copy-back failed:', err);
    }
  });

  return card;
}

/** Lucide-style pin icon. */
function pinSvg() {
  return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 17v5"/><path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16h14v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1z"/></svg>';
}

/** Lucide-style trash icon. */
function trashSvg() {
  return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>';
}

/* ------------------------------------------------------------------ */
/* Actions                                                            */
/* ------------------------------------------------------------------ */

/** Capture the current tab's selection into the sandbox. */
async function captureSelection() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id) return;
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => window.getSelection().toString().trim(),
    });
    const text = results && results[0] && results[0].result;
    if (text) {
      await addClip(text, new URL(tab.url).hostname);
    }
  } catch (err) {
    console.warn('Capture failed (restricted page?):', err);
  }
}

/**
 * Add a clip to history. Called by the popup and (via storage events)
 * indirectly by the content script / context menu path.
 */
async function addClip(text, source) {
  text = text.trim().slice(0, 5000); // sanity cap per clip
  if (!text) return;
  // De-dupe: move an identical existing clip to the top instead of cloning.
  clips = clips.filter(c => c.text !== text);
  clips.unshift({ id: 'c' + Date.now() + Math.floor(Math.random() * 1e6), text, source, ts: Date.now(), pinned: false });
  // Enforce cap while preserving pinned clips.
  const pinned = clips.filter(c => c.pinned);
  const unpinned = clips.filter(c => !c.pinned).slice(0, MAX_CLIPS);
  clips = [...pinned, ...unpinned].sort((a, b) => b.ts - a.ts);
  await saveClips();
  render();
}

/** Two-step confirm for wiping everything. */
function armClear(btn) {
  if (!clearArmed) {
    clearArmed = true;
    btn.classList.add('armed');
    btn.textContent = 'Sure?';
    clearArmTimer = setTimeout(() => {
      clearArmed = false;
      btn.classList.remove('armed');
      btn.textContent = 'Clear';
    }, 4000);
  } else {
    clearTimeout(clearArmTimer);
    clearArmed = false;
    btn.classList.remove('armed');
    btn.textContent = 'Clear';
    clips = [];
    saveClips().then(render);
  }
}

/* ------------------------------------------------------------------ */
/* Init                                                               */
/* ------------------------------------------------------------------ */

document.addEventListener('DOMContentLoaded', async () => {
  const settings = await loadState();

  const toggle = document.getElementById('autoCaptureToggle');
  toggle.checked = settings.autoCapture !== false;
  toggle.addEventListener('change', async () => {
    await chrome.storage.local.set({ [SETTINGS_KEY]: { autoCapture: toggle.checked } });
  });

  document.getElementById('searchInput').addEventListener('input', (e) => {
    query = e.target.value;
    render();
  });

  document.getElementById('captureBtn').addEventListener('click', captureSelection);
  document.getElementById('clearAllBtn').addEventListener('click', (e) => armClear(e.currentTarget));

  // Re-render when the content script saves a new clip while popup is open.
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes[CLIPS_KEY]) {
      clips = changes[CLIPS_KEY].newValue || [];
      render();
    }
  });

  render();
});
