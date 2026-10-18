// Distraction Friction Blocker — popup logic (blocklist management + stats).

const $ = (id) => document.getElementById(id);

document.addEventListener("DOMContentLoaded", init);

async function init() {
  const { enabled = true } = await chrome.storage.local.get("enabled");
  $("enabled").checked = enabled;
  $("enabled").addEventListener("change", (e) =>
    chrome.storage.local.set({ enabled: e.target.checked }));

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab && tab.url) {
    try { $("pageHost").textContent = new URL(tab.url).hostname.replace(/^www\./, ""); } catch (e) {}
  }

  $("blockThis").addEventListener("click", blockCurrentSite);
  $("addBtn").addEventListener("click", addDomain);
  $("domain").addEventListener("keydown", (e) => { if (e.key === "Enter") addDomain(); });
  render();
}

function cleanDomain(raw) {
  let d = raw.trim().toLowerCase();
  d = d.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0].split("?")[0];
  return /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(d) ? d : null;
}

async function blockCurrentSite() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.url) return;
  let host;
  try { host = new URL(tab.url).hostname.replace(/^www\./, ""); } catch (e) { return; }
  const d = cleanDomain(host);
  if (!d) return;
  const { blocklist = [] } = await chrome.storage.local.get("blocklist");
  if (!blocklist.includes(d)) {
    blocklist.push(d);
    await chrome.storage.local.set({ blocklist });
  }
  render();
}

async function addDomain() {
  const d = cleanDomain($("domain").value);
  if (!d) { $("domain").focus(); return; }
  const { blocklist = [] } = await chrome.storage.local.get("blocklist");
  if (!blocklist.includes(d)) {
    blocklist.push(d);
    blocklist.sort();
    await chrome.storage.local.set({ blocklist });
  }
  $("domain").value = "";
  render();
}

async function render() {
  const { blocklist = [], visits = null } = await chrome.storage.local.get(["blocklist", "visits"]);
  const today = new Date().toISOString().slice(0, 10);
  const counts = (visits && visits.date === today) ? visits.counts : {};

  const box = $("list");
  box.innerHTML = "";
  if (!blocklist.length) {
    const d = document.createElement("div");
    d.className = "empty-note";
    d.textContent = "No sites blocked yet — add one above.";
    box.appendChild(d);
  }
  for (const d of blocklist) {
    const row = document.createElement("div");
    row.className = "site-row";
    const dd = document.createElement("div");
    dd.className = "d";
    const b = document.createElement("b");
    b.textContent = d;
    const sp = document.createElement("span");
    const n = counts[d] || 0;
    sp.textContent = n ? `${n} pause${n > 1 ? "s" : ""} today` : "not visited today";
    dd.append(b, sp);
    const x = document.createElement("button");
    x.className = "x"; x.textContent = "×"; x.title = "Remove";
    x.addEventListener("click", async () => {
      const { blocklist: cur = [] } = await chrome.storage.local.get("blocklist");
      await chrome.storage.local.set({ blocklist: cur.filter((i) => i !== d) });
      render();
    });
    row.append(dd, x);
    box.appendChild(row);
  }

  // stats
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const card = $("statsCard"), sbox = $("stats");
  sbox.innerHTML = "";
  card.hidden = entries.length === 0;
  const total = entries.reduce((a, [, n]) => a + n, 0);
  const tot = document.createElement("div");
  tot.className = "stat-row";
  tot.innerHTML = "<span>Total pauses today</span>";
  const tb = document.createElement("b");
  tb.textContent = total;
  tot.appendChild(tb);
  sbox.appendChild(tot);
  for (const [site, n] of entries.slice(0, 8)) {
    const r = document.createElement("div");
    r.className = "stat-row";
    const s = document.createElement("span");
    s.textContent = site;
    const b = document.createElement("b");
    b.textContent = n;
    r.append(s, b);
    sbox.appendChild(r);
  }
}
