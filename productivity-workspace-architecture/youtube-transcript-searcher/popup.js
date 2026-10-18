/* YouTube Transcript Searcher — popup logic.
 * 1. Confirms the active tab is a YouTube watch page.
 * 2. MAIN-world probe reads ytInitialPlayerResponse caption tracks.
 * 3. Injects content.js (isolated) which fetches the chosen public
 *    caption track and seeks the video on cue click. */

'use strict';

const $ = (id) => document.getElementById(id);

const noticeEl = $('notice');
const trackRowEl = $('track-row');
const trackSelectEl = $('track-select');
const searchRowEl = $('search-row');
const searchInputEl = $('search');
const matchCountEl = $('match-count');
const linesEl = $('lines');
const emptyEl = $('empty');
const cueCountEl = $('cue-count');
const videoTitleEl = $('video-title');

let tabId = null;
let cues = [];          // full cue list for the active track
let activeQuery = '';   // current search text

/* ---- MAIN-world probe (runs in the page's own JS world) ----
 * Must be fully self-contained: no closure references. */
function probeCaptionTracks() {
  try {
    const pr = window.ytInitialPlayerResponse;
    if (!pr || !pr.videoDetails) return { ok: false, error: 'no-player' };
    const renderer =
      pr.captions && pr.captions.playerCaptionsTracklistRenderer;
    const tracks = (renderer && renderer.captionTracks) || [];
    return {
      ok: true,
      videoId: pr.videoDetails.videoId,
      title: pr.videoDetails.title || document.title,
      tracks: tracks.map((t) => ({
        languageCode: t.languageCode || '',
        name: (t.name && (t.name.simpleText || t.name.runs?.map((r) => r.text).join(''))) || t.languageCode || 'Unknown',
        isAuto: t.kind === 'asr',
        baseUrl: t.baseUrl || '',
      })),
    };
  } catch (e) {
    return { ok: false, error: 'probe-failed' };
  }
}

function showNotice(text, kind = 'error') {
  noticeEl.textContent = text;
  noticeEl.classList.remove('hidden', 'info');
  if (kind === 'info') noticeEl.classList.add('info');
}
function hideNotice() {
  noticeEl.classList.add('hidden');
  noticeEl.classList.remove('info');
}

function fmtTime(sec) {
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  const mm = String(m % 60).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${m}:${ss}`;
}

function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function highlight(text, query) {
  const safe = escapeHtml(text);
  if (!query) return safe;
  const q = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return safe.replace(new RegExp('(' + q + ')', 'gi'), '<mark>$1</mark>');
}

/** Render cues filtered by the current search query. */
function renderCues() {
  linesEl.innerHTML = '';
  const q = activeQuery.trim().toLowerCase();
  const shown = q
    ? cues.filter((c) => c.text.toLowerCase().includes(q))
    : cues;

  matchCountEl.textContent = q ? `${shown.length} hit${shown.length === 1 ? '' : 's'}` : '';
  cueCountEl.textContent = `${cues.length} line${cues.length === 1 ? '' : 's'}`;

  if (shown.length === 0) {
    const div = document.createElement('div');
    div.className = 'empty';
    div.innerHTML = '<p>No matching lines.</p><p class="hint">Try a different word.</p>';
    linesEl.appendChild(div);
    return;
  }

  const frag = document.createDocumentFragment();
  for (const cue of shown) {
    const btn = document.createElement('button');
    btn.className = 'cue';
    btn.setAttribute('role', 'listitem');
    btn.innerHTML =
      `<span class="ts">${fmtTime(cue.start)}</span>` +
      `<span class="txt">${highlight(cue.text, activeQuery.trim())}</span>`;
    btn.addEventListener('click', () => {
      chrome.tabs.sendMessage(tabId, { type: 'seek', seconds: cue.start })
        .catch(() => showNotice('Could not seek the video. Reload the page and try again.'));
    });
    frag.appendChild(btn);
  }
  linesEl.appendChild(frag);
}

/** Load the selected track's transcript via the content script. */
async function loadSelectedTrack(tracks) {
  const track = tracks[Number(trackSelectEl.value)];
  if (!track || !track.baseUrl) return;
  showNotice('Loading transcript…', 'info');
  try {
    const res = await chrome.tabs.sendMessage(tabId, { type: 'load', baseUrl: track.baseUrl });
    hideNotice();
    if (!res || !res.ok) {
      showNotice(res && res.error ? res.error : 'Transcript failed to load.');
      return;
    }
    cues = res.cues || [];
    if (cues.length === 0) {
      emptyEl.classList.remove('hidden');
      linesEl.innerHTML = '';
      cueCountEl.textContent = '';
      return;
    }
    emptyEl.classList.add('hidden');
    searchRowEl.classList.remove('hidden');
    renderCues();
  } catch (e) {
    showNotice('Transcript failed to load. Reload the YouTube page and try again.');
  }
}

async function init() {
  // 1. Active tab must be a YouTube watch page.
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.url || !/^https:\/\/(www\.)?youtube\.com\/watch/.test(tab.url)) {
    showNotice('Open a YouTube video page, then open this popup again.');
    return;
  }
  tabId = tab.id;

  try {
    // 2. MAIN-world probe: caption track list.
    const [probe] = await chrome.scripting.executeScript({
      target: { tabId },
      world: 'MAIN',
      func: probeCaptionTracks,
    });
    const info = probe && probe.result;

    if (!info || !info.ok) {
      showNotice('Could not read this video\u2019s data. Reload the YouTube page and try again.');
      return;
    }

    videoTitleEl.textContent = info.title || 'YouTube video transcript';

    if (!info.tracks || info.tracks.length === 0) {
      emptyEl.classList.remove('hidden');
      return;
    }

    // 3. Inject the isolated-world content script (fetch + seek).
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['content.js'],
    });

    // 4. Populate track picker (manual captions first, then auto-generated).
    const tracks = [...info.tracks].sort((a, b) => Number(a.isAuto) - Number(b.isAuto));
    trackSelectEl.innerHTML = '';
    tracks.forEach((t, i) => {
      const opt = document.createElement('option');
      opt.value = String(i);
      opt.textContent = `${t.name}${t.isAuto ? ' (auto-generated)' : ''}`;
      trackSelectEl.appendChild(opt);
    });
    trackRowEl.classList.remove('hidden');

    trackSelectEl.addEventListener('change', () => loadSelectedTrack(tracks));
    searchInputEl.addEventListener('input', () => {
      activeQuery = searchInputEl.value;
      renderCues();
    });

    await loadSelectedTrack(tracks);
  } catch (e) {
    showNotice('Something went wrong. Reload the YouTube page and try again.');
  }
}

document.addEventListener('DOMContentLoaded', init);
