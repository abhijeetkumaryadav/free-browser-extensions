/* Page Activity Audit — popup logic.
   Injects the measurement script on explicit click, polls storage for
   the result, scores the page, and lists open tabs for manual cleanup. */
'use strict';

const $ = (id) => document.getElementById(id);

const ICON_WARN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/></svg>';
const ICON_OK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.1V12a10 10 0 1 1-5.9-9.1"/><path d="M22 4 12 14l-3-3"/></svg>';

// Score 0 (heavy) → 100 (light). Weighted from measured signals.
function scorePage(r) {
  let s = 100;
  s -= Math.min(30, r.longTaskCount * 4);                 // long tasks
  s -= Math.min(20, Math.max(0, (30 - r.fps)) * 1.2);     // low fps
  s -= Math.min(25, Math.max(0, (r.p95LoopLagMs - 8)) * 1.5); // event-loop lag
  s -= Math.min(15, Math.floor(r.resourcesLoaded / 20));  // network churn
  return Math.max(0, Math.round(s));
}

function verdictFor(score) {
  if (score >= 80) return 'Light — easy on battery';
  if (score >= 60) return 'Moderate activity';
  if (score >= 40) return 'Busy — may drain battery';
  return 'Heavy — energy hog';
}

function buildFindings(r) {
  const out = [];
  if (!r.longTaskSupported) {
    out.push({ ok: true, title: 'Long-task data unavailable', desc: 'This browser does not expose long-task entries (e.g. Firefox). Score relies on frame rate and loop lag.' });
  } else if (r.longTaskCount > 10) {
    out.push({ ok: false, title: `${r.longTaskCount} long tasks in 5s`, desc: `The main thread was blocked for ${r.totalBlockedMs}ms total (worst ${r.worstLongTaskMs}ms). Heavy scripts, ads, or trackers may be responsible.` });
  } else if (r.longTaskCount > 0) {
    out.push({ ok: false, title: `${r.longTaskCount} long task(s)`, desc: `Minor jank: ${r.totalBlockedMs}ms blocked. Usually harmless.` });
  } else {
    out.push({ ok: true, title: 'No long tasks', desc: 'The main thread stayed responsive during the measurement.' });
  }
  if (r.fps < 30) {
    out.push({ ok: false, title: `Low frame rate (${r.fps} FPS)`, desc: 'Choppy rendering — often from animations, video, or canvas work. Note: background tabs are throttled by the browser.' });
  } else {
    out.push({ ok: true, title: `Smooth rendering (${r.fps} FPS)`, desc: 'Frame rate looks healthy.' });
  }
  if (r.p95LoopLagMs > 25) {
    out.push({ ok: false, title: `Event-loop lag (p95 ${r.p95LoopLagMs}ms)`, desc: 'Possible runaway timers or busy handlers keeping the page awake. This keeps the CPU (and battery) working.' });
  } else {
    out.push({ ok: true, title: 'Event loop responsive', desc: `p95 loop lag ${r.p95LoopLagMs}ms — no sign of runaway timers.` });
  }
  if (r.resourcesLoaded > 40) {
    out.push({ ok: false, title: `${r.resourcesLoaded} new resources in 5s`, desc: 'High network churn (polling, ads, trackers). Each request wakes the radio and costs energy.' });
  }
  return out;
}

function renderResult(r) {
  $('results').classList.remove('hidden');
  const score = scorePage(r);
  $('scoreVal').textContent = score;
  $('scoreRing').style.setProperty('--p', score + '%');
  $('verdict').textContent = verdictFor(score);
  $('pageTitle').textContent = r.title || r.url;
  $('tLong').textContent = r.longTaskCount;
  $('tFps').textContent = r.fps;
  $('tLag').textContent = r.p95LoopLagMs + 'ms';
  $('tRes').textContent = r.totalResources;

  const box = $('findings');
  box.innerHTML = '';
  for (const f of buildFindings(r)) {
    const d = document.createElement('div');
    d.className = 'finding ' + (f.ok ? 'ok' : 'warn');
    d.innerHTML = (f.ok ? ICON_OK : ICON_WARN) +
      '<div><div class="f-title"></div><div class="f-desc"></div></div>';
    d.querySelector('.f-title').textContent = f.title;
    d.querySelector('.f-desc').textContent = f.desc;
    box.appendChild(d);
  }

  chrome.storage.local.set({ paa_last: r });
}

// List open tabs so the user can close heavy ones (auditing only the
// visible tab is an MV3 limitation — stated in the banner).
async function renderTabs(currentTabId) {
  const tabs = await chrome.tabs.query({ currentWindow: true });
  const box = $('tabList');
  box.innerHTML = '';
  for (const t of tabs) {
    const row = document.createElement('div');
    row.className = 'tab-row';
    const img = document.createElement('img');
    img.alt = '';
    if (t.favIconUrl && t.favIconUrl.startsWith('http')) img.src = t.favIconUrl;
    const title = document.createElement('span');
    title.className = 't-title';
    title.textContent = t.title || t.url;
    row.appendChild(img);
    row.appendChild(title);
    if (t.id === currentTabId) {
      const cur = document.createElement('span');
      cur.className = 'current';
      cur.textContent = 'AUDITED';
      row.appendChild(cur);
    } else {
      const btn = document.createElement('button');
      btn.className = 'close-btn';
      btn.textContent = 'Close';
      btn.addEventListener('click', async () => {
        await chrome.tabs.remove(t.id);
        renderTabs(currentTabId);
      });
      row.appendChild(btn);
    }
    box.appendChild(row);
  }
}

async function runAudit() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.id) return;
  if (tab.url && (tab.url.startsWith('chrome://') || tab.url.startsWith('edge://') || tab.url.startsWith('about:'))) {
    $('pageTitle').textContent = 'Cannot audit browser-internal pages.';
    $('results').classList.remove('hidden');
    $('scoreVal').textContent = '–';
    $('verdict').textContent = 'Not measurable';
    return;
  }

  $('scanBtn').disabled = true;
  $('progress').classList.remove('hidden');
  $('results').classList.add('hidden');
  $('progressFill').style.width = '0%';

  await chrome.storage.local.remove(['paa_result', 'paa_busy']);
  await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });

  // Poll storage for the measurement result (script runs ~5s).
  const started = Date.now();
  const poll = setInterval(async () => {
    const elapsed = Date.now() - started;
    $('progressFill').style.width = Math.min(98, (elapsed / 6000) * 100) + '%';
    const { paa_result: r } = await chrome.storage.local.get('paa_result');
    if (r) {
      clearInterval(poll);
      $('progressFill').style.width = '100%';
      setTimeout(() => {
        $('progress').classList.add('hidden');
        $('scanBtn').disabled = false;
        renderResult(r);
        renderTabs(tab.id);
      }, 350);
    } else if (elapsed > 15000) {
      clearInterval(poll);
      $('progress').classList.add('hidden');
      $('scanBtn').disabled = false;
      $('pageTitle').textContent = 'Measurement timed out — the page may block script injection.';
      $('results').classList.remove('hidden');
    }
  }, 500);
}

$('scanBtn').addEventListener('click', runAudit);

// Restore the last audit on open.
(async () => {
  const { paa_last: r } = await chrome.storage.local.get('paa_last');
  if (r) {
    renderResult(r);
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    renderTabs(tab && tab.id);
  }
})();
