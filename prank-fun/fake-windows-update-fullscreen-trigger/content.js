// content.js — FakeUpdate prank overlay. Injected on demand, idempotent.
// Deliberately cartoonish: playful colors, emoji-free glyphs, silly messages,
// and a giant always-visible "THIS IS A PRANK" banner. Never a real system screen.
"use strict";

(() => {
  if (window.__fakeUpdateInstalled) return;
  window.__fakeUpdateInstalled = true;

  const ID = "fake-update-prank-overlay";

  // Comedic status lines the fake updater cycles through.
  const MESSAGES = [
    "Downloading more RAM…",
    "Polishing the pixels…",
    "Teaching ducks to type…",
    "Untangling the internet cables…",
    "Bribing the progress bar…",
    "Defragmenting your patience…",
    "Charging the flux capacitor…",
    "Retrying… again…",
    "Almost there (not really)…",
  ];

  let tickTimer = null;
  let progress = 0;
  let msgIndex = 0;

  function buildOverlay() {
    const host = document.createElement("div");
    host.id = ID;

    // Shadow DOM so the page's CSS can't interfere with the prank.
    const shadow = host.attachShadow({ mode: "open" });
    const style = document.createElement("style");
    style.textContent = `
      :host { all: initial; }
      .screen {
        position: fixed; inset: 0; z-index: 2147483647;
        background: linear-gradient(160deg, #1e3a8a 0%, #2563eb 55%, #7c3aed 100%);
        display: flex; flex-direction: column; align-items: center; justify-content: center;
        gap: 22px; padding: 32px; text-align: center;
        font-family: "Comic Sans MS", "Chalkboard SE", "Segoe UI", sans-serif;
        color: #fff; cursor: default; user-select: none;
      }
      .prank-banner {
        background: #fbbf24; color: #1c1005;
        font-weight: 800; font-size: 22px; letter-spacing: .04em;
        padding: 14px 26px; border-radius: 14px;
        border: 4px dashed #1c1005;
        box-shadow: 0 8px 24px rgba(0,0,0,.35);
      }
      .spinner {
        width: 64px; height: 64px; border-radius: 50%;
        border: 7px dotted rgba(255,255,255,.9);
        animation: spin 1.2s linear infinite;
      }
      @keyframes spin { to { transform: rotate(360deg); } }
      h1 { font-size: 30px; margin: 0; font-weight: 700; }
      .msg { font-size: 17px; opacity: .95; min-height: 26px; }
      .bar-wrap {
        width: min(420px, 80vw); height: 26px;
        background: rgba(255,255,255,.18); border-radius: 999px;
        border: 2px solid rgba(255,255,255,.5); overflow: hidden;
      }
      .bar {
        height: 100%; width: 0%;
        background: repeating-linear-gradient(45deg, #fbbf24, #fbbf24 14px, #f59e0b 14px, #f59e0b 28px);
        transition: width .18s linear;
      }
      .pct { font-size: 15px; font-weight: 700; }
      .exit {
        margin-top: 6px; font-size: 16px; font-weight: 700;
        background: #fff; color: #1e3a8a; border: none; border-radius: 999px;
        padding: 14px 34px; cursor: pointer;
        box-shadow: 0 6px 18px rgba(0,0,0,.35);
      }
      .exit:hover { transform: scale(1.04); }
      .esc-hint { font-size: 13px; opacity: .85; }
      .esc-hint kbd {
        background: rgba(255,255,255,.2); border: 1px solid rgba(255,255,255,.5);
        border-radius: 6px; padding: 1px 8px; font-family: inherit;
      }
    `;
    shadow.appendChild(style);

    const screen = document.createElement("div");
    screen.className = "screen";

    const banner = document.createElement("div");
    banner.className = "prank-banner";
    banner.textContent = "THIS IS A PRANK — nothing is updating";

    const spinner = document.createElement("div");
    spinner.className = "spinner";

    const title = document.createElement("h1");
    title.textContent = "Totally Real Update in Progress";

    const msg = document.createElement("div");
    msg.className = "msg";
    msg.textContent = MESSAGES[0];

    const barWrap = document.createElement("div");
    barWrap.className = "bar-wrap";
    const bar = document.createElement("div");
    bar.className = "bar";
    barWrap.appendChild(bar);

    const pct = document.createElement("div");
    pct.className = "pct";
    pct.textContent = "0%";

    const exit = document.createElement("button");
    exit.className = "exit";
    exit.textContent = "Exit prank (it's a joke!)";
    exit.addEventListener("click", hide);

    const escHint = document.createElement("div");
    escHint.className = "esc-hint";
    const kbd = document.createElement("kbd");
    kbd.textContent = "Esc";
    escHint.append("Press ", kbd, " anytime to exit instantly");

    screen.append(banner, spinner, title, msg, barWrap, pct, exit, escHint);
    shadow.appendChild(screen);

    // Esc always exits — listener lives on the host page (outside the shadow root).
    function onKey(e) {
      if (e.key === "Escape") hide();
    }

    function hide() {
      stopTicking();
      host.remove();
      document.removeEventListener("keydown", onKey, true);
    }

    function tick() {
      // Progress climbs, then comically resets to ~10% with a new silly message.
      progress += 3 + Math.random() * 9;
      if (progress >= 100) {
        progress = 8 + Math.random() * 10;
        msgIndex = (msgIndex + 1) % MESSAGES.length;
        msg.textContent = MESSAGES[msgIndex];
      }
      const shown = Math.floor(progress);
      bar.style.width = shown + "%";
      pct.textContent = shown + "%";
    }

    function stopTicking() {
      if (tickTimer !== null) { clearInterval(tickTimer); tickTimer = null; }
    }

    document.addEventListener("keydown", onKey, true);
    host._fuHide = hide;
    host._fuTick = () => { stopTicking(); tickTimer = setInterval(tick, 200); tick(); };

    document.documentElement.appendChild(host);
    return host;
  }

  function show() {
    let host = document.getElementById(ID);
    if (!host) host = buildOverlay();
    host._fuTick();
  }

  function hide() {
    const host = document.getElementById(ID);
    if (host && host._fuHide) host._fuHide();
  }

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.type === "fu-show") { show(); sendResponse({ ok: true }); }
    else if (msg.type === "fu-hide") { hide(); sendResponse({ ok: true }); }
    return true;
  });
})();
