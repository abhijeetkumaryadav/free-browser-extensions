/* GlassForce popup logic — reads/writes settings, injects content script on demand. */
const $ = (id) => document.getElementById(id);
const DEFAULTS = { enabled: false, preset: 'frosted', blur: 12, opacity: 72, remember: false, sites: {} };

async function getState() {
  const stored = await chrome.storage.local.get(DEFAULTS);
  return { ...DEFAULTS, ...stored };
}

async function getTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

function hostOf(url) {
  try { return new URL(url).hostname; } catch { return ''; }
}

/* Ensure the content script is present, then send a message to it. */
async function sendToTab(tabId, msg) {
  try {
    await chrome.tabs.sendMessage(tabId, msg);
  } catch {
    await chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] });
    await chrome.tabs.sendMessage(tabId, msg);
  }
}

async function applyToTab(tab, state) {
  const opts = { blur: state.blur, opacity: state.opacity, preset: state.preset };
  await sendToTab(tab.id, state.enabled
    ? { type: 'glassforce:apply', opts }
    : { type: 'glassforce:remove' });
}

function render(state) {
  $('powerToggle').setAttribute('aria-checked', String(state.enabled));
  $('blur').value = state.blur;
  $('opacity').value = state.opacity;
  $('blurVal').textContent = state.blur + 'px';
  $('opacityVal').textContent = state.opacity + '%';
  $('rememberSite').checked = state.remember;
  document.querySelectorAll('.preset').forEach((b) =>
    b.classList.toggle('active', b.dataset.preset === state.preset));
}

async function init() {
  const tab = await getTab();
  const host = hostOf(tab?.url || '');
  $('siteHint').textContent = host ? `Site: ${host}` : 'Applies to this tab only';
  let state = await getState();

  // If "remember this site" is on and this host was saved, restore its enabled state.
  if (host && state.sites[host] !== undefined) {
    state.enabled = state.sites[host];
  }
  render(state);
  if (tab?.id) await applyToTab(tab, state).catch(() => {});

  $('powerToggle').addEventListener('click', async () => {
    state.enabled = !state.enabled;
    if (state.remember && host) state.sites[host] = state.enabled;
    await chrome.storage.local.set(state);
    render(state);
    if (tab?.id) await applyToTab(tab, state).catch(() => {});
  });

  document.querySelectorAll('.preset').forEach((b) =>
    b.addEventListener('click', async () => {
      state.preset = b.dataset.preset;
      await chrome.storage.local.set({ preset: state.preset });
      render(state);
      if (tab?.id && state.enabled) await applyToTab(tab, state).catch(() => {});
    }));

  $('blur').addEventListener('input', async (e) => {
    state.blur = Number(e.target.value);
    $('blurVal').textContent = state.blur + 'px';
    await chrome.storage.local.set({ blur: state.blur });
    if (tab?.id && state.enabled) await applyToTab(tab, state).catch(() => {});
  });

  $('opacity').addEventListener('input', async (e) => {
    state.opacity = Number(e.target.value);
    $('opacityVal').textContent = state.opacity + '%';
    await chrome.storage.local.set({ opacity: state.opacity });
    if (tab?.id && state.enabled) await applyToTab(tab, state).catch(() => {});
  });

  $('rememberSite').addEventListener('change', async (e) => {
    state.remember = e.target.checked;
    if (host) {
      if (state.remember) state.sites[host] = state.enabled;
      else delete state.sites[host];
    }
    await chrome.storage.local.set(state);
  });
}

document.addEventListener('DOMContentLoaded', init);
