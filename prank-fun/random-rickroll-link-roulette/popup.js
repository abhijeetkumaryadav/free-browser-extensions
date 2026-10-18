/* Rickroll Roulette — popup logic.
 * Injects self-contained functions into the active tab via
 * chrome.scripting.executeScript with func + args. Runs only on explicit
 * user click. Requires "activeTab" + "scripting" only.
 *
 * The swapped destination is a well-known public music video URL passed as
 * an argument. No network calls, no redirects of other pages, no autoplay
 * tricks — the link text and styling are untouched, only the href changes,
 * and everything is restored by the restore function below. */
'use strict';

const VIDEO_URL = 'https://www.youtube.com/watch?v=dQw4w9W9Qc';

const rollBtn = document.getElementById('rollBtn');
const restoreBtn = document.getElementById('restoreBtn');
const countInput = document.getElementById('count');
const statusEl = document.getElementById('status');

function setStatus(message, kind) {
  statusEl.textContent = message;
  statusEl.className = 'status' + (kind ? ' ' + kind : '');
}

function clampCount(raw) {
  let n = parseInt(raw, 10);
  if (Number.isNaN(n)) n = 1;
  return Math.min(25, Math.max(1, n));
}

/* ---- Injected functions (must stay self-contained: no outer refs) ---- */

/** Swap up to `count` random swappable links to the video URL. Returns number swapped. */
function swapLinks(count, videoUrl) {
  const links = Array.from(document.querySelectorAll('a[href]'));
  const fresh = links.filter((a) => {
    const h = a.getAttribute('href');
    return (
      h &&
      !a.hasAttribute('data-rr') &&
      !/^\s*(javascript:|mailto:|tel:|#)/i.test(h)
    );
  });
  // Fisher-Yates shuffle.
  for (let i = fresh.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = fresh[i];
    fresh[i] = fresh[j];
    fresh[j] = tmp;
  }
  const taken = fresh.slice(0, Math.min(count, fresh.length));
  taken.forEach((a) => {
    a.setAttribute('data-rr', a.getAttribute('href'));
    a.setAttribute('href', videoUrl);
  });
  return taken.length;
}

/** Restore links previously swapped by swapLinks. Returns number restored. */
function restoreLinks() {
  const links = Array.from(document.querySelectorAll('a[data-rr]'));
  links.forEach((a) => {
    a.setAttribute('href', a.getAttribute('data-rr'));
    a.removeAttribute('data-rr');
  });
  return links.length;
}

/* ---- Popup wiring ---- */

async function getActiveTab() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  return tabs[0];
}

async function runOnTab(fn, args) {
  const tab = await getActiveTab();
  if (!tab || tab.id == null) {
    throw new Error('No active tab found.');
  }
  const url = tab.url || '';
  if (!/^https?:|^file:/.test(url)) {
    throw new Error('Cannot prank this page (browser or store pages are off-limits).');
  }
  const results = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: fn,
    args: args
  });
  return results && results[0] ? results[0].result : undefined;
}

rollBtn.addEventListener('click', async () => {
  rollBtn.disabled = true;
  try {
    const count = clampCount(countInput.value);
    countInput.value = count;
    const n = await runOnTab(swapLinks, [count, VIDEO_URL]);
    if (typeof n === 'number' && n > 0) {
      setStatus(
        `Roulette spun: ${n} link${n === 1 ? '' : 's'} now lead somewhere unexpected.`,
        'ok'
      );
    } else {
      setStatus('No swappable links found on this page.', 'err');
    }
  } catch (err) {
    setStatus('Could not spin the roulette: ' + err.message, 'err');
  } finally {
    rollBtn.disabled = false;
  }
});

restoreBtn.addEventListener('click', async () => {
  restoreBtn.disabled = true;
  try {
    const n = await runOnTab(restoreLinks, []);
    const restored = typeof n === 'number' ? n : 0;
    setStatus(
      restored === 0
        ? 'No swapped links to restore.'
        : `Restored ${restored} link${restored === 1 ? '' : 's'} to normal.`,
      'ok'
    );
  } catch (err) {
    setStatus('Could not restore links: ' + err.message, 'err');
  } finally {
    restoreBtn.disabled = false;
  }
});
