/* StudyGate popup — kid study view + PIN-gated parent settings.
 * All state lives in chrome.storage.local; the background service worker owns the timer. */
'use strict';

const $ = (id) => document.getElementById(id);
const BUILTIN_DOMAINS = ['youtube.com', 'youtu.be', 'youtube-nocookie.com', 'youtubekids.com'];
const RING_C = 326.7; // 2*pi*52

/* ---------- storage helpers ---------- */
async function loadAll() {
  const d = await chrome.storage.local.get(['settings', 'progress']);
  const settings = Object.assign(
    { pinSalt: null, pinHash: null, goalMin: 25, extraDomains: [] },
    d.settings || {}
  );
  const progress = Object.assign(
    { lastDay: null, todaySec: 0, unlockedToday: false, studying: false,
      streak: 0, bestStreak: 0, goalsDone: 0, history: {} },
    d.progress || {}
  );
  return { settings, progress };
}
async function saveSettings(s) { await chrome.storage.local.set({ settings: s }); }
async function saveProgress(p) { await chrome.storage.local.set({ progress: p }); }

/* ---------- PIN (SHA-256, salted, local only) ---------- */
async function hashPin(pin, salt) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(salt + ':' + pin));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
const newSalt = () => [...crypto.getRandomValues(new Uint8Array(16))]
  .map((b) => b.toString(16).padStart(2, '0')).join('');

/* ---------- formatting ---------- */
const fmtTime = (sec) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;

/* ---------- study view ---------- */
async function renderStudy() {
  const { settings, progress } = await loadAll();
  const goalSec = settings.goalMin * 60;
  const done = Math.min(progress.todaySec, goalSec);
  const pct = goalSec ? done / goalSec : 0;

  $('ring-fg').style.strokeDashoffset = RING_C * (1 - pct);
  $('timer-time').textContent = fmtTime(progress.todaySec);
  $('timer-label').textContent = `of ${settings.goalMin} min goal`;

  const unlocked = progress.unlockedToday;
  $('status-card').classList.toggle('unlocked', unlocked);
  $('status-icon').textContent = unlocked ? '🔓' : '🔒';
  $('status-title').textContent = unlocked ? 'YouTube is unlocked!' : 'YouTube is locked';
  $('status-desc').textContent = unlocked
    ? 'Goal smashed — enjoy responsibly.'
    : `${Math.max(0, Math.ceil((goalSec - progress.todaySec) / 60))} min of study left to unlock.`;

  $('btn-start').hidden = progress.studying || unlocked;
  $('btn-pause').hidden = !progress.studying;
  $('btn-start').textContent = progress.todaySec > 0 && !unlocked ? '▶ Keep studying' : '▶ Start studying';

  $('stat-streak').textContent = progress.streak;
  $('stat-best').textContent = progress.bestStreak;
  $('stat-total').textContent = progress.goalsDone;

  // last-7-days bars
  const bars = $('week-bars');
  bars.innerHTML = '';
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const sec = (progress.history || {})[key] || 0;
    const hit = sec >= goalSec;
    const h = Math.min(100, Math.round((sec / goalSec) * 100));
    const day = document.createElement('div');
    day.className = 'day';
    day.title = `${d.toLocaleDateString(undefined, { weekday: 'short' })}: ${fmtTime(sec)}`;
    day.innerHTML = `<div class="bar${hit ? ' done' : ''}" style="height:${Math.max(6, h)}%"></div>
                     <div class="day-label">${'SMTWTFS'[d.getDay()]}</div>`;
    bars.appendChild(day);
  }
}

/* ---------- parent view ---------- */
let parentUnlocked = false;

function renderDomains(settings) {
  const list = $('domain-list');
  list.innerHTML = '';
  const all = [...BUILTIN_DOMAINS.map((d) => ({ d, builtin: true })),
               ...settings.extraDomains.map((d) => ({ d, builtin: false }))];
  for (const { d, builtin } of all) {
    const chip = document.createElement('span');
    chip.className = 'chip' + (builtin ? ' builtin' : '');
    chip.innerHTML = `<span></span>`;
    chip.firstChild.textContent = d + (builtin ? ' (built-in)' : '');
    if (!builtin) {
      const x = document.createElement('button');
      x.type = 'button';
      x.textContent = '✕';
      x.title = 'Remove';
      x.addEventListener('click', async () => {
        const { settings: s } = await loadAll();
        s.extraDomains = s.extraDomains.filter((v) => v !== d);
        await saveSettings(s);
        renderDomains(s);
      });
      chip.appendChild(x);
    }
    list.appendChild(chip);
  }
}

async function tryPin() {
  const { settings } = await loadAll();
  const val = $('pin-input').value.trim();
  if (!val) return;
  if (!settings.pinHash) {
    // first-run: set the PIN
    const salt = newSalt();
    settings.pinHash = await hashPin(val, salt);
    settings.pinSalt = salt;
    await saveSettings(settings);
  } else {
    const h = await hashPin(val, settings.pinSalt);
    if (h !== settings.pinHash) {
      $('pin-msg').textContent = 'Wrong PIN — try again.';
      $('pin-input').value = '';
      return;
    }
  }
  parentUnlocked = true;
  $('pin-gate').hidden = true;
  $('parent-settings').hidden = false;
  $('set-goal').value = settings.goalMin;
  renderDomains(settings);
}

function cleanHost(v) {
  return v.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/^\.+/, '');
}

/* ---------- wire up ---------- */
document.addEventListener('DOMContentLoaded', async () => {
  // tabs
  $('tab-study').addEventListener('click', () => {
    $('tab-study').classList.add('active'); $('tab-parent').classList.remove('active');
    $('view-study').hidden = false; $('view-parent').hidden = true;
  });
  $('tab-parent').addEventListener('click', () => {
    $('tab-parent').classList.add('active'); $('tab-study').classList.remove('active');
    $('view-parent').hidden = false; $('view-study').hidden = true;
  });

  // study controls
  $('btn-start').addEventListener('click', () => chrome.runtime.sendMessage({ type: 'study-start' }));
  $('btn-pause').addEventListener('click', () => chrome.runtime.sendMessage({ type: 'study-pause' }));
  $('btn-reset').addEventListener('click', async () => {
    if (!confirm('Reset today\'s study progress?')) return;
    await chrome.runtime.sendMessage({ type: 'study-reset-day' });
  });

  // parent PIN
  $('pin-go').addEventListener('click', tryPin);
  $('pin-input').addEventListener('keydown', (e) => { if (e.key === 'Enter') tryPin(); });
  const { settings } = await loadAll();
  if (!settings.pinHash) $('pin-hint').hidden = false;

  $('set-goal').addEventListener('change', async (e) => {
    const v = Math.min(180, Math.max(5, parseInt(e.target.value, 10) || 25));
    e.target.value = v;
    const { settings: s } = await loadAll();
    s.goalMin = v;
    await saveSettings(s);
  });

  $('domain-add').addEventListener('click', async () => {
    const host = cleanHost($('domain-input').value);
    if (!host || !/^[a-z0-9.-]+\.[a-z]{2,}$/.test(host)) {
      $('domain-input').value = '';
      return;
    }
    const { settings: s } = await loadAll();
    if (!BUILTIN_DOMAINS.includes(host) && !s.extraDomains.includes(host)) {
      // extra domains need explicit host permission granted by the parent
      const granted = await chrome.permissions.request({ origins: [`*://${host}/*`] });
      if (granted) {
        s.extraDomains.push(host);
        await saveSettings(s);
        try { await chrome.scripting.registerContentScripts([{
          id: 'studygate-' + host, matches: [`*://${host}/*`], js: ['content.js'], runAt: 'document_idle'
        }]); } catch (e) { /* already registered */ }
      }
    }
    $('domain-input').value = '';
    renderDomains(s);
  });

  $('btn-change-pin').addEventListener('click', async () => {
    const np = prompt('Enter a new parent PIN (4+ characters):');
    if (!np || np.trim().length < 4) return;
    const { settings: s } = await loadAll();
    const salt = newSalt();
    s.pinHash = await hashPin(np.trim(), salt);
    s.pinSalt = salt;
    await saveSettings(s);
    alert('PIN updated.');
  });

  $('btn-reset-day').addEventListener('click', async () => {
    if (!confirm('Reset today\'s study progress?')) return;
    await chrome.runtime.sendMessage({ type: 'study-reset-day' });
  });

  $('btn-lock-settings').addEventListener('click', () => {
    parentUnlocked = false;
    $('parent-settings').hidden = true;
    $('pin-gate').hidden = false;
    $('pin-input').value = '';
    $('pin-msg').textContent = 'Enter the parent PIN to change settings.';
  });

  await renderStudy();
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && (changes.progress || changes.settings)) renderStudy();
  });
  setInterval(renderStudy, 5000); // keep countdown fresh
});
