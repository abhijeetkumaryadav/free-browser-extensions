// Layout Saver — popup logic
// Saves named snapshots of all normal browser windows (position + size)
// and restores them on click. No content scripts; fully local.
'use strict';

const STORAGE_KEY = 'layoutSaver.layouts.v1';

const layoutNameInput = document.getElementById('layoutName');
const saveBtn = document.getElementById('saveBtn');
const layoutList = document.getElementById('layoutList');
const emptyEl = document.getElementById('empty');
const windowInfo = document.getElementById('windowInfo');

// ---------------------------------------------------------------------------
// Storage helpers
// ---------------------------------------------------------------------------
async function loadLayouts() {
  const data = await chrome.storage.local.get(STORAGE_KEY);
  return data[STORAGE_KEY] || {};
}

async function saveLayouts(layouts) {
  await chrome.storage.local.set({ [STORAGE_KEY]: layouts });
}

// ---------------------------------------------------------------------------
// Capture / restore
// ---------------------------------------------------------------------------
async function captureWindows() {
  const wins = await chrome.windows.getAll({});
  return wins
    .filter(w => w.type === 'normal')
    .map(w => ({
      left: w.left, top: w.top,
      width: w.width, height: w.height,
      state: w.state
    }));
}

async function restoreLayout(windows) {
  const current = await chrome.windows.getAll({ windowTypes: ['normal'] });
  // Restore the first N windows in creation order; ignore extras.
  const targets = current.slice(0, windows.length);
  for (let i = 0; i < targets.length; i++) {
    const snap = windows[i];
    try {
      await chrome.windows.update(targets[i].id, {
        left: snap.left, top: snap.top,
        width: snap.width, height: snap.height,
        state: snap.state === 'maximized' || snap.state === 'fullscreen' ? snap.state : 'normal'
      });
    } catch (e) {
      console.warn('Could not restore window', targets[i].id, e);
    }
  }
  return targets.length;
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

async function render() {
  const layouts = await loadLayouts();
  const names = Object.keys(layouts).sort();
  layoutList.innerHTML = '';
  emptyEl.style.display = names.length ? 'none' : 'block';

  const current = await captureWindows();
  windowInfo.textContent = `Detected ${current.length} window${current.length === 1 ? '' : 's'} right now.`;

  for (const name of names) {
    const snap = layouts[name];
    const li = document.createElement('li');
    li.className = 'item';
    li.innerHTML = `
      <div class="row"><span class="name">${escapeHtml(name)}</span></div>
      <div class="meta">${snap.windows.length} window${snap.windows.length === 1 ? '' : 's'} · saved ${new Date(snap.savedAt).toLocaleString()}</div>
      <div class="actions">
        <button class="btn accent small" data-act="restore">Restore</button>
        <button class="btn small" data-act="overwrite">Overwrite with current</button>
        <button class="btn danger small" data-act="delete">Delete</button>
      </div>`;
    li.querySelector('[data-act="restore"]').addEventListener('click', async (e) => {
      e.target.disabled = true;
      const n = await restoreLayout(snap.windows);
      e.target.textContent = n ? `Restored ${n}` : 'No windows';
      setTimeout(() => { e.target.disabled = false; e.target.textContent = 'Restore'; }, 1500);
    });
    li.querySelector('[data-act="overwrite"]').addEventListener('click', async () => {
      const all = await loadLayouts();
      all[name] = { windows: await captureWindows(), savedAt: Date.now() };
      await saveLayouts(all);
      render();
    });
    li.querySelector('[data-act="delete"]').addEventListener('click', async () => {
      if (!confirm(`Delete layout "${name}"?`)) return;
      const all = await loadLayouts();
      delete all[name];
      await saveLayouts(all);
      render();
    });
    layoutList.appendChild(li);
  }
}

// ---------------------------------------------------------------------------
// Save flow
// ---------------------------------------------------------------------------
saveBtn.addEventListener('click', async () => {
  const name = layoutNameInput.value.trim();
  if (!name) { layoutNameInput.focus(); return; }
  const all = await loadLayouts();
  all[name] = { windows: await captureWindows(), savedAt: Date.now() };
  await saveLayouts(all);
  layoutNameInput.value = '';
  render();
});
layoutNameInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') saveBtn.click();
});

render();
