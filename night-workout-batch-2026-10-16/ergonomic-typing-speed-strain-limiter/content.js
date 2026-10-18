// Pace Nudge — content script (boot-once).
// Measures keystroke rate in editable fields; if sustained WPM exceeds the
// threshold, shows a gentle, dismissible nudge banner. Never blocks typing.
(() => {
  if (window.__paceNudgeLoaded) return;
  window.__paceNudgeLoaded = true;

  const WINDOW_MS = 60_000;      // rolling 60s window for WPM
  const SUSTAIN_MS = 20_000;     // must exceed threshold for 20s before nudging

  let watching = false;
  let threshold = 90;
  let cooldownMs = 120_000;
  let keyTimes = [];
  let keystrokes = 0;
  let nudges = 0;
  let overSince = 0;
  let lastNudgeAt = 0;
  let banner = null;

  const now = () => performance.now();
  // 5 keystrokes ≈ 1 word (industry-standard estimate)
  const currentWpm = () => {
    const cutoff = now() - WINDOW_MS;
    keyTimes = keyTimes.filter((t) => t > cutoff);
    return (keyTimes.length / 5) / (WINDOW_MS / 60_000);
  };

  function onKeydown(e) {
    if (!watching) return;
    // Count typing in editable areas (or anywhere except shortcuts)
    const el = e.target;
    const editable = el && (el.isContentEditable || /^(INPUT|TEXTAREA)$/.test(el.tagName));
    if (!editable && (e.ctrlKey || e.metaKey || e.altKey)) return;
    if (e.key.length !== 1 && e.key !== 'Backspace' && e.key !== 'Enter' && e.key !== ' ') return;
    keyTimes.push(now());
    keystrokes++;
  }

  function showNudge(wpm) {
    hideNudge();
    banner = document.createElement('div');
    banner.id = 'pace-nudge-banner';
    banner.innerHTML = `
      <span>🐢 You've been typing at ~${Math.round(wpm)} WPM — consider easing off for a moment.</span>
      <button>OK</button>`;
    banner.querySelector('button').addEventListener('click', hideNudge);
    document.documentElement.appendChild(banner);
    nudges++;
    lastNudgeAt = Date.now();
    // Auto-dismiss after 12s so it never nags
    setTimeout(hideNudge, 12_000);
  }

  function hideNudge() {
    if (banner) { banner.remove(); banner = null; }
  }

  function tick() {
    if (!watching) return;
    const wpm = currentWpm();
    if (wpm > threshold) {
      if (!overSince) overSince = Date.now();
      if (Date.now() - overSince >= SUSTAIN_MS && Date.now() - lastNudgeAt >= cooldownMs) {
        showNudge(wpm);
        overSince = 0;
      }
    } else {
      overSince = 0;
    }
  }

  const tickTimer = setInterval(tick, 2000);

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.type === 'PACE_NUDGE_START') {
      watching = true;
      threshold = msg.threshold || 90;
      cooldownMs = (msg.cooldown || 120) * 1000;
      keyTimes = []; keystrokes = 0; overSince = 0;
      sendResponse({ ok: true });
    } else if (msg.type === 'PACE_NUDGE_STOP') {
      watching = false;
      hideNudge();
      sendResponse({ ok: true });
    } else if (msg.type === 'PACE_NUDGE_STATUS') {
      sendResponse({ watching, stats: { wpm: currentWpm(), nudges, keystrokes } });
    }
    return true;
  });

  window.addEventListener('keydown', onKeydown, true);

  // Styles injected once (banner only)
  const style = document.createElement('style');
  style.textContent = `
    #pace-nudge-banner {
      position: fixed; bottom: 18px; right: 18px; z-index: 2147483647;
      background: rgba(15,17,21,.92); color: #e8eaf0;
      border: 1px solid rgba(163,230,53,.5); border-radius: 12px;
      padding: 10px 14px; font: 13px/1.4 system-ui, sans-serif;
      display: flex; gap: 10px; align-items: center;
      box-shadow: 0 8px 24px rgba(0,0,0,.5);
    }
    #pace-nudge-banner button {
      background: #a3e635; color: #141a08; border: none; border-radius: 8px;
      padding: 5px 12px; font-weight: 600; cursor: pointer;
    }`;
  document.documentElement.appendChild(style);
})();
