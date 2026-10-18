/* Goose Chaos — content script. Injects a Shadow-DOM SVG goose with a
 * behaviour state machine: wander, pause, honk, nudge (lvl 2+), cursor-chase (lvl 3).
 * Harmless and fully reversible: Dismiss restores every touched element. */
'use strict';

(() => {
  // Re-injection guard: reboot the existing goose instead of duplicating it.
  if (window.__gooseChaosLoaded) {
    window.__gooseChaosReboot?.();
    return;
  }
  window.__gooseChaosLoaded = true;

  const HOST_ID = 'goose-chaos-host';
  const DEFAULTS = { enabled: true, mischief: 2, honks: true, chase: true };
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  let settings = { ...DEFAULTS };
  let host = null, shadow = null, gooseEl = null, bubbleEl = null, lowerBeak = null;
  let rafId = 0, behaviorTimer = 0;
  let x = 60, dir = 1, speed = 0, state = 'wander', stateUntil = 0;
  let mouseX = null, chaseTargetX = null;
  const nudged = new Map(); // element -> original inline transform

  /* ---------- SVG goose template ---------- */
  const GOOSE_SVG = `
  <svg class="goose-svg" viewBox="0 0 120 100" aria-hidden="true">
    <g class="goose-body">
      <ellipse cx="58" cy="66" rx="34" ry="22" fill="#f4f4f5"/>
      <ellipse cx="58" cy="60" rx="28" ry="16" fill="#ffffff"/>
      <path d="M84 58 q10 -2 14 -10 l10 -18 q3 -6 -3 -8 q-6 -2 -8 4 l-8 16 q-6 4 -9 14 z" fill="#f4f4f5"/>
      <circle cx="99" cy="26" r="9" fill="#f4f4f5"/>
      <polygon class="beak-upper" points="106,24 118,27 106,30" fill="#f97316"/>
      <polygon class="beak-lower" points="106,30 116,31 106,33" fill="#ea580c"/>
      <circle cx="101" cy="24" r="2.2" fill="#101014"/>
      <path d="M40 56 q14 -8 30 -4" stroke="#e4e4e7" stroke-width="4" fill="none" stroke-linecap="round"/>
    </g>
    <g class="legs">
      <line class="leg l1" x1="50" y1="86" x2="50" y2="98" stroke="#f97316" stroke-width="4" stroke-linecap="round"/>
      <line class="leg l2" x1="66" y1="86" x2="66" y2="98" stroke="#f97316" stroke-width="4" stroke-linecap="round"/>
    </g>
  </svg>`;

  const STYLES = `
    :host { position: fixed; left: 0; bottom: 6px; z-index: 2147483647;
            pointer-events: none; width: 0; height: 0; }
    .goose-wrap { position: absolute; bottom: 0; width: 120px; height: 100px;
                  transition: transform 0.18s linear; will-change: transform; }
    .goose-wrap.flip .goose-svg { transform: scaleX(-1); }
    .goose-svg { width: 120px; height: 100px; overflow: visible; }
    .goose-wrap.waddling .leg { transform-origin: 50% 0%; animation: waddle 0.28s ease-in-out infinite alternate; }
    .goose-wrap.waddling .leg.l2 { animation-delay: 0.14s; }
    @keyframes waddle { from { transform: rotate(-16deg); } to { transform: rotate(16deg); } }
    .goose-wrap.honking .beak-lower { transform: rotate(24deg); transform-origin: 106px 30px; }
    .goose-wrap.sitting .goose-svg { transform: scaleY(0.82); }
    .goose-wrap.flip.sitting .goose-svg { transform: scaleX(-1) scaleY(0.82); }
    .honk-bubble {
      position: absolute; bottom: 96px; left: 70px;
      background: #fff; color: #101014; font: 700 15px/1.2 system-ui, sans-serif;
      padding: 6px 12px; border-radius: 14px; border: 3px solid #f97316;
      opacity: 0; transform: scale(0.4); transform-origin: bottom left;
      transition: opacity 0.15s ease, transform 0.15s ease; white-space: nowrap;
    }
    .honk-bubble.show { opacity: 1; transform: scale(1) rotate(-6deg); }
    @media (prefers-reduced-motion: reduce) { .goose-wrap.waddling .leg { animation: none; } }
  `;

  /* ---------- Setup / teardown ---------- */
  function build() {
    host = document.createElement('div');
    host.id = HOST_ID;
    shadow = host.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = STYLES;
    const wrap = document.createElement('div');
    wrap.className = 'goose-wrap';
    wrap.innerHTML = GOOSE_SVG;
    bubbleEl = document.createElement('div');
    bubbleEl.className = 'honk-bubble';
    bubbleEl.textContent = 'HONK!';
    wrap.appendChild(bubbleEl);
    shadow.appendChild(style);
    shadow.appendChild(wrap);
    document.documentElement.appendChild(host);
    gooseEl = wrap;
    lowerBeak = wrap.querySelector('.beak-lower');
  }

  /** Restore nudged elements, stop the loop, remove the host. */
  function teardown() {
    cancelAnimationFrame(rafId);
    clearTimeout(behaviorTimer);
    for (const [el, orig] of nudged) {
      try { el.style.transform = orig; } catch { /* gone */ }
    }
    nudged.clear();
    host?.remove();
    host = null;
    window.__gooseChaosLoaded = false;
  }

  window.__gooseChaosReboot = () => {
    if (!host) { start(); }
  };

  /* ---------- Behaviours ---------- */
  function pickBehavior() {
    const now = performance.now();
    const lvl = settings.mischief;
    const roll = Math.random();
    if (settings.chase && lvl >= 3 && mouseX !== null && roll < 0.25) {
      state = 'chase'; chaseTargetX = mouseX; stateUntil = now + 2500;
    } else if (lvl >= 2 && roll < 0.45) {
      state = 'nudge'; stateUntil = now + 600; doNudge();
    } else if (settings.honks && roll < 0.65) {
      state = 'honk'; stateUntil = now + 1600; doHonk();
    } else if (roll < 0.8) {
      state = 'pause'; stateUntil = now + 1800 + Math.random() * 2200;
    } else {
      state = 'wander'; stateUntil = now + 2500 + Math.random() * 3500;
    }
    behaviorTimer = setTimeout(pickBehavior, stateUntil - now);
  }

  function doHonk() {
    if (!gooseEl) return;
    gooseEl.classList.add('honking');
    bubbleEl.classList.add('show');
    setTimeout(() => {
      gooseEl?.classList.remove('honking');
      bubbleEl?.classList.remove('show');
    }, 1400);
  }

  /** Nudge a nearby visible element a few pixels, then revert it. Fully reversible. */
  function doNudge() {
    const gx = x + 60; // goose centre
    const candidates = [...document.querySelectorAll('p, span, a, button, img, h1, h2, h3, li')]
      .filter((el) => {
        if (nudged.has(el)) return false;
        const r = el.getBoundingClientRect();
        return r.width > 8 && r.width < 400 && r.height > 8 && r.height < 200 &&
               r.bottom > innerHeight - 320 && Math.abs(r.left + r.width / 2 - gx) < 260;
      });
    if (!candidates.length) return;
    const el = candidates[Math.floor(Math.random() * candidates.length)];
    nudged.set(el, el.style.transform);
    el.style.transition = 'transform 0.25s ease';
    const dx = (Math.random() < 0.5 ? -1 : 1) * (6 + Math.random() * 8);
    el.style.transform = `translateX(${dx.toFixed(1)}px)`;
    setTimeout(() => {
      const orig = nudged.get(el);
      if (orig !== undefined) {
        try { el.style.transform = orig; } catch { /* gone */ }
        nudged.delete(el);
      }
    }, 2600);
  }

  /* ---------- Animation loop ---------- */
  let last = 0;
  function loop(now) {
    rafId = requestAnimationFrame(loop);
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    if (!gooseEl) return;

    const maxX = Math.max(innerWidth - 130, 40);
    const moving = !reducedMotion && (state === 'wander' || state === 'chase');

    if (moving) {
      if (state === 'chase' && chaseTargetX !== null) {
        const target = Math.min(Math.max(chaseTargetX - 60, 0), maxX);
        const d = target - x;
        dir = d >= 0 ? 1 : -1;
        x += Math.sign(d) * Math.min(Math.abs(d), 340 * dt);
      } else {
        x += dir * (reducedMotion ? 0 : 130) * dt;
        if (x >= maxX) { x = maxX; dir = -1; }
        if (x <= 0) { x = 0; dir = 1; }
      }
    }
    gooseEl.style.transform = `translateX(${x.toFixed(1)}px)`;
    gooseEl.classList.toggle('flip', dir < 0);
    gooseEl.classList.toggle('waddling', moving);
    gooseEl.classList.toggle('sitting', state === 'pause');
  }

  function onMouse(e) { mouseX = e.clientX; }

  /* ---------- Start ---------- */
  async function start() {
    const stored = (await chrome.storage.local.get('goose')).goose;
    settings = { ...DEFAULTS, ...(stored || {}) };
    if (!settings.enabled) return;
    build();
    document.addEventListener('mousemove', onMouse, { passive: true });
    state = 'wander';
    stateUntil = performance.now() + 2000;
    behaviorTimer = setTimeout(pickBehavior, 2000);
    last = performance.now();
    rafId = requestAnimationFrame(loop);
  }

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg?.type === 'goose-dismiss') teardown();
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.goose) {
      const next = { ...DEFAULTS, ...changes.goose.newValue };
      const wasEnabled = settings.enabled;
      settings = next;
      if (wasEnabled && !next.enabled) teardown();
      if (!wasEnabled && next.enabled && !host) start();
    }
  });

  start();
})();
