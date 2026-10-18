// Pace Nudge — popup: start/stop the tab keystroke monitor, manage settings + stats.
const $ = (id) => document.getElementById(id);

async function getSettings() {
  return chrome.storage.local.get({ threshold: 90, cooldown: 120 });
}

async function getState() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const tabId = tabs[0]?.id;
  if (!tabId) return { watching: false, stats: null };
  try {
    const res = await chrome.tabs.sendMessage(tabId, { type: 'PACE_NUDGE_STATUS' });
    return { watching: !!res?.watching, stats: res?.stats || null };
  } catch {
    return { watching: false, stats: null };
  }
}

function render(watching, stats) {
  const btn = $('toggleBtn');
  btn.textContent = watching ? 'Stop watching' : 'Start watching';
  btn.classList.toggle('off', watching);
  $('stStatus').textContent = watching ? 'Watching' : 'Idle';
  $('stWpm').textContent = stats ? Math.round(stats.wpm) : 0;
  $('stNudges').textContent = stats ? stats.nudges : 0;
  $('stKeys').textContent = stats ? stats.keystrokes : 0;
}

$('toggleBtn').addEventListener('click', async () => {
  const { threshold, cooldown } = await getSettings();
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const tab = tabs[0];
  if (!tab || !/^https?:/.test(tab.url || '')) return;

  await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });
  const { watching } = await getState();
  await chrome.tabs.sendMessage(tab.id, {
    type: watching ? 'PACE_NUDGE_STOP' : 'PACE_NUDGE_START',
    threshold: Number($('threshold').value) || threshold,
    cooldown: Number($('cooldown').value) || cooldown,
  });
  render(!watching, null);
  setTimeout(refresh, 600);
});

$('refreshBtn').addEventListener('click', refresh);

async function refresh() {
  const { watching, stats } = await getState();
  render(watching, stats);
}

(async () => {
  const s = await getSettings();
  $('threshold').value = s.threshold;
  $('cooldown').value = s.cooldown;
  await refresh();
})();

$('threshold').addEventListener('change', () =>
  chrome.storage.local.set({ threshold: Math.min(200, Math.max(40, Number($('threshold').value) || 90)) }));
$('cooldown').addEventListener('change', () =>
  chrome.storage.local.set({ cooldown: Math.min(600, Math.max(15, Number($('cooldown').value) || 120)) }));
