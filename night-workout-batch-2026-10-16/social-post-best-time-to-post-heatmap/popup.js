/* Best-Time Heatmap — your posting log → day×hour heatmap. Zero network. */
// ENGINE-START
const DAYS = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
const MAX_ENTRIES = 500;

/** Validate and normalize one logged post entry. Returns entry or null. */
function makeEntry({platform, day, hour, notes}) {
  const plats = ["Instagram","Facebook","Threads","X","LinkedIn","YouTube","Other"];
  if (!plats.includes(platform)) return null;
  if (!DAYS.includes(day)) return null;
  const h = Number(hour);
  if (!Number.isInteger(h) || h < 0 || h > 23) return null;
  return {
    id: "e" + Date.now() + Math.floor(Math.random() * 1e6).toString(36),
    platform,
    day,
    hour: h,
    notes: (notes || "").trim().slice(0, 200),
    ts: Date.now(),
  };
}

/** Build a 7×24 count grid from entries. grid[dayIdx][hour] = count. */
function buildGrid(entries) {
  const grid = DAYS.map(() => new Array(24).fill(0));
  for (const e of entries) {
    const di = DAYS.indexOf(e.day);
    if (di >= 0 && Number.isInteger(e.hour) && e.hour >= 0 && e.hour < 24) grid[di][e.hour]++;
  }
  return grid;
}

/** Rank day×hour slots by count, descending. Returns [{day, hour, count}]. */
function bestSlots(entries, topN = 8) {
  const grid = buildGrid(entries);
  const out = [];
  grid.forEach((row, di) => row.forEach((count, h) => {
    if (count > 0) out.push({ day: DAYS[di], hour: h, count });
  }));
  out.sort((a, b) => b.count - a.count || DAYS.indexOf(a.day) - DAYS.indexOf(b.day) || a.hour - b.hour);
  return out.slice(0, topN);
}

/** Validate an imported payload. Returns array of entries or null. */
function parseImport(payload) {
  if (!Array.isArray(payload)) return null;
  const out = [];
  for (const raw of payload.slice(0, MAX_ENTRIES)) {
    const e = makeEntry(raw || {});
    if (e) { e.id = typeof raw.id === "string" ? raw.id : e.id; e.ts = Number(raw.ts) || e.ts; out.push(e); }
  }
  return out;
}

/** Escape text for HTML display. */
function esc(s) {
  return String(s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}

/** Hour → friendly label ("9 AM", "3 PM"). */
function hourLabel(h) {
  const ampm = h < 12 ? "AM" : "PM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return h12 + " " + ampm;
}
// ENGINE-END

// ---- UI wiring (not part of the tested engine) ----
const $ = (id) => document.getElementById(id);
let entries = [];

function save() { chrome.storage.local.set({ entries, notes: $("notes").value }); }

async function load() {
  const d = await chrome.storage.local.get(["entries", "notes"]);
  entries = Array.isArray(d.entries) ? d.entries.slice(0, MAX_ENTRIES) : [];
  $("notes").value = d.notes || "";
}

function renderList() {
  const box = $("entryList");
  if (!entries.length) { box.innerHTML = '<p class="empty">No posts logged yet.</p>'; return; }
  box.innerHTML = [...entries].reverse().map(e => `
    <div class="item">
      <div><b>${esc(e.platform)}</b> · ${esc(e.day)} ${esc(hourLabel(e.hour))}
        <div class="meta">${esc(e.notes || "—")}</div></div>
      <button class="del" data-id="${esc(e.id)}" title="Delete">×</button>
    </div>`).join("");
  box.querySelectorAll(".del").forEach(b => b.onclick = () => {
    entries = entries.filter(x => x.id !== b.dataset.id);
    save(); renderAll();
  });
}

function renderHeat() {
  const cv = $("heat"), ctx = cv.getContext("2d");
  const W = cv.width, H = cv.height;
  ctx.clearRect(0, 0, W, H);
  const grid = buildGrid(entries);
  const max = Math.max(1, ...grid.flat());
  const cellW = W / 24, cellH = H / 7;
  grid.forEach((row, di) => row.forEach((c, h) => {
    const t = c / max;
    ctx.fillStyle = t === 0 ? "rgba(255,255,255,.04)" : `rgba(251,113,133,${0.08 + t * 0.85})`;
    ctx.fillRect(h * cellW + 1, di * cellH + 1, cellW - 2, cellH - 2);
  }));
}

function renderBest() {
  const box = $("bestList");
  const slots = bestSlots(entries);
  if (!slots.length) { box.innerHTML = '<p class="empty">Log some posts first.</p>'; return; }
  box.innerHTML = slots.map(s =>
    `<div class="slot"><span>${esc(s.day)} · ${esc(hourLabel(s.hour))}</span><b>${s.count} post${s.count > 1 ? "s" : ""}</b></div>`).join("");
}

function renderAll() { renderList(); renderHeat(); renderBest(); }

document.addEventListener("DOMContentLoaded", async () => {
  const hsel = $("fHour");
  for (let h = 0; h < 24; h++) {
    const o = document.createElement("option");
    o.value = h; o.textContent = hourLabel(h); hsel.appendChild(o);
  }
  document.querySelectorAll(".tab").forEach(t => t.onclick = () => {
    document.querySelectorAll(".tab").forEach(x => x.classList.remove("active"));
    document.querySelectorAll(".panel").forEach(x => x.classList.remove("active"));
    t.classList.add("active");
    $("tab-" + t.dataset.tab).classList.add("active");
    if (t.dataset.tab === "map") renderHeat();
    if (t.dataset.tab === "best") renderBest();
  });
  await load(); renderAll();

  $("entryForm").onsubmit = (ev) => {
    ev.preventDefault();
    const e = makeEntry({ platform: $("fPlatform").value, day: $("fDay").value, hour: $("fHour").value, notes: $("fNotes").value });
    if (!e) return;
    if (entries.length >= MAX_ENTRIES) entries.shift();
    entries.push(e); $("fNotes").value = "";
    save(); renderAll();
  };
  $("notes").addEventListener("input", save);
  $("clearBtn").onclick = () => { if (confirm("Clear all logged posts?")) { entries = []; save(); renderAll(); } };
  $("exportBtn").onclick = () => {
    const blob = new Blob([JSON.stringify(entries, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = "post-heatmap-log.json"; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  };
  $("importFile").onchange = (ev) => {
    const f = ev.target.files[0]; if (!f) return;
    const r = new FileReader();
    r.onload = () => { try { const data = parseImport(JSON.parse(r.result)); if (data) { entries = data; save(); renderAll(); } } catch {} };
    r.readAsText(f); ev.target.value = "";
  };
});
