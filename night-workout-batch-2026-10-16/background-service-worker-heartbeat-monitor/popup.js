// popup.js — renders this extension's own worker health.
const $ = (id) => document.getElementById(id);

function fmtAgo(ts) {
  const s = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (s < 5) return "just now";
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  return `${Math.floor(m / 60)}h ${m % 60}m ago`;
}

function fmtDur(ms) {
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
  if (d) return `${d}d ${h}h`;
  if (h) return `${h}h ${m}m`;
  if (m) return `${m}m`;
  return `${s}s`;
}

function fmtBytes(b) {
  if (b < 1024) return `${b} B`;
  if (b < 1048576) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1048576).toFixed(2)} MB`;
}

async function refresh() {
  const { installedAt, heartbeats = [], lastHeartbeat } = await chrome.storage.local.get(["installedAt", "heartbeats", "lastHeartbeat"]);

  // Worker status: "awake" if a heartbeat landed in the last 2 minutes.
  const fresh = lastHeartbeat && Date.now() - lastHeartbeat < 2 * 60 * 1000;
  const status = $("worker-status");
  status.textContent = fresh ? "AWAKE" : lastHeartbeat ? "SLEEPING (normal)" : "WAITING";
  status.style.color = fresh ? "var(--accent)" : "";

  $("last-hb").textContent = lastHeartbeat ? fmtAgo(lastHeartbeat) : "—";
  $("uptime").textContent = installedAt ? fmtDur(Date.now() - installedAt) : "—";
  $("hb-count").textContent = heartbeats.length;

  // Storage usage estimate (this extension's origin storage).
  try {
    const est = await navigator.storage.estimate();
    $("storage").textContent = est.usage != null ? `≈ ${fmtBytes(est.usage)}` : "—";
  } catch {
    $("storage").textContent = "—";
  }

  const list = $("hb-list");
  list.innerHTML = "";
  const recent = [...heartbeats].sort((a, b) => b - a).slice(0, 20);
  if (!recent.length) {
    list.innerHTML = '<li class="empty">No heartbeats yet — leave the extension enabled and check back.</li>';
  } else {
    for (const t of recent) {
      const li = document.createElement("li");
      li.textContent = new Date(t).toLocaleTimeString() + "  ·  " + fmtAgo(t);
      list.appendChild(li);
    }
  }
}

// "Ping now" — logs an immediate heartbeat through the service worker.
$("ping").addEventListener("click", async () => {
  const { heartbeats = [] } = await chrome.storage.local.get("heartbeats");
  const now = Date.now();
  const kept = [...heartbeats, now].filter((t) => now - t < 24 * 60 * 60 * 1000);
  await chrome.storage.local.set({ heartbeats: kept, lastHeartbeat: now });
  refresh();
});

refresh();
