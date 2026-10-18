// Distraction Friction Blocker — content script (document_start).
// Shows a full-page breathing interstitial on blocklisted sites.
// Non-destructive: "Continue anyway" always unlocks after 10 s.

(async function () {
  const host = location.hostname.replace(/^www\./, "");
  if (!host || sessionStorage.getItem("dfb-ok") === "1") return;

  let store;
  try {
    store = await chrome.storage.local.get({ blocklist: [], enabled: true, visits: null });
  } catch (e) { return; }
  if (!store.enabled) return;
  const blocked = store.blocklist.some(
    (d) => host === d || host.endsWith("." + d)
  );
  if (!blocked) return;

  await recordVisit(host, store.visits);
  sessionStorage.setItem("dfb-ok", "pending");
  showOverlay(host);
})();

async function recordVisit(host, visits) {
  try {
    const today = new Date().toISOString().slice(0, 10);
    if (!visits || visits.date !== today) visits = { date: today, counts: {} };
    visits.counts[host] = (visits.counts[host] || 0) + 1;
    await chrome.storage.local.set({ visits });
  } catch (e) {}
}

function showOverlay(host) {
  const root = document.documentElement;
  if (!root) return;

  const ACCENT = "#ef4444";
  const wrap = document.createElement("div");
  wrap.id = "dfb-overlay";
  wrap.setAttribute("style",
    "position:fixed;inset:0;z-index:2147483647;display:flex;align-items:center;justify-content:center;" +
    "background:rgba(10,10,15,.88);backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px);" +
    "font-family:-apple-system,'Segoe UI',Roboto,Inter,sans-serif;");

  const card = document.createElement("div");
  card.setAttribute("style",
    "max-width:340px;width:90%;text-align:center;padding:40px 28px;border-radius:20px;" +
    "background:rgba(22,22,30,.85);border:1px solid rgba(255,255,255,.1);color:#f4f6fb;");

  card.innerHTML =
    '<svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="' + ACCENT +
    '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom:16px">' +
    '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>' +
    '<h1 style="font-size:22px;margin:0 0 8px;font-weight:700">Take a breath.</h1>' +
    '<p style="color:#9aa3b5;font-size:14px;margin:0 0 6px">You listed <b style="color:#f4f6fb">' +
    escapeHtml(host) + '</b> as a distraction.</p>' +
    '<p style="color:#9aa3b5;font-size:13px;margin:0 0 24px">Still want to go there? The continue button unlocks in a moment.</p>' +
    '<div style="font-size:44px;font-weight:700;color:' + ACCENT + ';margin-bottom:24px" id="dfb-count">10</div>' +
    '<button id="dfb-continue" disabled style="width:100%;padding:13px;border:0;border-radius:12px;font-weight:700;font-size:15px;' +
    'background:rgba(255,255,255,.08);color:#9aa3b5;cursor:not-allowed;margin-bottom:10px">Continue in 10s</button>' +
    '<button id="dfb-back" style="width:100%;padding:13px;border:1px solid rgba(255,255,255,.12);border-radius:12px;' +
    'background:transparent;color:#f4f6fb;font-size:15px;cursor:pointer">← Go back</button>';

  wrap.appendChild(card);
  (document.body || root).appendChild(wrap);

  document.getElementById("dfb-back").addEventListener("click", () => history.back());

  const btn = document.getElementById("dfb-continue");
  const countEl = document.getElementById("dfb-count");
  let left = 10;
  const timer = setInterval(() => {
    left--;
    if (left <= 0) {
      clearInterval(timer);
      countEl.textContent = "✓";
      btn.disabled = false;
      btn.textContent = "Continue anyway";
      btn.setAttribute("style",
        "width:100%;padding:13px;border:0;border-radius:12px;font-weight:700;font-size:15px;" +
        "background:" + ACCENT + ";color:#fff;cursor:pointer;margin-bottom:10px");
      btn.addEventListener("click", dismiss);
    } else {
      countEl.textContent = String(left);
      btn.textContent = "Continue in " + left + "s";
    }
  }, 1000);

  function dismiss() {
    clearInterval(timer);
    sessionStorage.setItem("dfb-ok", "1");
    wrap.remove();
  }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
  ));
}
