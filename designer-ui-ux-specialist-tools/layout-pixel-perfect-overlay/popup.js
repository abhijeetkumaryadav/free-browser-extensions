/* Layout Pixel-Perfect Overlay — popup logic.
 * Settings are stored per-host under `ppo:<host>`. The content script is
 * injected on demand (activeTab + scripting) and re-reads storage on change,
 * so slider moves update the page live. */

const els = {};
['pageHost','enabledToggle','thumbImg','thumbEmpty','fileInput','clearBtn',
 'opacity','opacityVal','scale','scaleVal','posX','xVal','posY','yVal',
 'invertBtn','resetBtn'].forEach(id => els[id] = document.getElementById(id));

const DEFAULTS = { image: null, enabled: false, opacity: 60, scale: 100, x: 0, y: 0, blend: false };

let tabId = null;
let host = '';
let settings = { ...DEFAULTS };

const key = () => `ppo:${host}`;

/* Ensure the content script is present in the active tab */
async function ensureInjected() {
  try {
    await chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] });
    // Nudge the freshly injected script to load settings
    chrome.tabs.sendMessage(tabId, { type: 'ppo-refresh' }).catch(() => {});
  } catch (e) {
    // Restricted pages (chrome://, web store) — show a gentle note
    els.pageHost.textContent = host + ' — overlay unavailable here';
  }
}

function persist() {
  chrome.storage.local.set({ [key()]: settings });
}

/* Reflect settings in the popup UI */
function render() {
  els.enabledToggle.checked = settings.enabled;
  els.opacity.value = settings.opacity;
  els.opacityVal.textContent = settings.opacity + '%';
  els.scale.value = settings.scale;
  els.scaleVal.textContent = settings.scale + '%';
  els.posX.value = settings.x;
  els.xVal.textContent = settings.x + 'px';
  els.posY.value = settings.y;
  els.yVal.textContent = settings.y + 'px';
  els.invertBtn.textContent = settings.blend ? 'Blend: difference ✓' : 'Invert blend';
  els.clearBtn.disabled = !settings.image;

  if (settings.image) {
    els.thumbImg.src = settings.image;
    els.thumbImg.hidden = false;
    els.thumbEmpty.style.display = 'none';
  } else {
    els.thumbImg.hidden = true;
    els.thumbEmpty.style.display = '';
  }
}

/* Load settings for the active tab's host */
async function init() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.id) return;
  tabId = tab.id;
  try {
    host = new URL(tab.url).host;
  } catch { host = ''; }
  els.pageHost.textContent = host || '—';
  if (!host || !/^https?:/.test(tab.url)) return;

  const data = await chrome.storage.local.get(key());
  settings = { ...DEFAULTS, ...(data[key()] || {}) };
  render();
  await ensureInjected();
}

/* Downscale large uploads so they fit chrome.storage.local quotas */
function processImage(file) {
  const reader = new FileReader();
  reader.onload = () => {
    const img = new Image();
    img.onload = () => {
      const MAX = 1600; // longest side
      let { width, height } = img;
      if (Math.max(width, height) > MAX) {
        const k = MAX / Math.max(width, height);
        width = Math.round(width * k);
        height = Math.round(height * k);
      }
      const canvas = document.createElement('canvas');
      canvas.width = width; canvas.height = height;
      canvas.getContext('2d').drawImage(img, 0, 0, width, height);
      settings.image = canvas.toDataURL('image/png');
      settings.enabled = true;
      render();
      persist();
      ensureInjected();
    };
    img.src = reader.result;
  };
  reader.readAsDataURL(file);
}

/* Events */
els.fileInput.addEventListener('change', e => {
  const file = e.target.files[0];
  if (file) processImage(file);
  e.target.value = ''; // allow re-picking the same file
});

els.clearBtn.addEventListener('click', () => {
  settings.image = null;
  settings.enabled = false;
  render();
  persist();
});

els.enabledToggle.addEventListener('change', () => {
  if (els.enabledToggle.checked && !settings.image) {
    els.enabledToggle.checked = false; // nothing to show yet
    return;
  }
  settings.enabled = els.enabledToggle.checked;
  persist();
});

function bindSlider(sliderId, labelId, field, fmt) {
  els[sliderId].addEventListener('input', () => {
    settings[field] = +els[sliderId].value;
    els[labelId].textContent = fmt(settings[field]);
    persist();
  });
}
bindSlider('opacity', 'opacityVal', 'opacity', v => v + '%');
bindSlider('scale', 'scaleVal', 'scale', v => v + '%');
bindSlider('posX', 'xVal', 'x', v => v + 'px');
bindSlider('posY', 'yVal', 'y', v => v + 'px');

els.invertBtn.addEventListener('click', () => {
  settings.blend = !settings.blend;
  render();
  persist();
});

els.resetBtn.addEventListener('click', () => {
  settings.x = 0; settings.y = 0; settings.scale = 100; settings.opacity = 60;
  render();
  persist();
});

init();
