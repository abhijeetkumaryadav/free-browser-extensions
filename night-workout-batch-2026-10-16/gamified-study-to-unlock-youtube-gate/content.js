/* StudyGate lock overlay — injected on configured video sites.
 * Shows a friendly full-page gate while the daily study goal is unmet.
 * Fully reversible, user-triggered by design; a tech-savvy kid can bypass any
 * extension, so this is a family-agreement aid, not a lock-down tool. */
'use strict';

const OVERLAY_ID = 'studygate-lock-overlay';

function fmtLeft(sec) {
  const m = Math.max(0, Math.ceil(sec / 60));
  return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m} min`;
}

function buildOverlay(remainingSec, goalMin) {
  const el = document.createElement('div');
  el.id = OVERLAY_ID;
  el.innerHTML = `
    <div class="sg-card">
      <div class="sg-emoji">📚</div>
      <h2>Study time first!</h2>
      <p>YouTube unlocks after <strong>${goalMin} minutes</strong> of study today.</p>
      <div class="sg-left">${fmtLeft(remainingSec)}</div>
      <div class="sg-sub">left to go — you've got this! 💪</div>
      <div class="sg-bar"><div class="sg-fill"></div></div>
      <p class="sg-note">Open the StudyGate popup to run your study timer.</p>
    </div>`;
  const style = document.createElement('style');
  style.textContent = `
    #${OVERLAY_ID} { position: fixed; inset: 0; z-index: 2147483647;
      display: flex; align-items: center; justify-content: center;
      background: rgba(10,10,14,0.88); backdrop-filter: blur(14px);
      font-family: -apple-system, "Segoe UI", Roboto, sans-serif; }
    #${OVERLAY_ID} .sg-card { background: rgba(20,20,26,0.85); border: 1px solid rgba(245,158,11,0.35);
      border-radius: 20px; padding: 36px 44px; text-align: center; color: #f4f4f5;
      box-shadow: 0 20px 60px rgba(0,0,0,0.5); max-width: 420px; }
    #${OVERLAY_ID} .sg-emoji { font-size: 54px; margin-bottom: 10px; }
    #${OVERLAY_ID} h2 { font-size: 24px; margin: 0 0 8px; color: #fbbf24; }
    #${OVERLAY_ID} p { font-size: 14px; color: #d4d4d8; margin: 0 0 6px; line-height: 1.5; }
    #${OVERLAY_ID} .sg-left { font-size: 44px; font-weight: 800; color: #f59e0b; margin: 10px 0 2px; }
    #${OVERLAY_ID} .sg-sub { font-size: 12px; color: #a1a1aa; margin-bottom: 14px; }
    #${OVERLAY_ID} .sg-bar { height: 10px; background: rgba(255,255,255,0.1); border-radius: 99px; overflow: hidden; margin-bottom: 12px; }
    #${OVERLAY_ID} .sg-fill { height: 100%; background: linear-gradient(90deg,#f59e0b,#fbbf24); border-radius: 99px; transition: width .5s; }
    #${OVERLAY_ID} .sg-note { font-size: 11.5px; color: #a1a1aa; }`;
  el.appendChild(style);
  return el;
}

function pauseMedia() {
  document.querySelectorAll('video, audio').forEach((m) => { try { m.pause(); } catch (e) {} });
}

async function refresh() {
  const d = await chrome.storage.local.get(['settings', 'progress']);
  const settings = Object.assign({ goalMin: 25 }, d.settings || {});
  const progress = Object.assign({ todaySec: 0, unlockedToday: false, lastDay: null }, d.progress || {});
  const today = new Date().toDateString();
  const locked = !(progress.unlockedToday && progress.lastDay === today);

  let el = document.getElementById(OVERLAY_ID);
  if (!locked) {
    if (el) el.remove();
    return;
  }
  const goalSec = settings.goalMin * 60;
  const remaining = Math.max(0, goalSec - progress.todaySec);
  if (!el) {
    el = buildOverlay(remaining, settings.goalMin);
    (document.documentElement || document.body).appendChild(el);
    pauseMedia();
    // Re-assert if the page tries to remove it.
    new MutationObserver(() => {
      if (!document.getElementById(OVERLAY_ID)) refresh();
    }).observe(document.documentElement, { childList: true, subtree: true });
  } else {
    const left = el.querySelector('.sg-left');
    if (left) left.textContent = fmtLeft(remaining);
    const fill = el.querySelector('.sg-fill');
    if (fill) fill.style.width = Math.min(100, (progress.todaySec / goalSec) * 100) + '%';
  }
}

refresh();
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && (changes.progress || changes.settings)) refresh();
});
setInterval(refresh, 30000); // keep countdown fresh
