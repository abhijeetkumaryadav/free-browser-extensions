// Session Backup Restorer — popup UI.
// Lists saved snapshots (newest first) with restore / delete,
// manual "Backup now", and JSON export / import.

// ---------------------------------------------------------------------------
// Elements
// ---------------------------------------------------------------------------
const $ = (id) => document.getElementById(id);
const snapList = $("snapList"), snapCount = $("snapCount");

// Small Lucide-style "layers" glyph reused for each snapshot row.
const LAYER_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z"/><path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65"/><path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65"/></svg>`;

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------
function fmtTime(ts) {
  const d = new Date(ts);
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  const y = new Date(today); y.setDate(y.getDate() - 1);
  const wasYesterday = d.toDateString() === y.toDateString();
  const time = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  if (sameDay) return `Today · ${time}`;
  if (wasYesterday) return `Yesterday · ${time}`;
  return d.toLocaleDateString([], { month: "short", day: "numeric" }) + ` · ${time}`;
}

function sourceLabel(src) {
  return { auto: "auto", startup: "startup", installed: "first", manual: "manual" }[src] || "auto";
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------
async function loadSnapshots() {
  const { snapshots = [] } = await chrome.storage.local.get("snapshots");
  snapCount.textContent = snapshots.length;
  snapList.innerHTML = "";

  if (!snapshots.length) {
    snapList.innerHTML = `<div class="empty">No snapshots yet — click “Backup now” to save this session.</div>`;
    return;
  }

  for (const s of snapshots) {
    const row = document.createElement("div");
    row.className = "snap";
    row.innerHTML = `
      <div class="ico2">${LAYER_ICON}</div>
      <div class="t">
        <b>${escapeHtml(fmtTime(s.at))}<span class="badge">${sourceLabel(s.source)}</span></b>
        <span>${s.windowCount} window${s.windowCount === 1 ? "" : "s"} · ${s.tabCount} tab${s.tabCount === 1 ? "" : "s"}</span>
      </div>
      <div class="acts">
        <button data-act="restore" title="Restore into a new window">Restore</button>
        <button data-act="delete" class="del" title="Delete snapshot">×</button>
      </div>`;

    row.querySelector('[data-act="restore"]').addEventListener("click", async () => {
      const res = await chrome.runtime.sendMessage({ type: "restore", id: s.id });
      if (res && res.ok) {
        flash(row, "Opened in a new window");
      } else {
        flash(row, "Nothing restorable in this snapshot");
      }
    });

    row.querySelector('[data-act="delete"]').addEventListener("click", async () => {
      if (!confirm("Delete this snapshot?")) return;
      await chrome.runtime.sendMessage({ type: "delete", id: s.id });
      await loadSnapshots();
    });

    snapList.appendChild(row);
  }
}

// Transient inline feedback inside the row's meta line.
function flash(row, msg) {
  const meta = row.querySelector(".t span");
  const old = meta.textContent;
  meta.textContent = msg;
  setTimeout(() => { meta.textContent = old; }, 1800);
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

// ---------------------------------------------------------------------------
// Backup now
// ---------------------------------------------------------------------------
$("backupNow").addEventListener("click", async () => {
  await chrome.runtime.sendMessage({ type: "backup-now" });
  await loadSnapshots();
});

// ---------------------------------------------------------------------------
// Export / import
// ---------------------------------------------------------------------------
$("exportBtn").addEventListener("click", async () => {
  const { snapshots = [] } = await chrome.storage.local.get("snapshots");
  if (!snapshots.length) return;
  const blob = new Blob([JSON.stringify({ app: "session-backup-restorer", version: 1, snapshots }, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `session-backups-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();                                   // user-initiated download of their own data
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
});

$("importBtn").addEventListener("click", () => $("importFile").click());

$("importFile").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  e.target.value = "";
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    const incoming = Array.isArray(data) ? data : data.snapshots;
    if (!Array.isArray(incoming)) throw new Error("bad format");

    // Keep only well-formed snapshot records; cap at 20 newest.
    const clean = incoming
      .filter((s) => s && s.id && Array.isArray(s.windows))
      .map((s) => ({
        id: String(s.id),
        at: Number(s.at) || Date.now(),
        source: "imported",
        tabCount: Number(s.tabCount) || 0,
        windowCount: Number(s.windowCount) || (s.windows || []).length,
        windows: s.windows,
      }));

    const { snapshots = [] } = await chrome.storage.local.get("snapshots");
    const seen = new Set(snapshots.map((s) => s.id));
    const merged = [...clean.filter((s) => !seen.has(s.id)), ...snapshots]
      .sort((a, b) => b.at - a.at)
      .slice(0, 20);
    await chrome.storage.local.set({ snapshots: merged });
    await loadSnapshots();
  } catch {
    alert("Could not import — the file is not a valid session-backup export.");
  }
});

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------
loadSnapshots();
