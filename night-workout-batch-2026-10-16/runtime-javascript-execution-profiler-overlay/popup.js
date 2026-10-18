/* Runtime JS Profiler Overlay — popup logic.
   Injects the profiler content script on demand and polls it for data. */
'use strict';

const els = {};
['dot','startBtn','stopBtn','empty','stats','offenders','offenderList',
 'ltCount','ltWorst','ltTotal','fpsAvg'].forEach(id => els[id] = document.getElementById(id));

let tabId = null, pollTimer = null, running = false;

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

/* Ensure the content script is present in the tab. */
async function ensureProfiler(tabId) {
  await chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] });
}

/* Send a command to the profiler in the tab. */
async function sendCmd(cmd, payload = {}) {
  try {
    return await chrome.tabs.sendMessage(tabId, { cmd, ...payload });
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

function setRunning(v) {
  running = v;
  els.dot.classList.toggle('live', v);
  els.dot.classList.toggle('idle', !v);
  els.startBtn.disabled = v;
  els.stopBtn.disabled = !v;
}

function render(data) {
  const s = data.stats;
  els.empty.classList.add('hidden');
  els.stats.classList.remove('hidden');
  els.ltCount.textContent = s.count;
  els.ltWorst.textContent = s.worst ? s.worst.toFixed(0) + ' ms' : '—';
  els.ltTotal.textContent = s.total ? s.total.toFixed(0) + ' ms' : '—';
  els.fpsAvg.textContent = data.fpsAvg ? data.fpsAvg.toFixed(0) : '—';

  if (s.top.length) {
    els.offenders.classList.remove('hidden');
    els.offenderList.innerHTML = '';
    s.top.forEach(t => {
      const li = document.createElement('li');
      const src = document.createElement('span'); src.className = 'src'; src.textContent = t.src;
      const dur = document.createElement('span'); dur.className = 'dur'; dur.textContent = t.dur.toFixed(0) + ' ms';
      li.append(src, dur); els.offenderList.appendChild(li);
    });
  }
}

async function poll() {
  const res = await sendCmd('profiler:get');
  if (res && res.ok) render(res);
}

els.startBtn.addEventListener('click', async () => {
  const tab = await getActiveTab();
  if (!tab) return;
  tabId = tab.id;
  await ensureProfiler(tabId);
  const res = await sendCmd('profiler:start');
  if (res && res.ok) {
    setRunning(true);
    poll();
    pollTimer = setInterval(poll, 1500);
  }
});

els.stopBtn.addEventListener('click', async () => {
  clearInterval(pollTimer);
  await sendCmd('profiler:stop');
  setRunning(false);
});
