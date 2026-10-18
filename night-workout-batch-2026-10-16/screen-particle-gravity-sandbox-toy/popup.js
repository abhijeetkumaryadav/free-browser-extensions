/* Gravity Sandbox — popup logic. Persists settings; injects the overlay on explicit click only. */
const $ = (id) => document.getElementById(id);
const DEFAULTS = { sps_gravity: 80, sps_particles: 160, sps_trail: 25, sps_active: false };

/** Load persisted settings into the sliders. */
function load() {
  chrome.storage.local.get(DEFAULTS, (r) => {
    $('gravity').value = r.sps_gravity;
    $('particles').value = r.sps_particles;
    $('trail').value = r.sps_trail;
    updateLabels();
    setStatus(r.sps_active);
  });
}

/** Refresh the value readouts next to each slider. */
function updateLabels() {
  $('gravityVal').textContent = $('gravity').value;
  $('particlesVal').textContent = $('particles').value;
  $('trailVal').textContent = $('trail').value + '%';
}

/** Save slider values (the running sandbox picks them up live via storage events). */
function save() {
  chrome.storage.local.set({
    sps_gravity: Number($('gravity').value),
    sps_particles: Number($('particles').value),
    sps_trail: Number($('trail').value),
  });
  updateLabels();
}

/** Render the running/stopped indicator. */
function setStatus(active) {
  const el = $('status');
  el.textContent = active ? '● Running on this tab' : '○ Stopped';
  el.classList.toggle('on', !!active);
}

function currentTab(cb) {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => cb(tabs[0]));
}

/** Inject the overlay — explicit user click only; refused on browser-internal pages. */
function start() {
  $('hint').textContent = '';
  currentTab((tab) => {
    if (!tab || !tab.url || /^(chrome|edge|about|chrome-extension):/.test(tab.url)) {
      $('hint').textContent = 'Cannot run on browser internal pages.';
      setStatus(false);
      return;
    }
    chrome.scripting.executeScript(
      { target: { tabId: tab.id }, files: ['content.js'] },
      () => {
        if (chrome.runtime.lastError) {
          $('hint').textContent = chrome.runtime.lastError.message;
          return;
        }
        chrome.storage.local.set({ sps_active: true }, () => setStatus(true));
      }
    );
  });
}

/** Signal the overlay to tear itself down via the shared storage flag. */
function stop() {
  chrome.storage.local.set({ sps_active: false }, () => setStatus(false));
}

document.addEventListener('DOMContentLoaded', () => {
  load();
  ['gravity', 'particles', 'trail'].forEach((id) => $(id).addEventListener('input', save));
  $('start').addEventListener('click', start);
  $('stop').addEventListener('click', stop);
});
