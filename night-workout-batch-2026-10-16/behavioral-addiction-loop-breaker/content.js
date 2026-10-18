/* LoopBreaker — content script.
 * 1) Heuristic detection of addictive patterns (infinite scroll, autoplay,
 *    streak counters, pull-to-refresh bait, notification-dot bait).
 * 2) Optional gentle friction: after N minutes of visible page time, show a
 *    breather overlay for a short pause. Never blocks anything. */
/* global chrome */
(() => {
  'use strict';
  if (window.__loopbreaker_loaded) return;
  window.__loopbreaker_loaded = true;

  const NS = 'loopbreaker';

  /* ---------- pattern detection (heuristic) ---------- */
  function detectPatterns() {
    const found = [];
    const push = (kind, label, detail) => found.push({ kind, label, detail });

    // Infinite scroll: document grows as you scroll, or sentinel loaders.
    const scroller = document.scrollingElement || document.documentElement;
    const grows = scroller.scrollHeight > window.innerHeight * 2.5;
    const loaderHints = document.querySelectorAll(
      '[class*="infinite"], [class*="load-more"], [data-testid*="loader"], .spinner, [aria-label*="oad more" i]'
    ).length;
    if (grows && loaderHints > 0) {
      push('scroll', 'Infinite scroll', 'Page keeps loading more content as you scroll.');
    } else if (grows) {
      push('scroll', 'Very long feed', 'This page is much taller than your screen — easy to lose track of time.');
    }

    // Autoplay videos.
    const vids = [...document.querySelectorAll('video')];
    const autoplay = vids.filter((v) => v.autoplay || (v.paused === false && v.muted && v.currentTime > 0));
    if (autoplay.length > 0) {
      push('autoplay', 'Autoplay video', `${autoplay.length} video(s) start playing on their own.`);
    }

    // Streak / reward counters.
    const bodyText = (document.body ? document.body.innerText : '').slice(0, 20000);
    if (/\b\d+\s*(day streak|streak|troph|badge|level\s*\d+|points?)\b/i.test(bodyText) &&
        /\b(streak|daily|reward|troph|badge)\b/i.test(bodyText)) {
      push('streak', 'Streak / reward hooks', 'Streaks and badges nudge you to come back every day.');
    }

    // Notification-dot bait: red badges with counts.
    const dots = [...document.querySelectorAll('[class*="badge"], [class*="notif"], [aria-label*="notification" i]')]
      .filter((el) => /\d+/.test(el.textContent || '') && el.textContent.trim().length < 6);
    if (dots.length > 0) {
      push('bait', 'Notification bait', `${dots.length} unread-count badge(s) pull your attention.`);
    }

    // Pull-to-refresh / stories-style ephemeral content.
    const stories = document.querySelectorAll(
      '[class*="stor" i], [aria-label*="stor" i]'
    ).length;
    if (stories > 3) {
      push('ephemeral', 'Ephemeral stories', 'Disappearing content creates “watch now or miss out” pressure.');
    }

    return found;
  }

  /* ---------- breather overlay ---------- */
  function showBreather(seconds, onDone) {
    if (document.getElementById(NS + '-overlay')) return;
    const ov = document.createElement('div');
    ov.id = NS + '-overlay';
    ov.setAttribute('role', 'dialog');
    ov.setAttribute('aria-label', 'Take a breather');
    const shadow = ov.attachShadow({ mode: 'closed' });
    const wrap = document.createElement('div');
    wrap.innerHTML = `
      <style>
        .lb { position: fixed; inset: 0; z-index: 2147483647; display: flex;
              align-items: center; justify-content: center;
              background: rgba(8, 8, 14, 0.82); backdrop-filter: blur(10px);
              font-family: -apple-system, "Segoe UI", sans-serif; }
        .lb-card { background: rgba(20,20,26,0.92); border: 1px solid rgba(255,255,255,0.1);
                   border-radius: 18px; padding: 28px 32px; text-align: center; max-width: 340px;
                   color: #f1f1f6; }
        .lb-emoji { font-size: 44px; }
        .lb h2 { font-size: 18px; margin: 10px 0 6px; }
        .lb p { font-size: 13px; color: #9a9aad; margin-bottom: 14px; }
        .lb-count { font-size: 40px; font-weight: 800; color: #fb923c; margin: 8px 0 16px; }
        .lb button { padding: 10px 18px; border-radius: 10px; border: none; cursor: pointer;
                     font-weight: 700; font-size: 14px; background: #fb923c; color: #1c0d06; }
      </style>
      <div class="lb"><div class="lb-card">
        <div class="lb-emoji">🌿</div>
        <h2>Take a breather</h2>
        <p>You've been scrolling for a while. Rest your eyes — the page will wait.</p>
        <div class="lb-count" id="lbCount">${seconds}</div>
        <button id="lbDone">I'm back, thanks</button>
      </div></div>`;
    shadow.appendChild(wrap);
    document.documentElement.appendChild(ov);
    const countEl = wrap.querySelector('#lbCount');
    let left = seconds;
    const tick = setInterval(() => {
      left -= 1;
      if (left <= 0) {
        clearInterval(tick);
        dismiss();
        return;
      }
      countEl.textContent = left;
    }, 1000);
    function dismiss() {
      clearInterval(tick);
      ov.remove();
      onDone();
    }
    wrap.querySelector('#lbDone').addEventListener('click', dismiss);
  }

  /* ---------- session friction driver ---------- */
  async function maybeStartFriction() {
    const cfg = await chrome.storage.local.get({
      enabled: false, interval: 20, pauseLen: 30
    });
    if (!cfg.enabled) return;
    let visibleSecs = 0;
    let lastTick = Date.now();
    setInterval(() => {
      if (document.visibilityState !== 'visible') { lastTick = Date.now(); return; }
      visibleSecs += (Date.now() - lastTick) / 1000;
      lastTick = Date.now();
      if (visibleSecs >= cfg.interval * 60) {
        visibleSecs = 0;
        showBreather(cfg.pauseLen, () => {
          // record a completed breather
          const day = new Date().toISOString().slice(0, 10);
          chrome.storage.local.get({ stats: {} }, ({ stats }) => {
            const s = stats[day] || { breaks: 0, mins: 0, loops: 0 };
            s.breaks += 1;
            s.mins += cfg.interval;
            stats[day] = s;
            chrome.storage.local.set({ stats });
          });
        });
      }
    }, 5000);
  }

  /* ---------- message bridge ---------- */
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg && msg.type === 'loopbreaker-detect') {
      try {
        const patterns = detectPatterns();
        const day = new Date().toISOString().slice(0, 10);
        chrome.storage.local.get({ stats: {} }, ({ stats }) => {
          const s = stats[day] || { breaks: 0, mins: 0, loops: 0 };
          s.loops += patterns.length;
          stats[day] = s;
          chrome.storage.local.set({ stats });
        });
        sendResponse({ ok: true, patterns });
      } catch (err) {
        sendResponse({ ok: false, error: String((err && err.message) || err) });
      }
    }
    return false;
  });

  maybeStartFriction();
})();
