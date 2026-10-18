// popup.js — sample the active tab's DOM and track growth per tab.
const $ = (id) => document.getElementById(id);
const MAX_SAMPLES = 30;

function hostKey(url) {
  try { return new URL(url).hostname || "unknown"; } catch { return "unknown"; }
}

async function getHistory(tabId) {
  const { histories = {} } = await chrome.storage.local.get("histories");
  return { histories, mine: histories[tabId] || [] };
}

async function sample() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.id || !/^https?:/.test(tab.url || "")) {
    $("delta").textContent = "Open a normal web page first (not chrome://).";
    return;
  }
  await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["content.js"] });
  const snap = await chrome.tabs.sendMessage(tab.id, { type: "DOMNODE_SNAPSHOT" });
  const { histories, mine } = await getHistory(tab.id);
  const key = hostKey(tab.url);
  mine.push({ at: snap.at, total: snap.total, top: snap.top, host: key });
  if (mine.length > MAX_SAMPLES) mine.splice(0, mine.length - MAX_SAMPLES);
  histories[tab.id] = mine;
  await chrome.storage.local.set({ histories });
  render(snap, mine);
}

function render(snap, mine) {
  $("total").textContent = snap.total.toLocaleString();
  if (mine.length >= 2) {
    const first = mine[0], last = mine[mine.length - 1];
    const d = last.total - first.total, dt = Math.max(1, Math.round((last.at - first.at) / 1000));
    const el = $("delta");
    el.innerHTML = "";
    const sign = d > 0 ? "+" : "";
    el.textContent = `${sign}${d.toLocaleString()} nodes since first sample (${dt}s) — `;
    const hint = document.createElement("span");
    hint.className = d > 0 ? "up" : "down";
    hint.textContent = d > 0 ? "growing ▲ (possible leak — or just dynamic content)" : "stable/shrinking ▼";
    el.appendChild(hint);
  } else {
    $("delta").textContent = "Interact with the page, then sample again to see growth.";
  }
  const bars = $("top-tags");
  bars.innerHTML = "";
  const max = snap.top.length ? snap.top[0].n : 1;
  for (const { tag, n } of snap.top) {
    const row = document.createElement("div");
    row.className = "bar-row";
    const c = document.createElement("code"); c.textContent = `<${tag}>`;
    const t = document.createElement("div"); t.className = "track";
    const f = document.createElement("div"); f.className = "fill";
    f.style.width = `${Math.round((n / max) * 100)}%`;
    t.appendChild(f);
    const v = document.createElement("span"); v.textContent = n.toLocaleString();
    row.append(c, t, v);
    bars.appendChild(row);
  }
  const list = $("history");
  list.innerHTML = "";
  const rev = [...mine].reverse();
  if (!rev.length) list.innerHTML = '<li class="empty">No samples yet for this tab.</li>';
  for (const s of rev) {
    const li = document.createElement("li");
    li.textContent = `${new Date(s.at).toLocaleTimeString()} — ${s.total.toLocaleString()} nodes`;
    list.appendChild(li);
  }
}

async function init() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab && tab.id) {
    const { histories = {} } = await chrome.storage.local.get("histories");
    const mine = histories[tab.id] || [];
    if (mine.length) {
      const last = mine[mine.length - 1];
      render({ total: last.total, top: last.top }, mine);
    }
  }
}

$("sample").addEventListener("click", sample);
$("clear").addEventListener("click", async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab && tab.id) {
    const { histories = {} } = await chrome.storage.local.get("histories");
    delete histories[tab.id];
    await chrome.storage.local.set({ histories });
  }
  $("history").innerHTML = '<li class="empty">No samples yet for this tab.</li>';
  $("delta").textContent = "Take a sample to start tracking.";
  $("total").textContent = "—";
  $("top-tags").innerHTML = "";
});

init();
