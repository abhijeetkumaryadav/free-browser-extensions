/* BoostLab popup controller — talks to the background service worker only. */
const $ = (id) => document.getElementById(id);

const slider = $('boostSlider');
const boostValue = $('boostValue');
const clipWarn = $('clipWarn');
const toggleBtn = $('toggleBtn');
const bypassToggle = $('bypassToggle');
const statusPill = $('statusPill');

const DEFAULTS = { enabled: false, tabId: null, boost: 150, bypass: false };

async function getState() {
  const { boostlab } = await chrome.storage.local.get('boostlab');
  return { ...DEFAULTS, ...(boostlab || {}) };
}

async function persistState(patch) {
  const s = await getState();
  await chrome.storage.local.set({ boostlab: { ...s, ...patch } });
}

function paintBoost(v) {
  slider.value = v;
  boostValue.textContent = v + '%';
  clipWarn.classList.toggle('hidden', v <= 150);
}

async function render() {
  const s = await getState();
  paintBoost(s.boost);
  const on = !!s.enabled;
  statusPill.textContent = on ? 'On' : 'Off';
  statusPill.classList.toggle('on', on);
  statusPill.classList.toggle('off', !on);
  toggleBtn.textContent = on ? 'Disable — restore original audio' : 'Enable on this tab';
  toggleBtn.classList.toggle('danger', on);
  bypassToggle.setAttribute('aria-checked', String(!!s.bypass));
}

slider.addEventListener('input', async () => {
  const v = Number(slider.value);
  paintBoost(v);
  const s = await getState();
  if (s.enabled) {
    chrome.runtime.sendMessage({ type: 'setBoost', boost: v });
  } else {
    persistState({ boost: v });
  }
});

document.querySelectorAll('.presets button').forEach((btn) => {
  btn.addEventListener('click', () => {
    slider.value = btn.dataset.preset;
    slider.dispatchEvent(new Event('input'));
  });
});

bypassToggle.addEventListener('click', async () => {
  const s = await getState();
  const next = !s.bypass;
  bypassToggle.setAttribute('aria-checked', String(next));
  if (s.enabled) {
    chrome.runtime.sendMessage({ type: 'setBypass', bypass: next });
  } else {
    persistState({ bypass: next });
  }
});

toggleBtn.addEventListener('click', async () => {
  toggleBtn.disabled = true;
  try {
    const s = await getState();
    const res = s.enabled
      ? await chrome.runtime.sendMessage({ type: 'disable' })
      : await chrome.runtime.sendMessage({ type: 'enable', boost: Number(slider.value) });
    if (res && !res.ok && res.error) {
      const old = toggleBtn.textContent;
      toggleBtn.textContent = res.error;
      setTimeout(() => {
        toggleBtn.textContent = old;
      }, 2600);
    }
  } catch (err) {
    const old = toggleBtn.textContent;
    toggleBtn.textContent = 'Something went wrong — try again.';
    setTimeout(() => {
      toggleBtn.textContent = old;
    }, 2600);
  } finally {
    toggleBtn.disabled = false;
    render();
  }
});

document.addEventListener('DOMContentLoaded', render);
