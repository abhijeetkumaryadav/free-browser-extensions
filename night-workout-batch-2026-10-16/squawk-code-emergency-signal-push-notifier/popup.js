'use strict';
/* Squawk Code Reference — popup logic + testable engine.
 * ENGINE: pure data lookup between ENGINE-START / ENGINE-END. */

// ENGINE-START
/* Common transponder code table (educational reference data). */
const COMMON_CODES = [
  ['1200', 'VFR (USA)'],
  ['2000', 'IFR before ATC code assigned (EU)'],
  ['7000', 'VFR (EU)'],
  ['7500', 'Unlawful interference (hijack)'],
  ['7600', 'Radio failure'],
  ['7700', 'Emergency'],
  ['7777', 'Military interceptor ops (non-discrete)'],
  ['0000', 'Military (US, non-discrete)'],
];

/* Find the reference meaning for a 4-digit octal squawk code. Returns null for invalid/unknown. */
function lookupCode(code) {
  const c = String(code).trim();
  if (!/^[0-7]{4}$/.test(c)) return null;          // squawk codes are octal, 4 digits
  const hit = COMMON_CODES.find(r => r[0] === c);
  return hit ? { code: hit[0], meaning: hit[1] } : { code: c, meaning: 'Assigned discrete code (issued by ATC)' };
}
// ENGINE-END

const NOTES_KEY = 'squawk_notes';

// Render the common code table.
function renderTable() {
  const body = document.getElementById('tblBody');
  body.innerHTML = COMMON_CODES.map(([c, m]) =>
    `<tr><td>${c}</td><td>${escapeHtml(m)}</td></tr>`).join('');
}

// Minimal HTML escaper for static reference text.
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, ch =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

// Persist/restore personal notes locally.
async function initNotes() {
  const ta = document.getElementById('notes');
  const { [NOTES_KEY]: saved } = await chrome.storage.local.get(NOTES_KEY);
  if (saved) ta.value = saved;
  let t;
  ta.addEventListener('input', () => {
    clearTimeout(t);
    t = setTimeout(() => chrome.storage.local.set({ [NOTES_KEY]: ta.value }), 300);
  });
}

renderTable();
initNotes();
