// Queue Position Notifier — popup logic.
// Reminders are stored on-device; a chrome.alarms entry fires each one.

const $ = (id) => document.getElementById(id);

document.addEventListener("DOMContentLoaded", init);

async function init() {
  $("addBtn").addEventListener("click", addDrop);
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab) {
      if (tab.title) $("fName").value = tab.title.split("|")[0].trim().slice(0, 80);
      window.__tabUrl = tab.url || "";
      try { window.__tabHost = new URL(tab.url).hostname.replace(/^www\./, ""); }
      catch (e) { window.__tabHost = ""; }
    }
  } catch (e) {}
  // badge has been seen now
  try { chrome.runtime.sendMessage({ type: "badge-seen" }); } catch (e) {}
  render();
  setInterval(render, 30000);
}

async function getDrops() {
  const { drops = [] } = await chrome.storage.local.get("drops");
  return drops;
}

async function addDrop() {
  const name = $("fName").value.trim();
  const when = new Date($("fWhen").value).getTime();
  if (!name || isNaN(when) || when <= Date.now()) { $("fWhen").focus(); return; }
  const id = "d" + Date.now().toString(36);
  const drops = await getDrops();
  drops.push({
    id,
    name,
    url: window.__tabUrl || "",
    host: window.__tabHost || "",
    at: when,
    fired: false,
  });
  await chrome.storage.local.set({ drops });
  await chrome.alarms.create("drop-" + id, { when });
  $("fName").value = "";
  $("fWhen").value = "";
  render();
}

function fmtCountdown(ms) {
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m ${String(s % 60).padStart(2, "0")}s`;
}

async function render() {
  const now = Date.now();
  const drops = (await getDrops()).sort((a, b) => a.at - b.at);
  const upcoming = drops.filter((d) => d.at > now && !d.fired);
  $("count").textContent = upcoming.length
    ? `${upcoming.length} reminder${upcoming.length > 1 ? "s" : ""} set`
    : "No reminders set";
  const box = $("list");
  box.innerHTML = "";
  if (!drops.length) {
    const e = document.createElement("div");
    e.className = "empty";
    e.textContent = "No reminders yet — set one above.";
    box.appendChild(e);
    return;
  }
  for (const d of drops) {
    const done = d.at <= now || d.fired;
    const row = document.createElement("div");
    row.className = "drop" + (done ? " done" : "");
    const info = document.createElement("div");
    info.className = "info";
    const b = document.createElement("b");
    b.textContent = d.name; b.title = d.name;
    const meta = document.createElement("span");
    const dt = new Date(d.at);
    meta.textContent = `${d.host ? d.host + " · " : ""}${dt.toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}`;
    info.append(b, meta);
    const cd = document.createElement("div");
    cd.className = "cd";
    cd.textContent = done ? "done" : fmtCountdown(d.at - now);
    const open = document.createElement("button");
    open.className = "iconbtn"; open.textContent = "↗"; open.title = "Open page";
    open.disabled = !d.url;
    open.addEventListener("click", () => chrome.tabs.create({ url: d.url }));
    const x = document.createElement("button");
    x.className = "iconbtn"; x.textContent = "×"; x.title = "Remove";
    x.addEventListener("click", async () => {
      await chrome.alarms.clear("drop-" + d.id);
      await chrome.storage.local.set({ drops: (await getDrops()).filter((i) => i.id !== d.id) });
      render();
    });
    row.append(info, cd, open, x);
    box.appendChild(row);
  }
}
