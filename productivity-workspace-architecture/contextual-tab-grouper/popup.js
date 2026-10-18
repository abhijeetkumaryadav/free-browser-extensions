// Contextual Tab Grouper — popup logic.
// Suggests tab groups by domain/topic, creates them via chrome.tabs.group.

const GROUP_COLORS = [
  { name: "grey", css: "#9aa3b5" }, { name: "blue", css: "#4f8ff7" },
  { name: "red", css: "#f06666" }, { name: "yellow", css: "#f5c542" },
  { name: "green", css: "#4ade80" }, { name: "pink", css: "#f472b6" },
  { name: "purple", css: "#a78bfa" }, { name: "cyan", css: "#22d3ee" },
  { name: "orange", css: "#fb923c" },
];

// Domain → topic hints for friendlier group names.
const TOPICS = [
  { match: /(github|stackoverflow|gitlab|dev\.to|developer\.|npmjs|vercel|netlify)/, name: "Development" },
  { match: /(youtube|netflix|twitch|spotify|hulu|disney)/, name: "Entertainment" },
  { match: /(twitter|x\.com|instagram|facebook|reddit|linkedin|threads)/, name: "Social" },
  { match: /(nytimes|bbc|theguardian|cnn|reuters|washingtonpost|hackernews|news\.ycombinator)/, name: "News" },
  { match: /(docs\.google|sheets\.google|notion|evernote|confluence)/, name: "Docs & Notes" },
  { match: /(amazon|ebay|flipkart|myntra|shopify|aliexpress)/, name: "Shopping" },
  { match: /(mail\.google|outlook|gmail|protonmail)/, name: "Email" },
  { match: /(figma|dribbble|behance|canva)/, name: "Design" },
];

const $ = (id) => document.getElementById(id);
let suggestions = [];

document.addEventListener("DOMContentLoaded", init);

async function init() {
  const { collapseNew = true } = await chrome.storage.local.get("collapseNew");
  $("collapseNew").checked = collapseNew;
  $("collapseNew").addEventListener("change", (e) =>
    chrome.storage.local.set({ collapseNew: e.target.checked }));
  $("scan").addEventListener("click", scan);
  $("create").addEventListener("click", createGroups);
  $("ungroup").addEventListener("click", ungroupAll);
  updateTabCount();
}

async function updateTabCount() {
  try {
    const tabs = await chrome.tabs.query({ currentWindow: true });
    $("tabCount").textContent = `${tabs.length} tabs open in this window`;
  } catch (e) { $("tabCount").textContent = "—"; }
}

function rootDomain(host) {
  const h = host.replace(/^www\./, "");
  const parts = h.split(".");
  return parts.length > 2 ? parts.slice(-2).join(".") : h;
}

function topicFor(host, root) {
  for (const t of TOPICS) if (t.match.test(host)) return t.name;
  const label = root.split(".")[0];
  return label.charAt(0).toUpperCase() + label.slice(1);
}

async function scan() {
  const btn = $("scan");
  btn.disabled = true; btn.textContent = "Scanning…";
  try {
    const tabs = await chrome.tabs.query({ currentWindow: true, grouped: false });
    const buckets = new Map();
    for (const t of tabs) {
      if (!t.url || !/^https?:/.test(t.url)) continue;
      let host;
      try { host = new URL(t.url).hostname; } catch (e) { continue; }
      const root = rootDomain(host);
      if (!buckets.has(root)) buckets.set(root, []);
      buckets.get(root).push({ id: t.id, title: t.title || root, favIconUrl: t.favIconUrl });
    }
    suggestions = [];
    let ci = 0;
    for (const [root, items] of buckets) {
      if (items.length < 2) continue;
      const host = items[0] && new URL(tabs.find((t) => t.id === items[0].id).url).hostname;
      suggestions.push({
        name: topicFor(host, root),
        color: GROUP_COLORS[ci % GROUP_COLORS.length].name,
        tabs: items,
      });
      ci++;
    }
    renderSuggestions();
  } catch (e) {
    showStatus("Couldn’t scan tabs — reload the extension and try again.");
  } finally {
    btn.disabled = false; btn.textContent = "Scan tabs";
  }
}

function renderSuggestions() {
  const sec = $("suggestions"), box = $("groups");
  box.innerHTML = "";
  sec.hidden = suggestions.length === 0;
  $("empty").style.display = suggestions.length ? "none" : "";
  if (!suggestions.length) {
    $("empty").innerHTML = "No obvious groups found — every tab is on a different site.";
    return;
  }
  suggestions.forEach((g, gi) => {
    const card = document.createElement("div");
    card.className = "group";
    const head = document.createElement("div");
    head.className = "group-head";
    const dot = document.createElement("div");
    dot.className = "dot";
    const name = document.createElement("input");
    name.value = g.name; name.maxLength = 40;
    name.addEventListener("input", () => { g.name = name.value.trim() || "Group"; });
    const n = document.createElement("span");
    n.className = "n";
    n.textContent = `${g.tabs.length} tabs`;
    const paintDot = () => {
      dot.style.background = GROUP_COLORS.find((c) => c.name === g.color).css;
    };
    paintDot();
    head.append(dot, name, n);
    const sw = document.createElement("div");
    sw.className = "swatches";
    for (const c of GROUP_COLORS) {
      const b = document.createElement("button");
      b.className = "sw" + (c.name === g.color ? " sel" : "");
      b.style.background = c.css;
      b.title = c.name;
      b.addEventListener("click", () => {
        g.color = c.name;
        sw.querySelectorAll(".sw").forEach((s) => s.classList.remove("sel"));
        b.classList.add("sel");
        paintDot();
      });
      sw.appendChild(b);
    }
    const list = document.createElement("div");
    list.className = "tabs-list";
    const renderTabs = () => {
      list.innerHTML = "";
      n.textContent = `${g.tabs.length} tabs`;
      for (const t of g.tabs) {
        const row = document.createElement("div");
        row.className = "tab-item";
        if (t.favIconUrl) {
          const im = document.createElement("img");
          im.src = t.favIconUrl;
          row.appendChild(im);
        }
        const sp = document.createElement("span");
        sp.textContent = t.title;
        sp.title = t.title;
        const x = document.createElement("button");
        x.className = "x"; x.textContent = "×"; x.title = "Remove from suggestion";
        x.addEventListener("click", () => {
          g.tabs = g.tabs.filter((k) => k.id !== t.id);
          renderTabs();
        });
        row.append(sp, x);
        list.appendChild(row);
      }
    };
    renderTabs();
    card.append(head, sw, list);
    box.appendChild(card);
  });
  showStatus("");
}

async function createGroups() {
  const btn = $("create");
  btn.disabled = true; btn.textContent = "Creating…";
  try {
    const collapse = $("collapseNew").checked;
    let made = 0;
    for (const g of suggestions.filter((s) => s.tabs.length > 0)) {
      const ids = g.tabs.map((t) => t.id);
      const groupId = await chrome.tabs.group({ tabIds: ids });
      await chrome.tabGroups.update(groupId, {
        title: g.name.slice(0, 40),
        color: g.color,
        collapsed: collapse,
      });
      made++;
    }
    showStatus(made ? `Created ${made} group${made > 1 ? "s" : ""}.` : "Nothing to group.");
    if (made) { suggestions = []; renderSuggestions(); updateTabCount(); }
  } catch (e) {
    showStatus("Couldn’t create groups — this browser may not support tab grouping.");
  } finally {
    btn.disabled = false; btn.textContent = "Create groups";
  }
}

async function ungroupAll() {
  const btn = $("ungroup");
  btn.disabled = true;
  try {
    const tabs = await chrome.tabs.query({ currentWindow: true, grouped: true });
    if (tabs.length) await chrome.tabs.ungroup(tabs.map((t) => t.id));
    showStatus(tabs.length ? "All groups removed in this window." : "No grouped tabs in this window.");
  } catch (e) {
    showStatus("Couldn’t ungroup tabs.");
  } finally {
    btn.disabled = false;
  }
}

function showStatus(msg) {
  let el = document.querySelector(".status");
  if (!el) {
    el = document.createElement("div");
    el.className = "status";
    document.querySelector("main").appendChild(el);
  }
  el.textContent = msg;
}
