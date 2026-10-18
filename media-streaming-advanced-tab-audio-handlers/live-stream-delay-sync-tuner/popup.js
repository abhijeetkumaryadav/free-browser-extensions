/* Stream Delay Sync Tuner — popup logic.
 * Slider adjusts delay live; the toggle starts/stops the capture session
 * on the current tab via the service worker. Delay is persisted on-device. */
(() => {
  'use strict';

  const $ = id => document.getElementById(id);
  const slider = $('delay'), msEl = $('ms'), toggleBtn = $('toggle');
  const statusLine = $('status-line'), dot = $('state-dot'), errorEl = $('error');
  const presetBtns = Array.from(document.querySelectorAll('.chip-btn'));

  let active = false;
  let activeTabId = null;
  let delayMs = 120;

  function showError(msg) {
    errorEl.textContent = msg;
    errorEl.hidden = !msg;
  }

  function render() {
    msEl.textContent = delayMs;
    slider.value = delayMs;
    dot.classList.toggle('on', active);
    toggleBtn.textContent = active ? 'Disable sync (bypass)' : 'Enable sync on this tab';
    toggleBtn.classList.toggle('danger', active);
    statusLine.textContent = active ? 'Active — delayed audio playing' : 'Lip-sync fixer for tab audio';
    presetBtns.forEach(b => b.classList.toggle('active', Number(b.dataset.ms) === delayMs));
  }

  function persist() {
    chrome.storage.local.set({ sdstDelayMs: delayMs });
  }

  async function refreshStatus() {
    try {
      const res = await chrome.runtime.sendMessage({ action: 'status' });
      if (res && res.ok) {
        active = !!res.active && res.activeTabId === res.tabId;
        activeTabId = res.tabId;
      }
    } catch (_) { active = false; }
    render();
  }

  slider.addEventListener('input', async () => {
    delayMs = Number(slider.value);
    persist();
    render();
    if (active) {
      try {
        await chrome.runtime.sendMessage({ action: 'setDelay', delayMs });
      } catch (err) {
        showError('Could not update delay: ' + err.message);
      }
    }
  });

  presetBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      delayMs = Number(btn.dataset.ms);
      persist();
      render();
      if (active) chrome.runtime.sendMessage({ action: 'setDelay', delayMs }).catch(() => {});
    });
  });

  toggleBtn.addEventListener('click', async () => {
    showError('');
    toggleBtn.disabled = true;
    try {
      if (active) {
        const res = await chrome.runtime.sendMessage({ action: 'stop' });
        if (!res || !res.ok) throw new Error((res && res.error) || 'Stop failed.');
        active = false;
      } else {
        const res = await chrome.runtime.sendMessage({ action: 'start', delayMs });
        if (!res || !res.ok) throw new Error((res && res.error) || 'Start failed.');
        active = true;
      }
    } catch (err) {
      showError(err.message);
    } finally {
      toggleBtn.disabled = false;
      render();
    }
  });

  // Restore persisted delay, then check whether this tab already has a session.
  chrome.storage.local.get('sdstDelayMs', ({ sdstDelayMs }) => {
    if (typeof sdstDelayMs === 'number') delayMs = Math.min(Math.max(sdstDelayMs, 0), 500);
    refreshStatus();
  });
})();
