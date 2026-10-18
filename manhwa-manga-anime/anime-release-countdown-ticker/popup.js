/* HypeDrop — Anime Release Countdowns (popup)
 * User-entered release dates with live ticking countdowns.
 * All data lives in chrome.storage.local; nothing leaves the device.
 */
'use strict';

const STORAGE_KEY = 'hypedrop.releases.v1';
const listEl = document.getElementById('list');
const titleInput = document.getElementById('title-input');
const dateInput = document.getElementById('date-input');
const addBtn = document.getElementById('add-btn');
const addBtnLabel = document.getElementById('add-btn-label');
const cancelEditBtn = document.getElementById('cancel-edit-btn');
const countPill = document.getElementById('count-pill');

let releases = [];      // [{ id, title, at (epoch ms), notified }]
let editingId = null;   // id currently being edited, or null
let tickHandle = null;

/* ---------- storage ---------- */
async function load() {
  const data = await chrome.storage.local.get(STORAGE_KEY);
  releases = Array.isArray(data[STORAGE_KEY]) ? data[STORAGE_KEY] : [];
  // Sort: upcoming first (nearest), released at the bottom.
  releases.sort((a, b) => (a.at - Date.now()) - (b.at - Date.now()));
}

async function save() {
  await chrome.storage.local.set({ [STORAGE_KEY]: releases });
  // Tell the background worker to refresh alarms + badge.
  chrome.runtime.sendMessage({ type: 'hypedrop.refresh' }).catch(() => {});
}

/* ---------- helpers ---------- */
const pad = (n) => String(n).padStart(2, '0');

function parts(msLeft) {
  const s = Math.max(0, Math.floor(msLeft / 1000));
  return {
    days: Math.floor(s / 86400),
    hours: Math.floor((s % 86400) / 3600),
    mins: Math.floor((s % 3600) / 60),
    secs: s % 60
  };
}

function fmtDate(at) {
  return new Date(at).toLocaleString(undefined, {
    weekday: 'short', year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/* ---------- rendering ---------- */
function render() {
  const now = Date.now();
  countPill.textContent = `${releases.length} tracked`;

  if (releases.length === 0) {
    listEl.innerHTML = `
      <div class="empty">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>
        <p>No countdowns yet.<br>Add your first release above.</p>
      </div>`;
    return;
  }

  listEl.innerHTML = releases.map((r) => {
    const left = r.at - now;
    const released = left <= 0;
    const p = parts(left);
    return `
      <div class="item${released ? ' released' : ''}" data-id="${escapeHtml(r.id)}">
        <div class="item-top">
          <div>
            <div class="item-title">${escapeHtml(r.title)}</div>
            <div class="item-date">${escapeHtml(fmtDate(r.at))}${released ? ' · released' : ''}</div>
          </div>
          <div class="item-actions">
            <button class="btn icon edit-btn" title="Edit" aria-label="Edit">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
            </button>
            <button class="btn icon danger delete-btn" title="Delete" aria-label="Delete">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>
            </button>
          </div>
        </div>
        <div class="timer" aria-label="${released ? 'Released' : 'Time remaining'}">
          <div class="unit"><b>${p.days}</b><span>days</span></div>
          <div class="unit"><b>${pad(p.hours)}</b><span>hrs</span></div>
          <div class="unit"><b>${pad(p.mins)}</b><span>min</span></div>
          <div class="unit"><b>${pad(p.secs)}</b><span>sec</span></div>
        </div>
      </div>`;
  }).join('');

  listEl.querySelectorAll('.item').forEach((el) => {
    const id = el.dataset.id;
    el.querySelector('.edit-btn').addEventListener('click', () => startEdit(id));
    el.querySelector('.delete-btn').addEventListener('click', () => removeRelease(id));
  });
}

/* ---------- add / edit / delete ---------- */
function clearForm() {
  titleInput.value = '';
  dateInput.value = '';
  editingId = null;
  addBtnLabel.textContent = 'Add countdown';
  cancelEditBtn.classList.add('hidden');
}

function startEdit(id) {
  const r = releases.find((x) => x.id === id);
  if (!r) return;
  editingId = id;
  titleInput.value = r.title;
  // datetime-local expects "YYYY-MM-DDTHH:MM" in local time.
  const d = new Date(r.at);
  const local = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  dateInput.value = local;
  addBtnLabel.textContent = 'Save changes';
  cancelEditBtn.classList.remove('hidden');
  titleInput.focus();
}

async function removeRelease(id) {
  releases = releases.filter((x) => x.id !== id);
  if (editingId === id) clearForm();
  await save();
  render();
}

async function handleSubmit() {
  const title = titleInput.value.trim();
  const at = dateInput.value ? new Date(dateInput.value).getTime() : NaN;
  if (!title) { titleInput.focus(); return; }
  if (!Number.isFinite(at)) { dateInput.focus(); return; }

  if (editingId) {
    const r = releases.find((x) => x.id === editingId);
    if (r) { r.title = title; r.at = at; r.notified = false; }
  } else {
    releases.push({
      id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      title, at, notified: false
    });
  }
  clearForm();
  await save();
  await load();
  render();
}

/* ---------- events ---------- */
addBtn.addEventListener('click', handleSubmit);
cancelEditBtn.addEventListener('click', clearForm);
titleInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') handleSubmit(); });
dateInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') handleSubmit(); });

// Live ticking, 1s — only updates the numbers, cheap and local.
tickHandle = setInterval(render, 1000);

/* ---------- init ---------- */
(async function init() {
  await load();
  render();
})();
