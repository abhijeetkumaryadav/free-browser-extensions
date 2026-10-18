/* ============================================================================
 * Audio Track Isolator — popup logic
 * Uses scripting.executeScript with world:"MAIN" so the probe runs in the
 * page's own JS world and can read video.audioTracks directly.
 * The probe communicates back via window.postMessage; the isolated world
 * relays it through a temporary 'message' listener injected alongside.
 * ========================================================================== */
'use strict';

// Relay shim injected into the ISOLATED world: listens for the MAIN-world
// probe's postMessage replies and stores the latest one for the popup.
const RELAY_FN = () => {
  window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    const msg = event.data;
    if (!msg || msg.__ati !== true) return;
    // Stash on a known key the popup can read back.
    window.__atiLastReply = { cmd: msg.cmd, payload: msg.payload };
  });
};

// Ask the MAIN-world probe to do something, then read back its reply.
async function probeCommand(tabId, cmd, args = {}) {
  // 1. Ensure the relay listener exists in the isolated world.
  await chrome.scripting.executeScript({
    target: { tabId },
    world: 'ISOLATED',
    func: RELAY_FN
  });
  // 2. Ensure the probe exists in the MAIN world.
  await chrome.scripting.executeScript({
    target: { tabId },
    world: 'MAIN',
    files: ['probe.js']
  });
  // 3. Clear any stale reply, then dispatch the command.
  await chrome.scripting.executeScript({
    target: { tabId },
    world: 'ISOLATED',
    func: () => { window.__atiLastReply = null; }
  });
  await chrome.scripting.executeScript({
    target: { tabId },
    world: 'MAIN',
    func: (cmd, args) => {
      window.postMessage(Object.assign({ __ati: true, cmd }, args), '*');
    },
    args: [cmd, args]
  });
  // 4. Poll briefly for the reply (probe work is synchronous, so this is fast).
  for (let i = 0; i < 40; i++) {
    const res = await chrome.scripting.executeScript({
      target: { tabId },
      world: 'ISOLATED',
      func: () => window.__atiLastReply || null
    });
    const reply = res[0] && res[0].result;
    if (reply && reply.cmd === cmd + '-result') return reply.payload;
    await new Promise(r => setTimeout(r, 50));
  }
  throw new Error('Timed out waiting for the page probe.');
}

// ---- UI ------------------------------------------------------------------
const scanBtn = document.getElementById('scanBtn');
const statusEl = document.getElementById('status');
const resultsEl = document.getElementById('results');

function setStatus(html) {
  statusEl.innerHTML = html;
  statusEl.classList.remove('hidden');
}
function clearStatus() {
  statusEl.classList.add('hidden');
  statusEl.innerHTML = '';
}

// Friendly language label: "en" -> "EN"; "" -> "—".
function langBadge(lang) {
  if (!lang) return '—';
  return lang.length <= 3 ? lang.toUpperCase() : lang.toUpperCase().slice(0, 6);
}

function trackLabel(t) {
  if (t.label) return t.label;
  if (t.language) return 'Track ' + (t.index + 1) + ' · ' + t.language;
  return 'Track ' + (t.index + 1);
}

function renderVideos(videos) {
  resultsEl.innerHTML = '';
  if (!videos.length) {
    setStatus('No <code>&lt;video&gt;</code> elements found on this page.');
    return;
  }
  const multi = videos.filter(v => v.trackCount > 1);
  if (!multi.length) {
    const total = videos.reduce((n, v) => n + v.trackCount, 0);
    setStatus(
      'Found <strong>' + videos.length + '</strong> video' + (videos.length === 1 ? '' : 's') +
      ', but ' + (total === 0
        ? 'none of them expose audio tracks to the page'
        : 'each exposes only a single audio track') +
      '. Nothing to switch — the page (or its player) controls the audio.'
    );
    return;
  }
  clearStatus();
  multi.forEach(video => {
    const card = document.createElement('div');
    card.className = 'video-card';

    const head = document.createElement('div');
    head.className = 'video-head';
    const title = document.createElement('div');
    title.className = 'video-title';
    title.textContent = video.handle;
    title.title = video.handle;
    const badge = document.createElement('span');
    badge.className = 'badge';
    badge.textContent = video.trackCount + ' tracks';
    head.appendChild(title);
    head.appendChild(badge);
    card.appendChild(head);

    video.tracks.forEach(t => {
      const row = document.createElement('div');
      row.className = 'track' + (t.enabled ? ' active' : '');
      row.setAttribute('role', 'button');
      row.tabIndex = 0;

      const lang = document.createElement('div');
      lang.className = 'track-lang';
      lang.textContent = langBadge(t.language);

      const meta = document.createElement('div');
      meta.className = 'track-meta';
      const label = document.createElement('div');
      label.className = 'track-label';
      label.textContent = trackLabel(t);
      const kind = document.createElement('div');
      kind.className = 'track-kind';
      kind.textContent = (t.kind ? t.kind : 'audio') + (t.id ? ' · id ' + t.id : '');
      meta.appendChild(label);
      meta.appendChild(kind);

      const check = document.createElement('div');
      check.className = 'track-check';
      check.innerHTML =
        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
        'stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">' +
        '<path d="M20 6 9 17l-5-5"/></svg>';

      row.appendChild(lang);
      row.appendChild(meta);
      row.appendChild(check);

      const activate = async () => {
        try {
          const res = await withActiveTab((tabId) =>
            probeCommand(tabId, 'isolate', { videoIndex: video.index, trackIndex: t.index }));
          if (res && res.ok) {
            // Refresh the list so enabled states are accurate.
            await scan();
          } else {
            setStatus('Could not switch tracks (' + (res && res.reason ? res.reason : 'unknown') + ').');
          }
        } catch (e) {
          setStatus('Switch failed: ' + escapeHtml(e.message));
        }
      };
      row.addEventListener('click', activate);
      row.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activate(); }
      });

      card.appendChild(row);
    });

    const note = document.createElement('div');
    note.className = 'notice';
    note.textContent = 'Click a track to enable it and mute the others on this video.';
    card.appendChild(note);

    resultsEl.appendChild(card);
  });
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

async function withActiveTab(fn) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || tab.id == null) throw new Error('No active tab.');
  const url = tab.url || '';
  if (!/^https?:/.test(url)) {
    throw new Error('This page is browser-internal — extensions cannot run here.');
  }
  return fn(tab.id);
}

async function scan() {
  scanBtn.disabled = true;
  resultsEl.innerHTML = '';
  try {
    const videos = await withActiveTab((tabId) => probeCommand(tabId, 'scan'));
    // Remember the last scan for the session (handy, harmless).
    chrome.storage.local.set({ atiLastScan: { at: Date.now(), count: videos.length } }).catch(() => {});
    renderVideos(videos || []);
  } catch (e) {
    setStatus('Scan failed: ' + escapeHtml(e.message));
  } finally {
    scanBtn.disabled = false;
  }
}

scanBtn.addEventListener('click', scan);
