/* ClipVault — Clipboard History Manager
 * Clipboard is read ONLY when the user clicks "Capture clipboard".
 * Entries live in chrome.storage.local. Nothing is uploaded anywhere.
 */
'use strict';

const MAX_ENTRIES = 200;      // hard cap to bound storage use
const MAX_CHARS = 20000;      // truncate very large pastes

const listEl = document.getElementById('list');
const emptyEl = document.getElementById('emptyState');
const searchInput = document.getElementById('searchInput');
const expireSelect = document.getElementById('expireSelect');
const countBadge = document.getElementById('countBadge');
const toastEl = document.getElementById('toast');

let entries = [];   // [{id, text, ts, pinned}]
let toastTimer = null;

/* ---------- storage ---------- */
async function load() {
  const { entries: stored = [], expireDays = 7 } = await chrome.storage.local.get(['entries', 'expireDays']);
  entries = Array.isArray(stored) ? stored : [];
  expireSelect.value = String(expireDays);
  pruneExpired(expireDays, /*silent*/ true);
}
async function save() {
  await chrome.storage.local.set({ entries, expireDays: Number(expireSelect.value) });
}

/* ---------- expiry ---------- */
function pruneExpired(days, silent) {
  if (!days || days <= 0) return false;
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  // Pinned entries are immune to auto-expiry.
  const before = entries.length;
  entries = entries.filter(e => e.pinned || e.ts >= cutoff);
  if (entries.length !== before && !silent) toast('Expired entries removed');
  return entries.length !== before;
}

/* ---------- rendering ---------- */
const fmtTime = ts => new Date(ts).toLocaleString(undefined, {
  month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
});
const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function render() {
  const q = searchInput.value.trim().toLowerCase();
  const sorted = [...entries].sort((a, b) =>
    (b.pinned - a.pinned) || (b.ts - a.ts));
  const visible = q
    ? sorted.filter(e => e.text.toLowerCase().includes(q))
    : sorted;

  countBadge.textContent = entries.length;
  emptyEl.style.display = entries.length ? 'none' : 'flex';
  listEl.innerHTML = '';

  for (const e of visible) {
    const card = document.createElement('div');
    card.className = 'entry' + (e.pinned ? ' pinned' : '');
    card.setAttribute('role', 'listitem');
    card.title = 'Click to copy back to clipboard';
    card.innerHTML = `
      <div class="entry-head">
        <span class="pin-dot"></span>
        <span class="entry-time">${fmtTime(e.ts)}</span>
        <span class="entry-actions">
          <button class="icon-btn ${e.pinned ? 'active' : ''}" data-act="pin" title="${e.pinned ? 'Unpin' : 'Pin'}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 17v5"/><path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1z"/></svg>
          </button>
          <button class="icon-btn danger" data-act="del" title="Delete">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          </button>
        </span>
      </div>
      <div class="entry-text">${esc(e.text)}</div>`;

    card.addEventListener('click', async ev => {
      const btn = ev.target.closest('[data-act]');
      if (btn) {
        ev.stopPropagation();
        if (btn.dataset.act === 'pin') { e.pinned = !e.pinned; await save(); render(); }
        if (btn.dataset.act === 'del') {
          entries = entries.filter(x => x.id !== e.id);
          await save(); render(); toast('Entry deleted');
        }
        return;
      }
      // Click card body → copy back to clipboard.
      try {
        await navigator.clipboard.writeText(e.text);
        toast('Copied to clipboard');
      } catch { toast('Copy failed — grant clipboard access'); }
    });
    listEl.appendChild(card);
  }
}

/* ---------- toast ---------- */
function toast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), 1800);
}

/* ---------- events ---------- */
document.getElementById('captureBtn').addEventListener('click', async () => {
  try {
    // Explicit user gesture: the ONLY time we read the clipboard.
    const text = await navigator.clipboard.readText();
    if (!text || !text.trim()) { toast('Clipboard is empty'); return; }
    if (entries.some(e => e.text === text)) { toast('Already in vault'); return; }

    entries.unshift({
      id: 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
      text: text.slice(0, MAX_CHARS),
      ts: Date.now(),
      pinned: false
    });
    entries = entries.slice(0, MAX_ENTRIES);
    await save();
    render();
    toast('Captured');
  } catch {
    toast('Clipboard access denied — allow it in the address bar');
  }
});

document.getElementById('clearBtn').addEventListener('click', async () => {
  if (!entries.length) return;
  if (!confirm('Delete all clipboard entries?')) return;
  entries = [];
  await save();
  render();
  toast('Vault cleared');
});

searchInput.addEventListener('input', render);

expireSelect.addEventListener('change', async () => {
  pruneExpired(Number(expireSelect.value));
  await save();
  render();
});

/* ---------- init ---------- */
load().then(render);
