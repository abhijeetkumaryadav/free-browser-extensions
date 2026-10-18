/* Deep Work Friction Blocker — popup logic.
   Manages session state + the editable friction-site list in chrome.storage.local. */
'use strict';

const DEFAULT_SITES = [
  'x.com', 'twitter.com', 'instagram.com', 'facebook.com',
  'tiktok.com', 'reddit.com', 'youtube.com', 'linkedin.com'
];
const STORAGE_KEYS = { session: 'dwf_session', sites: 'dwf_sites' };

// -- storage helpers ---------------------------------------------------------
async function getStored() {
  const data = await chrome.storage.local.get([STORAGE_KEYS.session, STORAGE_KEYS.sites]);
  return {
    session: data[STORAGE_KEYS.session] || null,
    sites: data[STORAGE_KEYS.sites] || [...DEFAULT_SITES]
  };
}
async function setStored(patch) { await chrome.storage.local.set(patch); }

// -- site list UI -------------------------------------------------------------
function renderSites(sites) {
  const list = document.getElementById('siteList');
  list.innerHTML = '';
  if (sites.length === 0) {
    const li = document.createElement('li');
    li.className = 'empty';
    li.textContent = 'No sites — add some above';
    list.appendChild(li);
    return;
  }
  for (const site of sites) {
    const li = document.createElement('li');
    li.textContent = site;
    const del = document.createElement('button');
    del.title = 'Remove ' + site;
    del.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>';
    del.addEventListener('click', async () => {
      const { sites: current } = await getStored();
      await setStored({ [STORAGE_KEYS.sites]: current.filter(s => s !== site) });
      renderSites(current.filter(s => s !== site));
    });
    li.appendChild(del);
    list.appendChild(li);
  }
}

function normalizeHost(raw) {
  return raw.trim().toLowerCase().replace(/^https?:\/\//, '').split('/')[0].replace(/^www\./, '');
}

async function addSiteFromInput() {
  const input = document.getElementById('siteInput');
  const host = normalizeHost(input.value);
  if (!host || !host.includes('.')) return;
  const { sites } = await getStored();
  if (!sites.includes(host)) {
    const next = [...sites, host];
    await setStored({ [STORAGE_KEYS.sites]: next });
    renderSites(next);
  }
  input.value = '';
}

// -- session UI ---------------------------------------------------------------
let selectedMinutes = 25;
let countdownTimer = null;

function fmtRemaining(ms) {
  const total = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(total / 60), s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function renderSession(session) {
  const stateEl = document.getElementById('sessionState');
  const detailEl = document.getElementById('sessionDetail');
  const toggle = document.getElementById('sessionToggle');
  clearInterval(countdownTimer);

  if (session && session.endsAt > Date.now()) {
    stateEl.textContent = 'Session active';
    stateEl.classList.add('active');
    toggle.textContent = 'End session early';
    toggle.classList.add('end');
    const tick = () => {
      const left = session.endsAt - Date.now();
      if (left <= 0) { renderSession(null); return; }
      detailEl.textContent = fmtRemaining(left) + ' remaining — friction is on';
    };
    tick();
    countdownTimer = setInterval(tick, 1000);
  } else {
    stateEl.textContent = 'No session active';
    stateEl.classList.remove('active');
    detailEl.textContent = 'Start a focus session below';
    toggle.textContent = 'Start focus session';
    toggle.classList.remove('end');
  }
}

async function toggleSession() {
  const { session } = await getStored();
  if (session && session.endsAt > Date.now()) {
    await setStored({ [STORAGE_KEYS.session]: null });
    await chrome.alarms.clear('dwf_session_end');
    renderSession(null);
  } else {
    const endsAt = Date.now() + selectedMinutes * 60 * 1000;
    await setStored({ [STORAGE_KEYS.session]: { startedAt: Date.now(), endsAt } });
    await chrome.alarms.create('dwf_session_end', { when: endsAt });
    renderSession({ endsAt });
  }
}

// -- init ---------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', async () => {
  const { session, sites } = await getStored();
  renderSites(sites);
  renderSession(session);

  document.querySelectorAll('#durationPills button').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#durationPills button').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedMinutes = parseInt(btn.dataset.min, 10);
    });
  });

  document.getElementById('addSite').addEventListener('click', addSiteFromInput);
  document.getElementById('siteInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') addSiteFromInput();
  });
  document.getElementById('sessionToggle').addEventListener('click', toggleSession);
});
