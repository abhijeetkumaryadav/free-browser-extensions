/* Typing Speed Test Overlay — injected content script
 * Boot-once: creates a full-viewport game overlay, runs a 60s typing test,
 * then removes every trace. The page DOM is never modified.
 */
(() => {
  // -------------------------------------------------------------------------
  // Boot-once guard + global remove hook (used by background re-injection)
  // -------------------------------------------------------------------------
  if (window.__tstBooted) {
    window.__tstRemove && window.__tstRemove();
  }
  window.__tstBooted = true;

  const ACCENT = "#22d3ee";
  const BG = "rgba(11,13,18,0.94)";
  const INK = "#eaf4f7";
  const DIM = "#9aa3b2";
  const TILE = "rgba(255,255,255,0.06)";
  const BORDER = "rgba(255,255,255,0.12)";
  const GOOD = "#4ade80";
  const BAD = "#f87171";

  let root = null;        // overlay container
  let styleEl = null;     // injected <style>
  let listeners = [];     // [target, type, fn] for cleanup
  let timerId = null;
  let rafId = null;

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------
  function on(target, type, fn, opts) {
    target.addEventListener(type, fn, opts);
    listeners.push([target, type, fn, opts]);
  }

  function removeAll() {
    listeners.forEach(([t, type, fn, opts]) => t.removeEventListener(type, fn, opts));
    listeners = [];
    clearInterval(timerId); timerId = null;
    cancelAnimationFrame(rafId); rafId = null;
    if (root && root.parentNode) root.parentNode.removeChild(root);
    if (styleEl && styleEl.parentNode) styleEl.parentNode.removeChild(styleEl);
    root = null; styleEl = null;
    window.__tstBooted = false;
    window.__tstRemove = null;
  }
  window.__tstRemove = removeAll;

  // Persist a finished result straight to extension storage (popup may be closed)
  function saveResult({ wpm, acc, consistency, difficulty, title }) {
    try {
      chrome.storage.local.get({ tst_history: [] }, (res) => {
        const history = res.tst_history || [];
        history.unshift({ wpm, acc, consistency, difficulty, title, at: Date.now() });
        chrome.storage.local.set({ tst_history: history.slice(0, 50) });
      });
    } catch { /* storage unavailable */ }
  }

  // -------------------------------------------------------------------------
  // Overlay shell
  // -------------------------------------------------------------------------
  function buildShell(title) {
    styleEl = document.createElement("style");
    styleEl.textContent = `
      #__tst-overlay * { box-sizing: border-box; }
      #__tst-overlay {
        position: fixed; inset: 0; z-index: 2147483647;
        background: ${BG};
        backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
        display: flex; align-items: center; justify-content: center;
        font-family: "Inter", system-ui, sans-serif; color: ${INK};
      }
      .__tst-card {
        width: min(680px, 92vw); max-height: 90vh; overflow-y: auto;
        background: rgba(20,22,28,0.9); border: 1px solid ${BORDER};
        border-radius: 18px; padding: 28px;
      }
      .__tst-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; }
      .__tst-title { font-size: 16px; font-weight: 700; }
      .__tst-close {
        background: ${TILE}; border: 1px solid ${BORDER}; color: ${DIM};
        width: 34px; height: 34px; border-radius: 10px; cursor: pointer; font-size: 16px;
      }
      .__tst-close:hover { color: ${INK}; }
      .__tst-hud { display: flex; gap: 10px; margin-bottom: 14px; }
      .__tst-metric { flex: 1; background: ${TILE}; border: 1px solid ${BORDER};
        border-radius: 12px; padding: 8px; text-align: center; }
      .__tst-metric .v { font-size: 20px; font-weight: 800; color: ${ACCENT}; }
      .__tst-metric .l { font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: ${DIM}; }
      .__tst-timerbar { height: 6px; background: ${TILE}; border-radius: 3px; overflow: hidden; margin-bottom: 16px; }
      .__tst-timerfill { height: 100%; width: 100%; background: ${ACCENT}; transition: width 0.2s linear; }
      .__tst-passage {
        font-size: 19px; line-height: 1.9; letter-spacing: 0.4px;
        background: ${TILE}; border: 1px solid ${BORDER};
        border-radius: 14px; padding: 18px; margin-bottom: 16px;
        font-family: "SFMono-Regular", Consolas, monospace;
      }
      .__tst-passage .ch { border-radius: 3px; }
      .__tst-passage .ch.ok { color: ${GOOD}; }
      .__tst-passage .ch.bad { color: ${BAD}; background: rgba(248,113,113,0.15); }
      .__tst-passage .ch.cur { border-bottom: 2px solid ${ACCENT}; animation: __tst-blink 1s infinite; }
      @keyframes __tst-blink { 50% { border-bottom-color: transparent; } }
      .__tst-input {
        width: 100%; padding: 12px 14px; font-size: 15px;
        background: ${TILE}; border: 1px solid ${BORDER}; border-radius: 12px; color: ${INK};
        outline: none;
      }
      .__tst-input:focus { border-color: ${ACCENT}; }
      .__tst-hint { margin-top: 10px; font-size: 12px; color: ${DIM}; text-align: center; }
      .__tst-results { text-align: center; }
      .__tst-big { font-size: 44px; font-weight: 800; color: ${ACCENT}; }
      .__tst-row { display: flex; gap: 10px; margin: 16px 0; }
      .__tst-newbest { color: ${GOOD}; font-weight: 700; margin: 8px 0; min-height: 20px; }
      .__tst-btn {
        background: ${ACCENT}; color: #06222b; border: none; border-radius: 10px;
        padding: 12px 18px; font-size: 14px; font-weight: 700; cursor: pointer; flex: 1;
      }
      .__tst-btn.ghost { background: ${TILE}; color: ${INK}; border: 1px solid ${BORDER}; }
    `;
    document.documentElement.appendChild(styleEl);

    root = document.createElement("div");
    root.id = "__tst-overlay";
    root.innerHTML = `
      <div class="__tst-card">
        <div class="__tst-head">
          <div class="__tst-title">⌨️ ${title}</div>
          <button class="__tst-close" title="Close (Esc)">✕</button>
        </div>
        <div class="__tst-hud">
          <div class="__tst-metric"><div class="v" data-m="time">60</div><div class="l">Seconds</div></div>
          <div class="__tst-metric"><div class="v" data-m="wpm">0</div><div class="l">WPM</div></div>
          <div class="__tst-metric"><div class="v" data-m="acc">100%</div><div class="l">Accuracy</div></div>
        </div>
        <div class="__tst-timerbar"><div class="__tst-timerfill" data-fill></div></div>
        <div class="__tst-passage" data-passage></div>
        <input class="__tst-input" data-input placeholder="Click here and start typing…" autocomplete="off" autocapitalize="off" spellcheck="false">
        <div class="__tst-hint">Press Esc anytime to close — the page is untouched.</div>
      </div>`;
    document.documentElement.appendChild(root);

    root.querySelector(".__tst-close").addEventListener("click", removeAll);
  }

  // -------------------------------------------------------------------------
  // Game
  // -------------------------------------------------------------------------
  function beginTest({ text, title, difficulty, durationMs }) {
    buildShell(title);
    const passageEl = root.querySelector("[data-passage]");
    const inputEl = root.querySelector("[data-input]");
    const metricEls = {
      time: root.querySelector('[data-m="time"]'),
      wpm: root.querySelector('[data-m="wpm"]'),
      acc: root.querySelector('[data-m="acc"]'),
      fill: root.querySelector("[data-fill]"),
    };

    // Render passage as per-character spans
    const chars = text.split("");
    const spans = chars.map((c) => {
      const s = document.createElement("span");
      s.className = "ch";
      s.textContent = c;
      passageEl.appendChild(s);
      return s;
    });

    let typed = "";          // raw typed characters
    let started = false;
    let startTime = 0;
    let elapsed = 0;
    let correct = 0;
    let keystrokes = 0;
    let wpmSamples = [];     // per-second WPM for consistency
    let finished = false;

    function setCursor(i) {
      spans.forEach((s) => s.classList.remove("cur"));
      if (i < spans.length) spans[i].classList.add("cur");
    }
    setCursor(0);

    function updateMetrics() {
      const minutes = elapsed / 60000;
      const wpm = minutes > 0 ? (correct / 5) / minutes : 0;
      const acc = keystrokes > 0 ? (correct / keystrokes) * 100 : 100;
      metricEls.wpm.textContent = wpm.toFixed(0);
      metricEls.acc.textContent = acc.toFixed(1) + "%";
      const remain = Math.max(0, Math.ceil((durationMs - elapsed) / 1000));
      metricEls.time.textContent = remain;
      metricEls.fill.style.width = (100 * (1 - elapsed / durationMs)) + "%";
      return { wpm, acc };
    }

    function finish() {
      if (finished) return;
      finished = true;
      clearInterval(timerId); timerId = null;
      cancelAnimationFrame(rafId); rafId = null;
      const { wpm, acc } = updateMetrics();
      // Consistency = 100 - coefficient of variation of per-second WPM
      let consistency = 100;
      if (wpmSamples.length > 1) {
        const mean = wpmSamples.reduce((a, b) => a + b, 0) / wpmSamples.length;
        const sd = Math.sqrt(wpmSamples.reduce((a, b) => a + (b - mean) ** 2, 0) / wpmSamples.length);
        consistency = mean > 0 ? Math.max(0, 100 - (sd / mean) * 100) : 100;
      }
      saveResult({ wpm, acc, consistency, difficulty, title });
      showResults(wpm, acc, consistency, difficulty);
    }

    function showResults(wpm, acc, consistency, difficulty) {
      const card = root.querySelector(".__tst-card");
      card.innerHTML = `
        <div class="__tst-results">
          <div class="__tst-title" style="margin-bottom:8px">Test complete — ${title}</div>
          <div class="__tst-big">${wpm.toFixed(0)} <span style="font-size:18px">WPM</span></div>
          <div class="__tst-newbest" data-newbest></div>
          <div class="__tst-hud" style="margin-top:12px">
            <div class="__tst-metric"><div class="v">${acc.toFixed(1)}%</div><div class="l">Accuracy</div></div>
            <div class="__tst-metric"><div class="v">${consistency.toFixed(0)}%</div><div class="l">Consistency</div></div>
            <div class="__tst-metric"><div class="v">${difficulty}</div><div class="l">Difficulty</div></div>
          </div>
          <div class="__tst-row">
            <button class="__tst-btn" data-again>Play again</button>
            <button class="__tst-btn ghost" data-close>Close (Esc)</button>
          </div>
        </div>`;
      // New-best check
      try {
        chrome.storage.local.get({ tst_history: [] }, (res) => {
          const hist = (res.tst_history || []).slice(1); // exclude the one just saved
          const prevBest = hist.length ? Math.max(...hist.map((h) => h.wpm)) : 0;
          if (wpm > prevBest) {
            const el = card.querySelector("[data-newbest]");
            if (el) el.textContent = "🏆 New best score!";
          }
        });
      } catch { /* ignore */ }
      card.querySelector("[data-close]").addEventListener("click", removeAll);
      card.querySelector("[data-again]").addEventListener("click", () => {
        removeAll();
        chrome.runtime.sendMessage({ type: "start-test", text, title, difficulty }).catch(() => {});
      });
    }

    // Timer tick
    timerId = setInterval(() => {
      if (!started || finished) return;
      elapsed = Date.now() - startTime;
      if (elapsed >= durationMs) { finish(); return; }
      updateMetrics();
      // sample per-second WPM
      const sec = Math.floor(elapsed / 1000);
      if (sec > 0 && (wpmSamples.length < sec)) {
        wpmSamples.push((correct / 5) / (elapsed / 60000));
      }
    }, 100);

    // Keep cursor blinking even before typing starts
    (function tick() {
      if (finished || !root) return;
      rafId = requestAnimationFrame(tick);
    })();

    // Typing input
    on(inputEl, "input", () => {
      const value = inputEl.value;
      const prev = typed;
      typed = value;

      if (!started && value.length > 0) {
        started = true;
        startTime = Date.now();
        inputEl.placeholder = "";
      }
      if (!started) return;

      // Only support typing forward and single-char backspace (no paste)
      if (value.length > prev.length + 1) {
        inputEl.value = prev; typed = prev;
        return;
      }

      const i = value.length;
      keystrokes = Math.max(keystrokes, 0);
      // Recompute all spans (simple + robust for 60s tests)
      correct = 0; keystrokes = 0;
      for (let k = 0; k < spans.length; k++) {
        spans[k].classList.remove("ok", "bad");
        if (k < value.length) {
          keystrokes++;
          if (value[k] === chars[k]) { spans[k].classList.add("ok"); correct++; }
          else spans[k].classList.add("bad");
        }
      }
      setCursor(i);
      elapsed = Date.now() - startTime;
      updateMetrics();

      // Finished the passage early
      if (value.length >= chars.length) finish();
    });

    on(inputEl, "keydown", (e) => {
      if (e.key === "Escape") { e.preventDefault(); removeAll(); }
      e.stopPropagation(); // don't let the page steal typing keys
    });
    on(document, "keydown", (e) => {
      if (e.key === "Escape") removeAll();
    }, true);

    inputEl.focus();
  }

  // -------------------------------------------------------------------------
  // Message entry point (from background worker)
  // -------------------------------------------------------------------------
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg && msg.type === "tst-begin") {
      removeAll(); // clear any stale overlay
      beginTest(msg);
    }
  });
})();
