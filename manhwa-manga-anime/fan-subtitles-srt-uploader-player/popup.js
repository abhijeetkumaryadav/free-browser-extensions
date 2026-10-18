// SubOverlay popup — parses the .srt file on-device, stores cues, drives the overlay.
'use strict';

const DEFAULTS = { enabled: true, offsetMs: 0, fontSize: 24, bgOpacity: 60 };

/** Convert "HH:MM:SS,mmm" to milliseconds. */
function tsToMs(ts) {
  const m = ts.trim().match(/(\d+):(\d{2}):(\d{2})[,.](\d{1,3})/);
  if (!m) return null;
  const ms = m[4].padEnd(3, '0');
  return (+m[1]) * 3600000 + (+m[2]) * 60000 + (+m[3]) * 1000 + (+ms);
}

/** Minimal on-device SRT parser → [{start,end,text}]. */
function parseSrt(text) {
  const cues = [];
  const blocks = text.replace(/\r/g, '').split(/\n\s*\n/);
  for (const block of blocks) {
    const lines = block.split('\n').map(l => l.trimEnd()).filter(l => l.trim() !== '');
    if (lines.length < 2) continue;
    // Optional numeric counter line
    let i = /^\d+$/.test(lines[0].trim()) ? 1 : 0;
    const tm = lines[i] && lines[i].match(/(.+?)\s*-->\s*(.+)/);
    if (!tm) continue;
    const start = tsToMs(tm[1]), end = tsToMs(tm[2]);
    if (start == null || end == null || end <= start) continue;
    const caption = lines.slice(i + 1).join('\n').replace(/<[^>]+>/g, '').trim();
    if (!caption) continue;
    cues.push({ start, end, text: caption });
  }
  cues.sort((a, b) => a.start - b.start);
  return cues;
}

async function getState() {
  const stored = await chrome.storage.local.get(['cues', 'fileName', 'settings']);
  return {
    cues: stored.cues || [],
    fileName: stored.fileName || '',
    settings: { ...DEFAULTS, ...(stored.settings || {}) }
  };
}

async function pushToTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || tab.id == null) return;
  const { cues, settings } = await getState();
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['subtitles.js']
    });
    await chrome.tabs.sendMessage(tab.id, { type: 'SUBOVERLAY_UPDATE', cues, settings });
  } catch (e) {
    // Tab may not allow injection (chrome:// pages etc.) — fail silently.
  }
}

function render(state) {
  const has = state.cues.length > 0;
  document.getElementById('controlCard').hidden = !has;
  document.getElementById('fileName').textContent = has
    ? `${state.fileName} — ${state.cues.length} cues`
    : 'No file loaded';
  document.getElementById('cueCount').textContent = has
    ? `${state.cues.length} subtitle cues ready. Click the video tab, then toggle the overlay.`
    : '';
  document.getElementById('enableSwitch').classList.toggle('on', state.settings.enabled);
  document.getElementById('offsetVal').textContent = `${state.settings.offsetMs}ms`;
  document.getElementById('fontSize').value = state.settings.fontSize;
  document.getElementById('bgOpacity').value = state.settings.bgOpacity;
}

async function saveSettings(patch) {
  const { settings } = await getState();
  const next = { ...settings, ...patch };
  await chrome.storage.local.set({ settings: next });
  await pushToTab();
  render(await getState());
}

document.addEventListener('DOMContentLoaded', async () => {
  render(await getState());

  document.getElementById('srtFile').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const text = await file.text();
    const cues = parseSrt(text);
    if (!cues.length) {
      document.getElementById('fileName').textContent = 'Could not parse — is this a valid .srt file?';
      return;
    }
    await chrome.storage.local.set({ cues, fileName: file.name });
    await pushToTab();
    render(await getState());
  });

  document.getElementById('enableSwitch').addEventListener('click', async () => {
    const { settings } = await getState();
    await saveSettings({ enabled: !settings.enabled });
  });

  document.getElementById('offsetMinus').addEventListener('click', async () => {
    const { settings } = await getState();
    await saveSettings({ offsetMs: settings.offsetMs - 100 });
  });
  document.getElementById('offsetPlus').addEventListener('click', async () => {
    const { settings } = await getState();
    await saveSettings({ offsetMs: settings.offsetMs + 100 });
  });
  document.getElementById('fontSize').addEventListener('change', async (e) => {
    await saveSettings({ fontSize: +e.target.value });
  });
  document.getElementById('bgOpacity').addEventListener('change', async (e) => {
    await saveSettings({ bgOpacity: +e.target.value });
  });
});
