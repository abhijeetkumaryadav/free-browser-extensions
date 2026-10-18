/* StripFlow content script — injected on demand via scripting.executeScript.
 * Self-contained: guarded against double-injection, communicates only
 * through chrome.runtime.onMessage. Only scrolls the page; it never
 * modifies DOM content. */
(function () {
  if (window.__stripFlow) return; // already injected

  const state = {
    running: false,
    speed: 60,          // px per second
    pauseOnUser: true,
    stopAtBottom: true,
    userPausedUntil: 0, // timestamp
  };

  let rafId = null;
  let lastT = 0;

  function atBottom() {
    const el = document.scrollingElement || document.documentElement;
    return el.scrollTop + window.innerHeight >= el.scrollHeight - 2;
  }

  function tick(t) {
    if (!state.running) { rafId = null; return; }
    const dt = Math.min(0.1, (t - lastT) / 1000 || 0.016);
    lastT = t;
    if (Date.now() >= state.userPausedUntil) {
      window.scrollBy(0, state.speed * dt);
    }
    if (state.stopAtBottom && atBottom()) {
      stop();
      return;
    }
    rafId = requestAnimationFrame(tick);
  }

  function start() {
    if (state.running) return;
    state.running = true;
    state.userPausedUntil = 0;
    lastT = performance.now();
    rafId = requestAnimationFrame(tick);
  }

  function stop() {
    state.running = false;
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
  }

  // Yield to the user's own scrolling: pause auto-scroll briefly.
  function onUserScroll() {
    if (!state.running || !state.pauseOnUser) return;
    state.userPausedUntil = Date.now() + 2000;
  }
  window.addEventListener("wheel", onUserScroll, { passive: true });
  window.addEventListener("touchmove", onUserScroll, { passive: true });

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (!msg || msg.target !== "stripflow") return false;
    switch (msg.action) {
      case "start":
        state.speed = msg.speed ?? state.speed;
        state.pauseOnUser = msg.pauseOnUser ?? state.pauseOnUser;
        state.stopAtBottom = msg.stopAtBottom ?? state.stopAtBottom;
        start();
        break;
      case "stop":
        stop();
        break;
      case "setSpeed":
        state.speed = msg.speed;
        break;
      case "setOptions":
        state.pauseOnUser = msg.pauseOnUser ?? state.pauseOnUser;
        state.stopAtBottom = msg.stopAtBottom ?? state.stopAtBottom;
        break;
      case "toTop":
        window.scrollTo({ top: 0, behavior: "smooth" });
        break;
      case "toBottom":
        window.scrollTo({ top: document.scrollingElement.scrollHeight, behavior: "smooth" });
        break;
      case "getState":
        sendResponse({ running: state.running, speed: state.speed });
        return true;
    }
    sendResponse({ running: state.running, speed: state.speed });
    return true;
  });

  window.__stripFlow = true;
})();
