/* History Visual Journey Mapper — popup logic.
   Reads today's history on-device, groups visits by domain into a vertical
   timeline, and estimates time per site from gaps between visits. Nothing
   is uploaded anywhere. */

const $ = (id) => document.getElementById(id);
const MAX_GAP_MS = 30 * 60 * 1000; // gaps longer than 30 min count as a break
const LAST_VISIT_GUESS_MS = 5 * 60 * 1000;

document.addEventListener("DOMContentLoaded", init);

async function init() {
  $("clear").onclick = clearToday;
  const now = new Date();
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  $("dateLine").textContent = now.toLocaleDateString(undefined, {
    weekday: "long", month: "short", day: "numeric",
  });
  try {
    const items = await chrome.history.search({
      text: "", startTime: midnight, maxResults: 500,
    });
    const visits = items
      .filter((i) => i.url && /^https?:\/\//i.test(i.url) && i.lastVisitTime)
      .sort((a, b) => a.lastVisitTime - b.lastVisitTime);
    render(visits, midnight);
  } catch (e) {
    $("empty").hidden = false;
    $("empty").textContent = "Couldn’t read history — please allow the history permission.";
  }
}

function domainOf(url) {
  try { return new URL(url).hostname.replace(/^www\./, ""); }
  catch (e) { return url; }
}

function fmtTime(ms) {
  return new Date(ms).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

function fmtDur(ms) {
  const m = Math.round(ms / 60000);
  if (m < 1) return "<1m";
  if (m < 60) return m + "m";
  return Math.floor(m / 60) + "h " + (m % 60) + "m";
}

function render(visits, midnight) {
  const box = $("timeline");
  box.innerHTML = "";
  if (!visits.length) {
    $("empty").hidden = false;
    return;
  }
  $("empty").hidden = true;

  // Group by domain, preserving first-seen (chronological) order.
  const groups = [];
  const byDomain = new Map();
  for (const v of visits) {
    const d = domainOf(v.url);
    if (!byDomain.has(d)) {
      const g = { domain: d, visits: [], dwell: 0, faviconUrl: v.url };
      byDomain.set(d, g);
      groups.push(g);
    }
    byDomain.get(d).visits.push(v);
  }

  // Dwell estimate: gap to the next visit (capped) belongs to this visit's site.
  let totalDwell = 0;
  for (let i = 0; i < visits.length; i++) {
    const next = visits[i + 1];
    const gap = next
      ? Math.min(next.lastVisitTime - visits[i].lastVisitTime, MAX_GAP_MS)
      : LAST_VISIT_GUESS_MS;
    const dwell = Math.max(gap, 0);
    byDomain.get(domainOf(visits[i].url)).dwell += dwell;
    totalDwell += dwell;
  }

  $("stSites").textContent = groups.length;
  $("stVisits").textContent = visits.length;
  $("stTime").textContent = fmtDur(totalDwell);

  for (const g of groups) {
    const el = document.createElement("div");
    el.className = "group";

    const head = document.createElement("div");
    head.className = "dhead";
    const fav = document.createElement("img");
    fav.alt = "";
    fav.src = "chrome://favicon/size/32@1x/" + g.faviconUrl;
    fav.onerror = () => fav.remove();
    const name = document.createElement("b");
    name.textContent = g.domain;
    name.title = g.domain;
    const meta = document.createElement("span");
    meta.className = "meta";
    meta.textContent = `${g.visits.length} visit${g.visits.length > 1 ? "s" : ""} · ~${fmtDur(g.dwell)}`;
    head.append(fav, name, meta);

    el.appendChild(head);
    for (const v of g.visits) {
      const row = document.createElement("div");
      row.className = "visit";
      row.title = v.url;
      const t = document.createElement("span");
      t.className = "t";
      t.textContent = fmtTime(v.lastVisitTime);
      const ti = document.createElement("span");
      ti.className = "ti";
      ti.textContent = v.title || v.url;
      row.append(t, ti);
      row.addEventListener("click", () => chrome.tabs.create({ url: v.url }));
      el.appendChild(row);
    }
    box.appendChild(el);
  }
}

async function clearToday() {
  if (!confirm("Clear today's browsing history?")) return;
  const now = new Date();
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  await chrome.history.deleteRange({ startTime: midnight, endTime: Date.now() });
  init();
}
