/* OrbitBox popup — saves default settings, opens the full-page sandbox. */
'use strict';

const $ = (id) => document.getElementById(id);
const DEFAULTS = { ballSize: 16, gravity: 1200, trails: true };

// Restore saved defaults.
chrome.storage.local.get(DEFAULTS, (saved) => {
  $('ballSize').value = saved.ballSize;
  $('ballSizeVal').textContent = saved.ballSize;
  $('gravity').value = saved.gravity;
  $('gravityVal').textContent = saved.gravity;
  $('trails').checked = saved.trails;
});

function persist() {
  chrome.storage.local.set({
    ballSize: Number($('ballSize').value),
    gravity: Number($('gravity').value),
    trails: $('trails').checked,
  });
}

$('ballSize').addEventListener('input', () => {
  $('ballSizeVal').textContent = $('ballSize').value;
  persist();
});
$('gravity').addEventListener('input', () => {
  $('gravityVal').textContent = $('gravity').value;
  persist();
});
$('trails').addEventListener('change', persist);

// Open the sandbox as a full-page tab.
$('open').addEventListener('click', () => {
  chrome.tabs.create({ url: chrome.runtime.getURL('sandbox.html') });
  window.close();
});
