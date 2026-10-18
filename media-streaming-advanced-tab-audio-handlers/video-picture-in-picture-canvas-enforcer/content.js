// PiP Canvas — content script (ISOLATED world).
// Injects a small floating "PiP" button onto every sufficiently large <video>.
// Only active when the user enables it in the popup (chrome.storage.local.floatBtn).
// Never reads video content, credentials, or keystrokes — it only calls
// requestPictureInPicture() on a user click.

const BTN_ID = "pip-canvas-float-btn";
const PROCESSED = new WeakSet();

function floatEnabled(cb) {
  chrome.storage.local.get({ floatBtn: false }, (res) => cb(!!res.floatBtn));
}

function makeButton(video) {
  const btn = document.createElement("button");
  btn.id = BTN_ID + "-" + Math.random().toString(36).slice(2);
  btn.type = "button";
  btn.textContent = "PiP";
  btn.title = "Open in picture-in-picture";
  Object.assign(btn.style, {
    position: "absolute",
    zIndex: "2147483647",
    padding: "4px 10px",
    fontSize: "11px",
    fontWeight: "700",
    fontFamily: "system-ui, sans-serif",
    color: "#052e1f",
    background: "#10b981",
    border: "none",
    borderRadius: "999px",
    cursor: "pointer",
    boxShadow: "0 2px 10px rgba(0,0,0,.45)",
    opacity: "0",
    transition: "opacity .15s ease",
    pointerEvents: "auto",
  });

  // Position the button at the video's top-right corner.
  const place = () => {
    const r = video.getBoundingClientRect();
    btn.style.top = `${window.scrollY + r.top + 8}px`;
    btn.style.left = `${window.scrollX + r.right - 62}px`;
  };
  place();

  const show = () => (btn.style.opacity = "1");
  const hide = () => (btn.style.opacity = "0");
  video.addEventListener("mouseenter", show);
  video.addEventListener("mouseleave", () => setTimeout(hide, 400));
  btn.addEventListener("mouseenter", show);
  btn.addEventListener("mouseleave", hide);
  window.addEventListener("scroll", place, { passive: true });
  window.addEventListener("resize", place);

  btn.addEventListener("click", async (e) => {
    e.stopPropagation();
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      }
      await video.requestPictureInPicture();
    } catch (err) {
      btn.textContent = "Blocked";
      setTimeout(() => (btn.textContent = "PiP"), 1800);
    }
  });

  document.documentElement.appendChild(btn);
}

function enhance(video) {
  if (PROCESSED.has(video)) return;
  PROCESSED.add(video);
  // Skip tiny decorative videos.
  const r = video.getBoundingClientRect();
  if (r.width < 120 || r.height < 90) return;
  if (video.hasAttribute("disablepictureinpicture")) return;
  makeButton(video);
}

function scan() {
  floatEnabled((on) => {
    if (!on) return;
    document.querySelectorAll("video").forEach(enhance);
  });
}

// Watch for videos added dynamically (single-page apps).
const observer = new MutationObserver((mutations) => {
  for (const m of mutations) {
    for (const n of m.addedNodes) {
      if (n.nodeType !== 1) continue;
      if (n.tagName === "VIDEO") enhance(n);
      else n.querySelectorAll?.("video").forEach(enhance);
    }
  }
});

floatEnabled((on) => {
  if (!on) return;
  scan();
  observer.observe(document.documentElement, { childList: true, subtree: true });
});

// React to the toggle being flipped while pages are open.
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.floatBtn) {
    if (changes.floatBtn.newValue) {
      scan();
      observer.observe(document.documentElement, { childList: true, subtree: true });
    } else {
      observer.disconnect();
      document.querySelectorAll('[id^="' + BTN_ID + '"]').forEach((b) => b.remove());
    }
  }
});
