/* Referrer Policy Masker — popup logic.
   Reads/writes settings via the background service worker. */

const els = {
  toggle: document.getElementById('enabledToggle'),
  statusDot: document.getElementById('statusDot'),
  statusText: document.getElementById('statusText'),
  radios: [...document.querySelectorAll('input[name="mode"]')],
  count: document.getElementById('requestCount'),
  reset: document.getElementById('resetCounter'),
};

/** Ask the background worker for current state. */
function getState() {
  return chrome.runtime.sendMessage({ type: 'getState' });
}

/** Render the popup from a state object {enabled, mode, sessionCount}. */
function render(state) {
  els.toggle.checked = state.enabled;
  els.statusDot.classList.toggle('on', state.enabled);
  els.statusText.textContent = state.enabled
    ? `Masking active — ${state.mode === 'strict' ? 'no referrer' : 'origin only'}`
    : 'Masking paused';
  els.radios.forEach(r => { r.checked = r.value === state.mode; });
  els.count.textContent = state.sessionCount.toLocaleString();
}

// --- events ---------------------------------------------------------------

els.toggle.addEventListener('change', async () => {
  const state = await chrome.runtime.sendMessage({
    type: 'setEnabled', enabled: els.toggle.checked,
  });
  render(state);
});

els.radios.forEach(r => r.addEventListener('change', async () => {
  if (!r.checked) return;
  const state = await chrome.runtime.sendMessage({ type: 'setMode', mode: r.value });
  render(state);
}));

els.reset.addEventListener('click', async () => {
  const state = await chrome.runtime.sendMessage({ type: 'resetCounter' });
  render(state);
});

// --- init -----------------------------------------------------------------
getState().then(render).catch(err => {
  els.statusText.textContent = 'Could not reach background worker.';
  console.error(err);
});
