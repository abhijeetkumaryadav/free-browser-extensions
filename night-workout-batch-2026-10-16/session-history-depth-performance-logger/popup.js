/* Popup: reads history.length from the active tab on click, stores samples,
 * renders a simple depth-over-time bar chart and a log table. */

const KEY = 'depthSamples'; // [{ts, tabId, url, title, depth}]
const MAX_SAMPLES = 100;

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

async function loadSamples() {
  const data = await chrome.storage.local.get(KEY);
  return Array.isArray(data[KEY]) ? data[KEY] : [];
}

async function saveSamples(samples) {
  await chrome.storage.local.set({ [KEY]: samples.slice(-MAX_SAMPLES) });
}

function fmtTime(ts) {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function render(samples) {
  document.getElementById('sampleCount').textContent = samples.length;
  const latest = samples[samples.length - 1];
  document.getElementById('curDepth').textContent = latest ? latest.depth : '—';

  // Bar chart: last 30 samples.
  const chart = document.getElementById('chart');
  const recent = samples.slice(-30);
  if (recent.length === 0) {
    chart.innerHTML = '<p class="empty">No samples yet. Click “Log this tab\'s depth” as you browse, then watch the stack grow.</p>';
  } else {
    const max = Math.max(...recent.map((s) => s.depth), 1);
    chart.innerHTML = '<div class="bars">' + recent.map((s) => {
      const h = Math.max(6, Math.round((s.depth / max) * 90));
      return `<div class="bar" style="height:${h}px" title="${esc(s.url)}\ndepth ${s.depth} · ${fmtTime(s.ts)}"><span class="bar-val">${s.depth}</span></div>`;
    }).join('') + '</div>';
  }

  // Log table, newest first.
  const log = document.getElementById('log');
  if (samples.length === 0) {
    log.innerHTML = '<p class="empty">Nothing logged yet.</p>';
  } else {
    log.innerHTML = [...samples].reverse().slice(0, 30).map((s) => `
      <div class="log-row">
        <span class="log-depth">${s.depth}</span>
        <div class="log-main">
          <span class="log-title">${esc(s.title || s.url)}</span>
          <span class="log-meta">${esc(hostOf(s.url))} · ${fmtTime(s.ts)}</span>
        </div>
      </div>`).join('');
  }
}

function hostOf(url) {
  try { return new URL(url).hostname; } catch { return url; }
}

async function logCurrentTab() {
  const btn = document.getElementById('logBtn');
  btn.disabled = true;
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || tab.id == null) return;
    // Read history.length inside the page via scripting (click-only injection).
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => ({ depth: history.length, url: location.href, title: document.title || '' }),
    });
    const r = results && results[0] && results[0].result;
    if (!r) return;
    const samples = await loadSamples();
    samples.push({ ts: Date.now(), tabId: tab.id, url: r.url, title: r.title, depth: r.depth });
    await saveSamples(samples);
    render(samples);
  } catch (e) {
    // e.g. chrome:// pages where scripting is blocked — show a gentle note.
    const log = document.getElementById('log');
    log.innerHTML = '<p class="empty">Could not read this tab (browser internal pages are off-limits).</p>';
  } finally {
    btn.disabled = false;
  }
}

async function init() {
  document.getElementById('logBtn').addEventListener('click', logCurrentTab);
  document.getElementById('clearBtn').addEventListener('click', async () => {
    await chrome.storage.local.remove(KEY);
    render([]);
  });
  render(await loadSamples());
}

init();
