/* FontStrip popup — strips inline font CSS from the active tab on user click.
   Injected functions are fully self-contained (func + args only, no cross-call
   page state). Original inline styles are backed up into a DOM data attribute
   per element, so restore is exact and survives popup reopening. */

const BACKUP_ATTR = 'data-fontstrip-backup';

// Property groups (stable names, matched case-insensitively via CSSStyleDeclaration)
const GROUPS = {
  family: ['font-family'],
  size: ['font-size', 'line-height'],
  style: ['font', 'font-weight', 'font-style', 'font-variant', 'font-stretch',
          'font-size-adjust', 'letter-spacing', 'word-spacing', 'text-transform'],
};

// --- Injected: strip. Returns {affected, removed}. ---
function stripFontsPage(propNames) {
  const BACKUP = 'data-fontstrip-backup';
  const names = propNames.map((n) => n.toLowerCase());
  let affected = 0, removed = 0;
  document.querySelectorAll('[style]').forEach((el) => {
    const s = el.style;
    let touched = false;
    for (const n of names) {
      if (s.getPropertyValue(n)) {
        if (!el.hasAttribute(BACKUP)) el.setAttribute(BACKUP, el.getAttribute('style') || '');
        s.removeProperty(n);
        touched = true; removed++;
      }
    }
    if (touched) affected++;
  });
  // If the shorthand 'font' survived but sub-props were removed, drop leftovers
  return { affected, removed };
}

// --- Injected: restore. Returns {restored}. ---
function restoreFontsPage() {
  const BACKUP = 'data-fontstrip-backup';
  let restored = 0;
  document.querySelectorAll('[' + BACKUP + ']').forEach((el) => {
    const original = el.getAttribute(BACKUP);
    if (original) el.setAttribute('style', original);
    else el.removeAttribute('style');
    el.removeAttribute(BACKUP);
    restored++;
  });
  return { restored };
}

// --- Injected: probe. Returns true if any backups exist. ---
function probeFontsPage() {
  return document.querySelectorAll('[data-fontstrip-backup]').length > 0;
}

// --- Popup wiring ---
const $ = (id) => document.getElementById(id);
const els = {
  badge: $('stateBadge'), grpFamily: $('grpFamily'), grpSize: $('grpSize'), grpStyle: $('grpStyle'),
  statsCard: $('statsCard'), statAffected: $('statAffected'), statProps: $('statProps'),
  stripBtn: $('stripBtn'), restoreBtn: $('restoreBtn'), note: $('pageNote'),
};

function selectedProps() {
  const out = [];
  // 'font' shorthand first: removing it clears its longhands, so later checks
  // see '' and counts stay accurate.
  if (els.grpStyle.checked) out.push(...GROUPS.style);
  if (els.grpFamily.checked) out.push(...GROUPS.family);
  if (els.grpSize.checked) out.push(...GROUPS.size);
  return out;
}
function setBadge(stripped) {
  els.badge.textContent = stripped ? 'Stripped' : 'Clean';
  els.badge.classList.toggle('active', stripped);
}
function setNote(msg) { els.note.textContent = msg; }

async function activeTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}
async function runOnPage(fn, args = []) {
  const tab = await activeTab();
  if (!tab?.id) throw new Error('No active tab.');
  if (!/^(https?|file):/.test(tab.url || '')) throw new Error('This page is restricted (e.g. chrome://) — try a normal web page.');
  const [res] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: fn, args });
  return res?.result;
}

function persist() {
  chrome.storage.local.set({ fontstrip: {
    family: els.grpFamily.checked, size: els.grpSize.checked, style: els.grpStyle.checked,
  }});
}
[els.grpFamily, els.grpSize, els.grpStyle].forEach((c) => c.addEventListener('change', persist));

els.stripBtn.addEventListener('click', async () => {
  const props = selectedProps();
  if (!props.length) { setNote('Tick at least one property group first.'); return; }
  try {
    setNote('Stripping…');
    const r = await runOnPage(stripFontsPage, [props]);
    els.statsCard.hidden = false;
    els.statAffected.textContent = r.affected;
    els.statProps.textContent = r.removed;
    setBadge(true);
    setNote(r.affected ? `Stripped ${r.removed} font propert${r.removed === 1 ? 'y' : 'ies'} from ${r.affected} element${r.affected === 1 ? '' : 's'}.` : 'No inline font styles found on this page.');
  } catch (e) { setNote(e.message); }
});

els.restoreBtn.addEventListener('click', async () => {
  try {
    const r = await runOnPage(restoreFontsPage);
    els.statsCard.hidden = true;
    setBadge(false);
    setNote(r.restored ? `Restored ${r.restored} element${r.restored === 1 ? '' : 's'} to the original styles.` : 'Nothing to restore — page already clean.');
  } catch (e) { setNote(e.message); }
});

// --- Init ---
(async () => {
  const stored = await chrome.storage.local.get('fontstrip');
  const s = stored.fontstrip || {};
  els.grpFamily.checked = s.family !== false;
  els.grpSize.checked = s.size !== false;
  els.grpStyle.checked = s.style !== false;
  try {
    const tab = await activeTab();
    const host = tab?.url ? new URL(tab.url).hostname : '';
    setNote(host ? `Ready — this tab: ${host}` : '');
    setBadge(await runOnPage(probeFontsPage));
  } catch { setBadge(false); }
})();
