/**
 * Multi-Search Launcher popup.
 * Type once → open the query on the engines YOU pick, as background tabs.
 * No result scraping or aggregation happens here — this only opens search URLs.
 */

/** Search engines and their query URL templates. Keep https, keep simple. */
const ENGINES = [
  { id: "google",     name: "Google",      url: "https://www.google.com/search?q=" },
  { id: "bing",       name: "Bing",        url: "https://www.bing.com/search?q=" },
  { id: "duckduckgo", name: "DuckDuckGo",  url: "https://duckduckgo.com/?q=" },
  { id: "brave",      name: "Brave",       url: "https://search.brave.com/search?q=" },
  { id: "ecosia",     name: "Ecosia",      url: "https://www.ecosia.org/search?q=" },
  { id: "startpage",  name: "Startpage",   url: "https://www.startpage.com/sp/search?query=" },
  { id: "yandex",     name: "Yandex",      url: "https://yandex.com/search/?text=" },
  { id: "yahoo",      name: "Yahoo",       url: "https://search.yahoo.com/search?p=" },
  { id: "mojeek",     name: "Mojeek",      url: "https://www.mojeek.com/search?q=" },
  { id: "qwant",      name: "Qwant",       url: "https://www.qwant.com/?q=" }
];

const $ = (id) => document.getElementById(id);
const DEFAULT_PICKS = ["google", "bing", "duckduckgo"];

async function loadState() {
  const data = await chrome.storage.local.get(["picks"]);
  if (Array.isArray(data.picks)) return data.picks;
  return DEFAULT_PICKS.slice();
}

async function saveState(picks) {
  await chrome.storage.local.set({ picks });
}

function currentPicks() {
  return ENGINES.filter((e) => $("eng-" + e.id).checked).map((e) => e.id);
}

function refreshCounts() {
  const n = currentPicks().length;
  $("engineCount").textContent = n;
  $("pickCount").textContent = n + " picked";
}

function renderEngines(picks) {
  const list = $("engineList");
  list.innerHTML = "";
  for (const eng of ENGINES) {
    const label = document.createElement("label");
    label.className = "engine-row";
    label.setAttribute("for", "eng-" + eng.id);

    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.id = "eng-" + eng.id;
    cb.checked = picks.includes(eng.id);
    cb.addEventListener("change", async () => {
      await saveState(currentPicks());
      refreshCounts();
    });

    const check = document.createElement("span");
    check.className = "check";
    check.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#04222e" stroke-width="3.5" stroke-linecap="round"><path d="M5 13l4 4L19 7"/></svg>';

    const name = document.createElement("span");
    name.className = "engine-name";
    name.textContent = eng.name;

    // Small per-engine "open" shortcut using the current query text
    const go = document.createElement("span");
    go.className = "engine-go";
    go.textContent = "open →";
    go.addEventListener("click", async (ev) => {
      ev.preventDefault(); // don't toggle the checkbox
      await openEngines([eng.id]);
    });

    label.appendChild(cb);
    label.appendChild(check);
    label.appendChild(name);
    label.appendChild(go);
    list.appendChild(label);
  }
  refreshCounts();
}

/** Open the current query on the given engine ids as background tabs. */
async function openEngines(engineIds) {
  const q = $("query").value.trim();
  if (!q) {
    $("query").focus();
    return;
  }
  if (!engineIds.length) return;
  const encoded = encodeURIComponent(q);
  for (const id of engineIds) {
    const eng = ENGINES.find((e) => e.id === id);
    if (!eng) continue;
    // tabs.create = user gesture from popup click; background tabs (active:false)
    chrome.tabs.create({ url: eng.url + encoded, active: false });
  }
  window.close(); // close the popup after launching
}

document.addEventListener("DOMContentLoaded", async () => {
  const picks = await loadState();
  renderEngines(picks);

  $("launchBtn").addEventListener("click", () => openEngines(currentPicks()));
  $("query").addEventListener("keydown", (e) => {
    if (e.key === "Enter") openEngines(currentPicks());
  });

  $("allBtn").addEventListener("click", async () => {
    const all = ENGINES.map((e) => e.id);
    await saveState(all);
    renderEngines(all);
  });
  $("noneBtn").addEventListener("click", async () => {
    await saveState([]);
    renderEngines([]);
  });

  $("query").focus();
});
