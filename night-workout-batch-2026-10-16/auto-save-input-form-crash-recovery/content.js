// Form Saver content script — read-only snapshotting of text inputs on enabled pages.
//
// Design:
// - Runs ONLY on tabs where the user explicitly enabled Form Saver (the
//   "enabledOrigins" list in chrome.storage.local, set via the popup).
// - Debounced snapshotting: any 'input' event in the document waits 1500ms
//   of quiet, then stores a snapshot of eligible fields.
// - Eligible fields: text inputs (type text/search/url/email/tel/number),
//   textareas, and contenteditable regions. Password, file, checkbox, radio,
//   hidden and submit inputs are EXCLUDED on purpose.
// - Snapshot key is scoped to the page origin + pathname so restores are
//   offered only for the same page. Stored in session storage (survives
//   reloads/crashes of the tab, but vanishes when the browser fully quits).

// Boot-once guard: the popup checks this flag before injecting.
if (window.__formsaverLoaded) {
  // Already running on this page — do not duplicate listeners.
} else {
  window.__formsaverLoaded = true;
  boot();
}

function boot() {

const DEBOUNCE_MS = 1500;

let saveTimer = null;
let enabledForThisPage = false;

/* ------------------------------------------------------------------ */
/* eligibility                                                        */
/* ------------------------------------------------------------------ */

// True if this element is safe and useful to snapshot.
function isEligible(el) {
  if (!el) return false;
  const tag = el.tagName;
  if (el.isContentEditable) return true;
  if (tag === 'TEXTAREA') return !el.disabled && !el.readOnly;
  if (tag === 'INPUT') {
    if (el.disabled || el.readOnly) return false;
    const t = (el.type || 'text').toLowerCase();
    // Explicitly excluded: credentials and non-text controls.
    const excluded = new Set([
      'password', 'file', 'checkbox', 'radio', 'hidden', 'submit',
      'button', 'reset', 'image', 'color', 'range', 'date', 'time',
      'datetime-local', 'month', 'week'
    ]);
    if (excluded.has(t)) return false;
    return true;
  }
  return false;
}

// A stable-ish identity for a field: prefer name/id, else index among siblings.
function fieldKey(el) {
  if (el.name) return `name:${el.name}`;
  if (el.id) return `id:${el.id}`;
  const sibs = Array.from(el.parentNode ? el.parentNode.children : []).filter(
    (c) => c.tagName === el.tagName
  );
  return `idx:${sibs.indexOf(el)}`;
}

/* ------------------------------------------------------------------ */
/* snapshotting                                                       */
/* ------------------------------------------------------------------ */

// Collect the current values of all eligible fields into a plain object.
function collectSnapshot() {
  const fields = {};
  document
    .querySelectorAll('input, textarea, [contenteditable="true"]')
    .forEach((el) => {
      if (!isEligible(el)) return;
      const value = el.isContentEditable ? el.innerHTML : el.value;
      if (value && value.trim() !== '') fields[fieldKey(el)] = value;
    });
  return { url: location.href, savedAt: Date.now(), fields };
}

// Write the snapshot under a per-page key in session storage.
async function saveSnapshot() {
  const snap = collectSnapshot();
  const key = snapshotKey();
  const count = Object.keys(snap.fields).length;
  if (count === 0) {
    await chrome.storage.session.remove(key);
  } else {
    await chrome.storage.session.set({ [key]: snap });
  }
}

function snapshotKey() {
  return `formsaver:${location.origin}${location.pathname}`;
}

// Debounced wrapper: called on every input event.
function scheduleSave() {
  if (!enabledForThisPage) return;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveSnapshot().catch(() => { /* storage may be unavailable; ignore */ });
  }, DEBOUNCE_MS);
}

/* ------------------------------------------------------------------ */
/* restore                                                            */
/* ------------------------------------------------------------------ */

// Restore values for matching fields (message from popup).
function restoreSnapshot(snap) {
  let restored = 0;
  document
    .querySelectorAll('input, textarea, [contenteditable="true"]')
    .forEach((el) => {
      if (!isEligible(el)) return;
      const v = snap.fields[fieldKey(el)];
      if (v === undefined) return;
      if (el.isContentEditable) {
        el.innerHTML = v;
      } else {
        el.value = v;
      }
      el.dispatchEvent(new Event('input', { bubbles: true }));
      restored += 1;
    });
  return restored;
}

/* ------------------------------------------------------------------ */
/* boot                                                               */
/* ------------------------------------------------------------------ */

// Ask the background/popup state whether this origin is enabled.
async function init() {
  try {
    const { enabledOrigins = [] } = await chrome.storage.local.get('enabledOrigins');
    enabledForThisPage = enabledOrigins.includes(location.origin);
    if (!enabledForThisPage) return;
    document.addEventListener('input', scheduleSave, true);
    document.addEventListener('change', scheduleSave, true);
  } catch {
    /* storage unavailable — stay inert */
  }
}

// Message API used by the popup.
chrome.runtime.onMessage.addListener((msg, _sender, respond) => {
  if (msg.type === 'FORMSAVER_GET_SNAPSHOT') {
    chrome.storage.session.get(snapshotKey()).then((r) => {
      respond({ snapshot: r[snapshotKey()] || null });
    });
    return true; // async response
  }
  if (msg.type === 'FORMSAVER_RESTORE') {
    const n = restoreSnapshot(msg.snapshot);
    respond({ restored: n });
  }
  if (msg.type === 'FORMSAVER_CLEAR') {
    chrome.storage.session.remove(snapshotKey()).then(() => respond({ ok: true }));
    return true;
  }
});

init();

} // end boot()
