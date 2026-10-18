// Idle Tab RAM Hibernator — popup UI logic.

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

document.addEventListener("DOMContentLoaded", init);

async function init() {
  $("enabled").addEventListener("change", async (e) => {
    await chrome.storage.local.set({ enabled: e.target.checked });
  });
  $("idleMinutes").addEventListener("change", async (e) => {
    const v = Math.min(480, Math.max(5, parseInt(e.target.value, 10) || 30));
    e.target.value = v;
    await chrome.storage.local.set({ idleMinutes: v });
  });
  $("sweepNow").addEventListener("click", async () => {
    $("sweepNow").disabled = true; $("sweepNow").textContent = "Sweeping…";
    await chrome.runtime.sendMessage({ type: "sweep-now" });
    await refresh();
    $("sweepNow").disabled = false; $("sweepNow").textContent = "Hibernate idle tabs now";
  });
  $("wakeAll").addEventListener("click", async () => {
    await chrome.runtime.sendMessage({ type: "wake-all" });
    await refresh();
  });
  $("wlAdd").addEventListener("click", addWhitelist);
  $("wlInput").addEventListener("keydown", (e) => { if (e.key === "Enter") addWhitelist(); });
  $("wlCurrent").addEventListener("click", whitelistCurrentSite);

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && (changes.hibernated || changes.whitelist)) refresh();
  });
  await refresh();
}

async function refresh() {
  const { enabled, idleMinutes, whitelist = [], hibernated = {} } =
    await chrome.storage.local.get(["enabled", "idleMinutes", "whitelist", "hibernated"]);
  $("enabled").checked = enabled !== false;
  $("idleMinutes").value = idleMinutes || 30;
  renderHibernated(hibernated);
  renderWhitelist(whitelist);
}

function renderHibernated(hibernated) {
  const ids = Object.keys(hibernated);
  $("hibCount").textContent = ids.length;
  $("wakeAll").disabled = ids.length === 0;
  const box = $("hibList");
  box.innerHTML = "";
  if (!ids.length) {
    box.innerHTML = '<div class="empty">No hibernated tabs. Idle tabs will appear here.</div>';
    return;
  }
  const sorted = ids.map(Number).sort((a, b) => hibernated[b].at - hibernated[a].at);
  for (const id of sorted) {
    const h = hibernated[id];
    const row = document.createElement("div");
    row.className = "hib";
    const ago = relTime(h.at);
    row.innerHTML = `
      ${h.favIconUrl ? `<img src="${esc(h.favIconUrl)}" alt="">` : ""}
      <div class="t"><b title="${esc(h.title)}">${esc(h.title)}</b><span>${esc(h.host)} · ${ago}</span></div>
      <button data-wake="${id}">Wake</button>`;
    box.appendChild(row);
  }
  box.querySelectorAll("[data-wake]").forEach((b) =>
    b.addEventListener("click", async () => {
      await chrome.runtime.sendMessage({ type: "wake", tabId: Number(b.dataset.wake) });
      await refresh();
    })
  );
}

function renderWhitelist(whitelist) {
  const box = $("wlList");
  box.innerHTML = "";
  if (!whitelist.length) {
    box.innerHTML = '<div class="empty">No whitelisted sites yet.</div>';
    return;
  }
  for (const d of whitelist) {
    const row = document.createElement("div");
    row.className = "wl";
    row.innerHTML = `<span title="${esc(d)}">${esc(d)}</span><button data-rm="${esc(d)}" title="Remove">×</button>`;
    box.appendChild(row);
  }
  box.querySelectorAll("[data-rm]").forEach((b) =>
    b.addEventListener("click", async () => {
      const { whitelist: cur = [] } = await chrome.storage.local.get("whitelist");
      await chrome.storage.local.set({ whitelist: cur.filter((x) => x !== b.dataset.rm) });
      await refresh();
    })
  );
}

async function addWhitelist() {
  const raw = $("wlInput").value.trim().toLowerCase().replace(/^https?:\/\//, "").split("/")[0].replace(/^www\./, "");
  if (!raw) return;
  const { whitelist = [] } = await chrome.storage.local.get("whitelist");
  if (!whitelist.includes(raw)) {
    whitelist.push(raw);
    await chrome.storage.local.set({ whitelist });
  }
  $("wlInput").value = "";
  await refresh();
}

async function whitelistCurrentSite() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.url || !/^https?:/.test(tab.url)) return;
  const host = new URL(tab.url).hostname.replace(/^www\./, "");
  const { whitelist = [] } = await chrome.storage.local.get("whitelist");
  if (!whitelist.includes(host)) {
    whitelist.push(host);
    await chrome.storage.local.set({ whitelist });
  }
  await refresh();
}

function relTime(ts) {
  const m = Math.floor((Date.now() - ts) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}
