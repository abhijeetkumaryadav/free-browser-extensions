/* StripStats popup — controls the tracker content script, shows live stats + history. */
'use strict';

const $ = id => document.getElementById(id);
const fmt = s => `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`;
const esc = s => String(s??'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let tabId = null, poll = null;

// Ensure the content script is present in the active tab, then run fn(tabId).
async function withTracker(fn) {
  const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
  if (!tab?.id) throw new Error('No active tab');
  tabId = tab.id;
  try { await chrome.tabs.sendMessage(tabId, {cmd: 'status'}); }
  catch {
    await chrome.scripting.executeScript({target: {tabId}, files: ['tracker.js']});
  }
  return fn(tabId);
}
const msg = (m) => chrome.tabs.sendMessage(tabId, m).catch(() => null);

async function refresh() {
  let st = null;
  try { st = await withTracker(id => msg({cmd: 'status'})); } catch { /* unsupported page */ }
  if (!st || !st.ok) { setIdle('Unsupported page'); return; }
  $('sPanels').textContent = st.ppm ?? 0;
  $('sWpm').textContent = st.wpm ?? 0;
  $('sCount').textContent = st.count ?? 0;
  $('sTime').textContent = fmt(st.elapsed ?? 0);
  setTracking(!!st.tracking);
  $('hudBtn').textContent = 'HUD: ' + (st.hud ? 'on' : 'off');
}

function setTracking(on) {
  $('toggleBtn').textContent = on ? 'Stop tracking' : 'Start tracking';
  $('stateBadge').textContent = on ? 'Tracking' : 'Idle';
  $('stateBadge').classList.toggle('on', on);
  clearInterval(poll);
  if (on) poll = setInterval(refresh, 1000);
}
function setIdle(label) {
  $('stateBadge').textContent = label;
  $('toggleBtn').disabled = true;
}

$('toggleBtn').addEventListener('click', async () => {
  const wpp = Math.max(1, parseInt($('wpp').value) || 25);
  const minH = Math.max(50, parseInt($('minH').value) || 200);
  await chrome.storage.local.set({wpp, minH, hud: $('hudBtn').textContent.endsWith('on')});
  const st = await withTracker(id => msg({cmd: 'status'})).catch(() => null);
  if (st?.tracking) { await msg({cmd: 'stop'}); }
  else { await withTracker(id => msg({cmd: 'start', wpp, minH, hud: $('hudBtn').textContent.endsWith('on')})); }
  await refresh(); renderHistory();
});

$('hudBtn').addEventListener('click', async () => {
  const on = !$('hudBtn').textContent.endsWith('on');
  await withTracker(id => msg({cmd: 'hud', on})).catch(() => null);
  await chrome.storage.local.set({hud: on});
  refresh();
});

$('clearHist').addEventListener('click', async () => {
  await chrome.storage.local.set({history: []});
  renderHistory();
});

async function renderHistory() {
  const d = await chrome.storage.local.get(['history']);
  const list = $('histList'); list.innerHTML = '';
  const h = d.history || [];
  if (!h.length) { list.innerHTML = '<li class="empty">No sessions yet.</li>'; return; }
  h.forEach(s => {
    const li = document.createElement('li');
    const date = new Date(s.ts).toLocaleDateString(undefined, {month:'short', day:'numeric'});
    li.innerHTML = `<div class="grow"><strong>${s.ppm} panels/min · ${s.wpm} wpm</strong>
      <span>${date} · ${esc(s.url||'')} · ${s.count} panels in ${fmt(s.elapsed)}</span></div>`;
    list.appendChild(li);
  });
}

(async () => {
  const d = await chrome.storage.local.get(['wpp','minH','hud']);
  if (d.wpp) $('wpp').value = d.wpp;
  if (d.minH) $('minH').value = d.minH;
  if (d.hud === false) $('hudBtn').textContent = 'HUD: off';
  await refresh(); renderHistory();
})();
