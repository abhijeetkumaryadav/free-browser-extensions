/* WobblePage popup logic.
 * Injects a self-contained content function into the active tab on user toggle.
 * All state lives in chrome.storage.local; the injected function is self-contained
 * (MV3 CSP forbids eval/new Function). */

const DEFAULTS = { enabled: false, intensity: 5, target: 'all' };

// ---------------------------------------------------------------------------
// Injected content function — runs in the page's MAIN world context via
// chrome.scripting.executeScript. Must not reference popup scope.
// ---------------------------------------------------------------------------
function applyWobble(opts) {
  const STYLE_ID = 'wobblepage-style';
  const existing = document.getElementById(STYLE_ID);
  if (existing) existing.remove();

  if (!opts.enabled) {
    // Restore: remove all wobble attributes the extension added.
    document.querySelectorAll('[data-wobble-applied]').forEach((el) => {
      el.removeAttribute('data-wobble-applied');
    });
    return;
  }

  const mag = Math.min(10, Math.max(1, Number(opts.intensity) || 5)); // 1..10
  const dur = (1.1 - mag * 0.07).toFixed(2); // faster shake at higher intensity
  const px = (mag * 1.2).toFixed(1);
  const rot = (mag * 0.5).toFixed(1);

  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    @keyframes wobblepage-shake {
      0%, 100% { transform: translate(0, 0) rotate(0deg); }
      25% { transform: translate(${px}px, -${px}px) rotate(${rot}deg); }
      50% { transform: translate(-${px}px, ${px}px) rotate(-${rot}deg); }
      75% { transform: translate(${px}px, ${px}px) rotate(${rot}deg); }
    }
    [data-wobble-applied] {
      animation: wobblepage-shake ${dur}s ease-in-out infinite !important;
      transform-origin: center !important;
    }`;
  document.documentElement.appendChild(style);

  const SELECTORS = {
    all: 'div, p, span, a, img, button, h1, h2, h3, h4, li, section, article, header, footer, nav, input, textarea, select, table',
    images: 'img, svg, picture',
    text: 'p, span, h1, h2, h3, h4, h5, h6, li, td, th, a',
    buttons: 'button, a.btn, input[type="button"], input[type="submit"]'
  };
  const selector = SELECTORS[opts.target] || SELECTORS.all;

  document.querySelectorAll(selector).forEach((el) => {
    // Skip tiny/hidden elements and our own overlay-ish nodes.
    const r = el.getBoundingClientRect();
    if (r.width < 4 || r.height < 4) return;
    el.setAttribute('data-wobble-applied', '1');
  });
}

// ---------------------------------------------------------------------------
// Popup wiring
// ---------------------------------------------------------------------------
const $ = (id) => document.getElementById(id);
const toggle = $('toggle');
const intensity = $('intensity');
const intensityVal = $('intensityVal');
const chips = Array.from(document.querySelectorAll('.chip'));

async function getSettings() {
  const s = await chrome.storage.local.get(DEFAULTS);
  return { ...DEFAULTS, ...s };
}

async function saveSettings(patch) {
  const s = await getSettings();
  const next = { ...s, ...patch };
  await chrome.storage.local.set(next);
  return next;
}

async function inject(settings) {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id || /^chrome:\/\//.test(tab.url || '')) return;
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: applyWobble,
      args: [settings]
    });
  } catch (e) {
    console.warn('WobblePage inject failed:', e);
  }
}

function render(s) {
  toggle.setAttribute('aria-checked', String(!!s.enabled));
  intensity.value = s.intensity;
  intensityVal.textContent = s.intensity;
  chips.forEach((c) => c.classList.toggle('active', c.dataset.target === s.target));
}

toggle.addEventListener('click', async () => {
  const next = await saveSettings({ enabled: !(await getSettings()).enabled });
  render(next);
  inject(next);
});

intensity.addEventListener('input', () => {
  intensityVal.textContent = intensity.value;
});
intensity.addEventListener('change', async () => {
  const next = await saveSettings({ intensity: Number(intensity.value) });
  render(next);
  if (next.enabled) inject(next);
});

chips.forEach((chip) => {
  chip.addEventListener('click', async () => {
    const next = await saveSettings({ target: chip.dataset.target });
    render(next);
    if (next.enabled) inject(next);
  });
});

$('restore').addEventListener('click', async () => {
  const next = await saveSettings({ enabled: false });
  render(next);
  inject(next);
});

getSettings().then(render);
