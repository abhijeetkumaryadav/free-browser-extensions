// popup.js — TieDye controls: pick a palette/blend/speed, inject the
// self-contained tiedye.js on demand, then invoke it with the chosen options.

const PALETTES = [
  { id: 'rainbow',   name: 'Rainbow' },
  { id: 'pastel',    name: 'Pastel' },
  { id: 'neon',      name: 'Neon' },
  { id: 'inferno',   name: 'Inferno' },
  { id: 'ocean',     name: 'Ocean' },
  { id: 'grayscale', name: 'Grayscale' }
];

const BLENDS = [
  { id: 'screen',     name: 'Screen' },
  { id: 'overlay',    name: 'Overlay' },
  { id: 'multiply',   name: 'Multiply' },
  { id: 'difference', name: 'Difference' }
];

const state = { palette: 'rainbow', blend: 'screen', speed: 8000, running: false };

const $ = (id) => document.getElementById(id);
const statusEl = $('status');
const startBtn = $('start');
const stopBtn = $('stop');

function buildChips(containerId, items, key) {
  const box = $(containerId);
  items.forEach((item) => {
    const btn = document.createElement('button');
    btn.className = 'chip' + (state[key] === item.id ? ' active' : '');
    btn.type = 'button';
    if (key === 'palette') {
      const sw = document.createElement('span');
      sw.className = 'swatch';
      btn.appendChild(sw);
    }
    btn.appendChild(document.createTextNode(item.name));
    btn.addEventListener('click', () => {
      state[key] = item.id;
      box.querySelectorAll('.chip').forEach((c) => c.classList.remove('active'));
      btn.classList.add('active');
      chrome.storage.local.set({ [key]: item.id });
    });
    box.appendChild(btn);
  });
}

function speedName(ms) {
  if (ms <= 5000) return 'Wild';
  if (ms <= 9000) return 'Normal';
  return 'Chill';
}

// Inject tiedye.js (file, then invoke its __tiedye.run) — no eval anywhere.
async function injectAndRun(opts) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.id) throw new Error('No active tab.');
  if (/^chrome:\/\//.test(tab.url || '') || /^https:\/\/chrome\.google\.com/.test(tab.url || '')) {
    throw new Error('Cannot dye chrome:// or Web Store pages.');
  }
  await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['tiedye.js'] });
  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: (options) => { globalThis.__tiedye.run(options); },
    args: [opts]
  });
}

function setRunning(running) {
  state.running = running;
  startBtn.disabled = running;
  stopBtn.disabled = !running;
  statusEl.textContent = running
    ? '🌈 The page is dyeing… click Stop / restore to bring it back.'
    : 'Ready. The page itself is never modified — one click restores it.';
  statusEl.classList.toggle('on', running);
  chrome.storage.local.set({ running });
}

startBtn.addEventListener('click', async () => {
  try {
    await injectAndRun({ mode: 'start', palette: state.palette, blend: state.blend, speed: state.speed });
    setRunning(true);
  } catch (e) {
    statusEl.textContent = '⚠️ ' + e.message;
  }
});

stopBtn.addEventListener('click', async () => {
  try {
    await injectAndRun({ mode: 'stop' });
  } catch (e) {
    // Tab may be gone or restricted; still reset the UI.
  }
  setRunning(false);
});

$('speed').addEventListener('input', (e) => {
  state.speed = Number(e.target.value);
  $('speed-label').textContent = speedName(state.speed);
  chrome.storage.local.set({ speed: state.speed });
});

// Restore last settings (but never auto-dye a page).
chrome.storage.local.get({ palette: 'rainbow', blend: 'screen', speed: 8000, running: false }, (prefs) => {
  state.palette = prefs.palette;
  state.blend = prefs.blend;
  state.speed = prefs.speed;
  $('speed').value = prefs.speed;
  $('speed-label').textContent = speedName(prefs.speed);
  buildChips('palette-chips', PALETTES, 'palette');
  buildChips('blend-chips', BLENDS, 'blend');
  setRunning(!!prefs.running);
});
