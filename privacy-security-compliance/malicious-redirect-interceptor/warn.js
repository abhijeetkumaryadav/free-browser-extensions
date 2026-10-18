/* Warning interstitial logic: show from→to, report the user's choice. */
'use strict';

const params = new URLSearchParams(location.search);
const from = params.get('from') || '';
const to = params.get('to') || '';

function shortHost(url) {
  try { return new URL(url).hostname; } catch { return url; }
}

document.getElementById('from').textContent = shortHost(from);
document.getElementById('from').title = from;
document.getElementById('to').textContent = shortHost(to);
document.getElementById('to').title = to;

function report(action) {
  chrome.runtime.sendMessage({ type: 'redirect-choice', from, to, action })
    .catch(() => {});
}

document.getElementById('backBtn').addEventListener('click', () => {
  report('went back');
  // Return to where the chain started (never the redirect target).
  location.href = from || 'about:blank';
});

document.getElementById('goBtn').addEventListener('click', () => {
  report('continued');
  location.href = to;
});
