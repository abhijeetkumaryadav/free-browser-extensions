/* Goose Chaos — popup logic. Persists settings, injects/removes the goose content script. */
'use strict';

const DEFAULTS = { enabled: false, mischief: 2, honks: true, chase: true };

const $ = (id) => document.getElementById(id);

/** Load saved settings into the controls. */
async function load() {
  const s = { ...DEFAULTS, ...(((await chrome.storage.local.get('goose'))).goose || {}) };
  $('mischief').value = s.mischief;
  $('mischiefVal').textContent = s.mischief;
  $('honkToggle').checked = s.honks;
  $('chaseToggle').checked = s.chase;
}

/** Read current control values. */
function readSettings() {
  return {
    mischief: Number($('mischief').value),
    honks: $('honkToggle').checked,
    chase: $('chaseToggle').checked,
  };
}

/** Save settings (merged with enabled flag). */
async function save(patch) {
  const cur = { ...DEFAULTS, ...(((await chrome.storage.local.get('goose'))).goose || {}) };
  await chrome.storage.local.set({ goose: { ...cur, ...patch } });
}

async function activeTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

/** Summon: persist settings, mark enabled, inject the goose. */
$('summonBtn').addEventListener('click', async () => {
  await save({ ...readSettings(), enabled: true });
  const tab = await activeTab();
  if (!tab?.id) return;
  await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['goose.js'] });
  window.close();
});

/** Dismiss: flag off, message the content script, and force-remove the host as fallback. */
$('dismissBtn').addEventListener('click', async () => {
  await save({ enabled: false });
  const tab = await activeTab();
  if (tab?.id) {
    try { await chrome.tabs.sendMessage(tab.id, { type: 'goose-dismiss' }); } catch { /* not injected */ }
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => { document.getElementById('goose-chaos-host')?.remove(); },
      });
    } catch { /* page not scriptable */ }
  }
  window.close();
});

/* Live-save control changes so the goose reacts without re-summoning. */
$('mischief').addEventListener('input', async (e) => {
  $('mischiefVal').textContent = e.target.value;
  await save({ mischief: Number(e.target.value) });
});
$('honkToggle').addEventListener('change', (e) => save({ honks: e.target.checked }));
$('chaseToggle').addEventListener('change', (e) => save({ chase: e.target.checked }));

/**
 * Explicit-click honk: a synthesized WebAudio honk. Never autoplays —
 * sound is produced ONLY when this button is clicked.
 */
$('honkNowBtn').addEventListener('click', () => {
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const t = ctx.currentTime;
  // Two detuned sawtooth oscillators ≈ a goose-like honk.
  for (const f of [196, 207]) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(f, t);
    osc.frequency.linearRampToValueAtTime(f * 0.82, t + 0.28); // pitch droop
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.25, t + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.32);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t); osc.stop(t + 0.35);
  }
  setTimeout(() => ctx.close(), 600);
});

load();
