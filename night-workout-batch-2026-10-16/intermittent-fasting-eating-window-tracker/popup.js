/* Fasting window tracker popup.
 * Timing state lives in the background worker (alarms survive popup close).
 * This popup renders state, sends start/stop commands, and shows history.
 */

// ENGINE-START
// Pure helpers, tested headlessly.

/** Format ms duration as h:mm:ss. */
function fmtDuration(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  return h + ':' + String(Math.floor((s % 3600) / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
}

/** Clamp the user's fast/eat hour inputs to sane ranges. */
function clampPlan(fastH, eatH) {
  return {
    fastH: Math.min(72, Math.max(1, Math.round(+fastH || 16))),
    eatH: Math.min(24, Math.max(1, Math.round(+eatH || 8))),
  };
}

/**
 * Phase progress: returns {label, remainingMs, fraction} for display.
 * @param {{phase:'idle'|'fasting'|'eating', startedAt:number, endsAt:number}} st
 * @param {number} now epoch ms
 */
function phaseView(st, now) {
  if (st.phase === 'idle') {
    return { label: 'Ready — press Start fasting', remainingMs: 0, fraction: 0 };
  }
  const total = st.endsAt - st.startedAt;
  const remainingMs = Math.max(0, st.endsAt - now);
  const fraction = total > 0 ? Math.min(1, Math.max(0, (now - st.startedAt) / total)) : 0;
  const label = st.phase === 'fasting' ? 'Fasting — window closes in' : 'Eating window — closes in';
  return { label, remainingMs, fraction };
}
// ENGINE-END

const els = {
  bigTime: document.getElementById('bigTime'),
  phase: document.getElementById('phase'),
  bar: document.getElementById('bar'),
  startBtn: document.getElementById('startBtn'),
  stopBtn: document.getElementById('stopBtn'),
  fastH: document.getElementById('fastH'),
  eatH: document.getElementById('eatH'),
  historyList: document.getElementById('historyList'),
};

/** Render a full state snapshot from the background. */
function render(st) {
  const view = phaseView(st, Date.now());
  els.bigTime.textContent = fmtDuration(view.remainingMs);
  els.phase.textContent = view.label;
  els.bar.style.width = (view.fraction * 100).toFixed(1) + '%';
  els.fastH.value = st.plan.fastH;
  els.eatH.value = st.plan.eatH;
  els.startBtn.disabled = st.phase !== 'idle';
  els.startBtn.style.opacity = st.phase !== 'idle' ? '0.5' : '1';
  els.historyList.innerHTML = '';
  for (const h of (st.history || []).slice(0, 30)) {
    const li = document.createElement('li');
    const when = new Date(h.endedAt).toLocaleString();
    const dur = fmtDuration(h.durationMs);
    li.innerHTML = '<span>' + when + ' · ' + dur + '</span>' +
      '<span class="' + (h.completed ? 'done' : 'stopped') + '">' +
      (h.completed ? 'completed' : 'ended early') + '</span>';
    els.historyList.appendChild(li);
  }
}

async function refresh() {
  const resp = await chrome.runtime.sendMessage({ type: 'GET_STATE' });
  render(resp.state);
}

els.startBtn.addEventListener('click', async () => {
  const plan = clampPlan(els.fastH.value, els.eatH.value);
  const resp = await chrome.runtime.sendMessage({ type: 'START_FAST', plan });
  render(resp.state);
});

els.stopBtn.addEventListener('click', async () => {
  const resp = await chrome.runtime.sendMessage({ type: 'STOP' });
  render(resp.state);
});

for (const el of [els.fastH, els.eatH]) {
  el.addEventListener('change', () => {
    const plan = clampPlan(els.fastH.value, els.eatH.value);
    chrome.runtime.sendMessage({ type: 'SAVE_PLAN', plan });
    els.fastH.value = plan.fastH; els.eatH.value = plan.eatH;
  });
}

setInterval(refresh, 1000);
refresh();
