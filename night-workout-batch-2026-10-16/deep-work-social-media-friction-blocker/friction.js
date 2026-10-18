/* Deep Work Friction Blocker — friction page logic.
   10-second countdown; after it ends the user may proceed to the original
   destination. Purely user-controlled friction. */
'use strict';

const params = new URLSearchParams(location.search);
const target = params.get('target') || 'about:blank';

const countdownEl = document.getElementById('countdown');
const proceedBtn = document.getElementById('proceed');
const targetLabel = document.getElementById('targetLabel');

try {
  targetLabel.textContent = new URL(target).hostname;
} catch {
  targetLabel.textContent = target;
}

let remaining = 10;
const timer = setInterval(() => {
  remaining -= 1;
  if (remaining <= 0) {
    clearInterval(timer);
    countdownEl.textContent = '0';
    proceedBtn.disabled = false;
    proceedBtn.textContent = 'Proceed anyway — I choose this';
    return;
  }
  countdownEl.textContent = String(remaining);
}, 1000);

proceedBtn.addEventListener('click', () => {
  if (proceedBtn.disabled) return;
  location.href = target;
});

document.getElementById('goBack').addEventListener('click', () => {
  history.back();
});
