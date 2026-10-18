// SubOverlay content script — renders user-provided SRT cues over page videos.
// Injected on demand via chrome.scripting only; never runs automatically.
'use strict';

(() => {
  if (window.__subOverlayInstalled) return;
  window.__subOverlayInstalled = true;

  let cues = [];
  let settings = { enabled: true, offsetMs: 0, fontSize: 24, bgOpacity: 60 };
  const watched = new WeakSet();

  /** Build the caption layer for a video element. */
  function attach(video) {
    if (watched.has(video)) return;
    watched.add(video);
    const wrap = document.createElement('div');
    wrap.className = '__suboverlay-wrap';
    wrap.setAttribute('aria-hidden', 'true');
    const cap = document.createElement('div');
    cap.className = '__suboverlay-cap';
    wrap.appendChild(cap);

    // Position over the video: wrap in a relative container if needed.
    const parent = video.parentElement || document.body;
    const pos = getComputedStyle(parent).position;
    if (pos === 'static') parent.style.position = 'relative';
    parent.appendChild(wrap);

    const sync = () => position(wrap, video);
    sync();
    new ResizeObserver(sync).observe(video);
    window.addEventListener('resize', sync);

    video.addEventListener('timeupdate', () => render(video, cap));
    video.addEventListener('seeked', () => render(video, cap));
  }

  /** Place the overlay exactly over the video's on-screen box. */
  function position(wrap, video) {
    const r = video.getBoundingClientRect();
    const pr = (video.parentElement || document.body).getBoundingClientRect();
    Object.assign(wrap.style, {
      position: 'absolute',
      left: (r.left - pr.left) + 'px',
      top: (r.top - pr.top + window.scrollY * 0) + 'px',
      width: r.width + 'px',
      height: r.height + 'px',
      pointerEvents: 'none',
      zIndex: 2147483647
    });
  }

  /** Pick the active cue for the video's current time (with user offset). */
  function activeCue(t) {
    const adj = t * 1000 + settings.offsetMs;
    for (const c of cues) {
      if (adj >= c.start && adj <= c.end) return c;
      if (c.start > adj) break;
    }
    return null;
  }

  function render(video, cap) {
    if (!settings.enabled || !cues.length) {
      cap.textContent = '';
      cap.style.display = 'none';
      return;
    }
    const cue = activeCue(video.currentTime);
    if (cue) {
      if (cap.textContent !== cue.text) cap.textContent = cue.text;
      cap.style.display = 'block';
      cap.style.fontSize = settings.fontSize + 'px';
      cap.style.background = `rgba(0,0,0,${settings.bgOpacity / 100})`;
    } else {
      cap.style.display = 'none';
    }
  }

  // Base styles injected once.
  const style = document.createElement('style');
  style.textContent = `
    .__suboverlay-cap {
      position: absolute; left: 50%; bottom: 8%;
      transform: translateX(-50%);
      max-width: 88%;
      color: #fff; font-weight: 600; text-align: center;
      padding: 6px 14px; border-radius: 8px;
      line-height: 1.4; white-space: pre-line;
    }`;
  document.documentElement.appendChild(style);

  function scan() {
    document.querySelectorAll('video').forEach(attach);
  }
  new MutationObserver(scan).observe(document.documentElement, { childList: true, subtree: true });
  scan();

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'SUBOVERLAY_UPDATE') {
      cues = msg.cues || [];
      settings = { ...settings, ...(msg.settings || {}) };
      document.querySelectorAll('video').forEach(v => {
        const wrap = v.parentElement && v.parentElement.querySelector(':scope > .__suboverlay-wrap .__suboverlay-cap');
        if (wrap) render(v, wrap);
      });
    }
  });
})();
