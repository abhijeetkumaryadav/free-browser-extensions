// Unsubscribed Domain Warner — content script.
// Checks the current domain against the on-device blocklist and, on a hit,
// injects a dismissible warning banner. Non-destructive: it never blocks,
// redirects, or alters page content — it only adds a banner overlay.

(async function () {
  try {
    const host = location.hostname.replace(/^www\./, "").toLowerCase();
    const { blocklist = [], enabled = true } = await chrome.storage.local.get(["blocklist", "enabled"]);
    if (!enabled) return;
    const hit = blocklist.find((d) => host === d || host.endsWith("." + d));
    if (!hit) return;
    // Dismissed earlier this tab session? Stay quiet.
    try {
      if (sessionStorage.getItem("udw-dismissed:" + hit)) return;
    } catch (e) {}

    // Tell the service worker to badge the toolbar icon.
    chrome.runtime.sendMessage({ type: "udw-warn", domain: hit });

    // Build the banner inside a shadow root so page CSS can't break it.
    const mount = document.createElement("div");
    mount.id = "udw-banner-mount";
    const shadow = mount.attachShadow({ mode: "open" });
    const style = document.createElement("style");
    style.textContent = `
      .bar { position: fixed; top: 0; left: 0; right: 0; z-index: 2147483647;
        display: flex; align-items: center; gap: 12px; padding: 12px 16px;
        background: rgba(18, 10, 12, 0.92); -webkit-backdrop-filter: blur(12px); backdrop-filter: blur(12px);
        border-bottom: 2px solid #ef4444; color: #f4f6fb;
        font: 13px/1.5 -apple-system, "Segoe UI", Roboto, sans-serif; }
      .dot { width: 10px; height: 10px; border-radius: 50%; background: #ef4444; flex: 0 0 auto;
        box-shadow: 0 0 10px #ef4444; }
      .msg { flex: 1; min-width: 0; }
      .msg b { color: #fca5a5; }
      .btn { border: 1px solid rgba(255,255,255,.18); background: transparent; color: #f4f6fb;
        border-radius: 8px; padding: 7px 12px; cursor: pointer; font-size: 12px; font-weight: 600; white-space: nowrap; }
      .btn:hover { border-color: #ef4444; }
      .btn.solid { background: #ef4444; border-color: #ef4444; color: #fff; }
      .btn.solid:hover { filter: brightness(1.12); }
      .x { background: none; border: 0; color: #9aa3b5; cursor: pointer; font-size: 18px; line-height: 1; padding: 4px; }
      .x:hover { color: #fff; }
    `;
    const bar = document.createElement("div");
    bar.className = "bar";
    bar.setAttribute("role", "alert");
    bar.innerHTML = `
      <span class="dot"></span>
      <span class="msg"><b>Warning:</b> <span class="dom"></span> is on your domain blocklist.</span>
    `;
    bar.querySelector(".dom").textContent = hit;

    const dismiss = () => {
      try { sessionStorage.setItem("udw-dismissed:" + hit, "1"); } catch (e) {}
      mount.remove();
    };
    const mkBtn = (label, cls, fn) => {
      const b = document.createElement("button");
      b.className = "btn " + cls; b.textContent = label;
      b.addEventListener("click", fn);
      return b;
    };
    bar.appendChild(mkBtn("Continue anyway", "", dismiss));
    bar.appendChild(mkBtn("Remove from blocklist", "solid", async () => {
      const { blocklist: cur = [] } = await chrome.storage.local.get("blocklist");
      await chrome.storage.local.set({ blocklist: cur.filter((d) => d !== hit) });
      dismiss();
    }));
    const x = document.createElement("button");
    x.className = "x"; x.textContent = "×"; x.title = "Dismiss";
    x.addEventListener("click", dismiss);
    bar.appendChild(x);

    shadow.appendChild(style);
    shadow.appendChild(bar);
    (document.documentElement || document.body).appendChild(mount);
  } catch (e) {
    /* never break the page */
  }
})();
