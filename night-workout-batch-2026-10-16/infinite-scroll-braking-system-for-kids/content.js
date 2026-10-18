// BrakeTime content script — gentle scroll brakes.
// Tracks accumulated scroll distance; when the parent-set threshold is hit,
// shows a friendly pause overlay with a countdown. Also counts session time.
// Fully local: stats are written to chrome.storage.local only. Nothing blocked.

(() => {
  if (window.__braketimeInstalled) return;
  window.__braketimeInstalled = true;

  const DEFAULTS = { brakePx: 15000, brakeSec: 8, sessionMin: 30 };
  let cfg = { ...DEFAULTS };
  let accPx = 0;          // scroll distance since last brake
  let lastY = window.scrollY;
  let braking = false;
  let sessionStart = Date.now();
  let sessionNotified = false;
  const NS = "braketime";

  // ---------- styles ----------
  const style = document.createElement("style");
  style.textContent = `
    .${NS}-overlay { position: fixed; inset: 0; z-index: 2147483647;
      display: flex; align-items: center; justify-content: center;
      background: rgba(10,10,14,.82); backdrop-filter: blur(10px);
      font-family: -apple-system, "Segoe UI", Roboto, sans-serif; }
    .${NS}-card { background: rgba(20,20,26,.9); border: 1px solid rgba(245,158,11,.4);
      border-radius: 18px; padding: 28px 34px; text-align: center; color: #f3f4f6;
      max-width: 340px; box-shadow: 0 20px 60px rgba(0,0,0,.5); }
    .${NS}-card h2 { margin: 0 0 8px; font-size: 20px; color: #f59e0b; }
    .${NS}-card p { margin: 6px 0; color: #9ca3af; font-size: 13px; }
    .${NS}-count { font-size: 34px; font-weight: 800; color: #f59e0b; margin: 10px 0; }
    .${NS}-btn { margin-top: 12px; padding: 10px 22px; border-radius: 10px; border: none;
      background: #f59e0b; color: #1a1206; font-weight: 700; font-size: 14px; cursor: pointer; }
    .${NS}-btn:disabled { opacity: .4; cursor: default; }
    .${NS}-hud { position: fixed; right: 12px; bottom: 12px; z-index: 2147483646;
      background: rgba(20,20,26,.85); border: 1px solid rgba(255,255,255,.1);
      color: #f3f4f6; font: 11px -apple-system, "Segoe UI", Roboto, sans-serif;
      border-radius: 10px; padding: 6px 10px; pointer-events: none; }`;
  document.documentElement.appendChild(style);

  // ---------- tiny HUD ----------
  const hud = document.createElement("div");
  hud.className = `${NS}-hud`;
  hud.style.display = "none";
  document.documentElement.appendChild(hud);

  function todayKey() { return new Date().toISOString().slice(0, 10); }

  async function bumpStats(px, brake) {
    const { stats = { scrollPx: 0, brakes: 0, sessionSec: 0, day: null } } =
      await chrome.storage.local.get("stats");
    const day = todayKey();
    const s = stats.day === day ? stats : { scrollPx: 0, brakes: 0, sessionSec: 0, day };
    s.scrollPx += px;
    if (brake) s.brakes += 1;
    await chrome.storage.local.set({ stats: s });
  }

  // ---------- brake overlay ----------
  function showBrake() {
    braking = true;
    bumpStats(0, true);
    const overlay = document.createElement("div");
    overlay.className = `${NS}-overlay`;
    let left = cfg.brakeSec;
    overlay.innerHTML = `
      <div class="${NS}-card">
        <h2>Take a breath</h2>
        <p>You've scrolled a lot! Stretch, blink, look around the room.</p>
        <div class="${NS}-count">${left}</div>
        <p>Scrolling continues in a moment — nothing is blocked.</p>
        <button class="${NS}-btn" disabled>Keep scrolling</button>
      </div>`;
    const btn = overlay.querySelector("button");
    const count = overlay.querySelector(`.${NS}-count`);
    document.documentElement.appendChild(overlay);
    const tick = setInterval(() => {
      left -= 1;
      count.textContent = left;
      if (left <= 0) {
        clearInterval(tick);
        btn.disabled = false;
        btn.textContent = "Keep scrolling";
        btn.addEventListener("click", () => {
          overlay.remove();
          braking = false;
          accPx = 0;
        }, { once: true });
      }
    }, 1000);
  }

  // ---------- session reminder ----------
  function checkSession() {
    if (!cfg.sessionMin || sessionNotified) return;
    const mins = (Date.now() - sessionStart) / 60000;
    if (mins >= cfg.sessionMin) {
      sessionNotified = true;
      hud.textContent = `BrakeTime: ${Math.round(mins)} min on this site — maybe a break?`;
      hud.style.display = "block";
      setTimeout(() => { hud.style.display = "none"; }, 15000);
    }
  }

  // ---------- scroll tracking ----------
  let lastBump = Date.now();
  window.addEventListener("scroll", () => {
    if (braking) return;
    const y = window.scrollY;
    accPx += Math.abs(y - lastY);
    lastY = y;
    // periodic stat flush + session check (cheap, throttled)
    const now = Date.now();
    if (now - lastBump > 5000) {
      bumpStats(accPx, false);
      accPx = Math.min(accPx, cfg.brakePx); // keep counting toward brake
      lastBump = now;
      checkSession();
    }
    if (accPx >= cfg.brakePx) showBrake();
  }, { passive: true });

  // flush remaining stats when leaving
  window.addEventListener("pagehide", () => {
    const mins = Math.round((Date.now() - sessionStart) / 60000);
    chrome.storage.local.get("stats").then(({ stats }) => {
      if (!stats) return;
      stats.sessionSec = (stats.sessionSec || 0) + (Date.now() - sessionStart) / 1000;
      chrome.storage.local.set({ stats });
    });
  });

  // ---------- load config ----------
  chrome.storage.local.get(DEFAULTS).then((s) => { cfg = { ...DEFAULTS, ...s }; });
})();
