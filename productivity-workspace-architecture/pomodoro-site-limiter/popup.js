/* Pomodoro Site Limiter — popup logic */

const $ = (id) => document.getElementById(id);
let focusMin = 25, breakMin = 5;
let tickIv = null;

/* ---------- Presets ---------- */
document.querySelectorAll('.preset').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.preset').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    if (btn.dataset.focus === 'custom') {
      $('customRow').classList.remove('hidden');
      focusMin = parseInt($('customFocus').value, 10) || 25;
      breakMin = parseInt($('customBreak').value, 10) || 5;
    } else {
      $('customRow').classList.add('hidden');
      focusMin = parseInt(btn.dataset.focus, 10);
      breakMin = parseInt(btn.dataset.break, 10);
    }
    chrome.storage.local.set({ prefs: { focusMin, breakMin } });
    updateIdleDisplay();
  });
});
$('customFocus').addEventListener('input', () => {
  focusMin = Math.min(Math.max(parseInt($('customFocus').value, 10) || 25, 1), 180);
  updateIdleDisplay();
});
$('customBreak').addEventListener('input', () => {
  breakMin = Math.min(Math.max(parseInt($('customBreak').value, 10) || 5, 1), 60);
  updateIdleDisplay();
});

/* ---------- Timer controls ---------- */
$('startBtn').addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'start', focusMin, breakMin }, () => render());
});
$('resetBtn').addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'reset' }, () => render());
});

/* ---------- Blocklist ---------- */
function normalize(input) {
  let h = input.trim().toLowerCase();
  h = h.replace(/^https?:\/\//, '').split('/')[0].replace(/^www\./, '');
  return h;
}

$('addBtn').addEventListener('click', () => addSite($('siteInput').value));
$('siteInput').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') addSite($('siteInput').value);
});
$('addCurrentBtn').addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab && tab.url) {
    try {
      addSite(new URL(tab.url).hostname);
    } catch { /* ignore non-URL tabs */ }
  }
});

async function addSite(raw) {
  const host = normalize(raw);
  if (!host || !host.includes('.')) return;
  const { blocklist = [] } = await chrome.storage.local.get('blocklist');
  if (!blocklist.includes(host)) {
    blocklist.push(host);
    await chrome.storage.local.set({ blocklist });
  }
  $('siteInput').value = '';
  renderBlocklist(blocklist);
}

async function renderBlocklist(list) {
  const { blocklist = [] } = list ? { blocklist: list } : await chrome.storage.local.get('blocklist');
  $('blockCount').textContent = blocklist.length;
  const el = $('blockList');
  el.innerHTML = '';
  if (!blocklist.length) {
    el.innerHTML = '<div class="empty-block">No sites blocked yet.</div>';
    return;
  }
  for (const host of blocklist) {
    const row = document.createElement('div');
    row.className = 'block-item';
    const span = document.createElement('span');
    span.className = 'host';
    span.textContent = host;
    const rm = document.createElement('button');
    rm.className = 'remove';
    rm.title = 'Remove';
    rm.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
    rm.addEventListener('click', async () => {
      const { blocklist: bl = [] } = await chrome.storage.local.get('blocklist');
      await chrome.storage.local.set({ blocklist: bl.filter((b) => b !== host) });
      renderBlocklist();
    });
    row.appendChild(span);
    row.appendChild(rm);
    el.appendChild(row);
  }
}

/* ---------- Timer display ---------- */
function fmt(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

function updateIdleDisplay() {
  $('timeLeft').textContent = fmt(focusMin * 60 * 1000);
  $('phaseLabel').textContent = 'Ready';
  $('phaseLabel').className = 'phase';
  $('statusLine').textContent = 'No session running';
  $('statusLine').className = 'subtitle';
  $('startBtn').disabled = false;
  $('startBtn').textContent = 'Start focus';
  document.querySelectorAll('.preset').forEach((b) => (b.disabled = false));
}

async function render() {
  const state = await chrome.runtime.sendMessage({ type: 'getState' }).catch(() => null);
  const session = state && state.session;
  const stats = (state && state.stats) || { completed: 0 };
  $('sessionStats').textContent = `${stats.completed} focus session${stats.completed === 1 ? '' : 's'} completed`;

  clearInterval(tickIv);
  if (!session || !session.running) {
    updateIdleDisplay();
    return;
  }

  const update = () => {
    const left = session.endsAt - Date.now();
    if (left <= 0) { render(); return; }
    $('timeLeft').textContent = fmt(left);
    const isFocus = session.phase === 'focus';
    $('phaseLabel').textContent = isFocus ? 'Focusing' : 'On break';
    $('phaseLabel').className = 'phase ' + (isFocus ? 'focus' : 'break');
    $('statusLine').textContent = isFocus
      ? `Focus active — blocked sites are paused`
      : `Break — all sites unlocked`;
    $('statusLine').className = 'subtitle ' + (isFocus ? 'live' : 'rest');
    $('startBtn').disabled = true;
    $('startBtn').textContent = isFocus ? 'Focusing…' : 'On break…';
    document.querySelectorAll('.preset').forEach((b) => (b.disabled = true));
  };
  update();
  tickIv = setInterval(update, 1000);
}

/* ---------- Init ---------- */
(async function init() {
  const { prefs } = await chrome.storage.local.get('prefs');
  if (prefs) {
    focusMin = prefs.focusMin; breakMin = prefs.breakMin;
    const match = [...document.querySelectorAll('.preset')].find(
      (b) => b.dataset.focus == String(focusMin) && b.dataset.break == String(breakMin));
    document.querySelectorAll('.preset').forEach((b) => b.classList.remove('active'));
    if (match) {
      match.classList.add('active');
    } else {
      document.querySelector('[data-focus="custom"]').classList.add('active');
      $('customRow').classList.remove('hidden');
      $('customFocus').value = focusMin;
      $('customBreak').value = breakMin;
    }
  }
  renderBlocklist();
  render();
})();
