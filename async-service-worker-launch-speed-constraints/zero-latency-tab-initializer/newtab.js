// newtab.js — Warp. Fully local speed-dial: shortcuts, search, clock, themes.
// No network calls are made by this page; the only navigation is the search
// the user explicitly submits, or a shortcut they click.

const STORE_KEY = "warp:settings";

const DEFAULTS = {
  theme: "dark",
  showClock: true,
  engine: "https://www.google.com/search?q=%s",
  shortcuts: [
    { name: "YouTube", url: "https://www.youtube.com" },
    { name: "GitHub", url: "https://github.com" },
    { name: "Gmail", url: "https://mail.google.com" },
    { name: "Maps", url: "https://maps.google.com" },
    { name: "Drive", url: "https://drive.google.com" },
    { name: "News", url: "https://news.google.com" }
  ]
};

let settings = load();

function load() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return structuredClone(DEFAULTS);
    const parsed = JSON.parse(raw);
    return Object.assign(structuredClone(DEFAULTS), parsed);
  } catch (e) {
    return structuredClone(DEFAULTS);
  }
}

function save() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(settings)); } catch (e) { /* storage full — ignore */ }
}

// Prefer chrome.storage when available (syncs nowhere, stays local).
if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
  chrome.storage.local.get([STORE_KEY], (data) => {
    if (data[STORE_KEY]) {
      settings = Object.assign(structuredClone(DEFAULTS), data[STORE_KEY]);
      applyAll();
    }
  });
  const origSave = save;
  save = function () {
    origSave();
    try { chrome.storage.local.set({ [STORE_KEY]: settings }); } catch (e) { /* ignore */ }
  };
}

// ---------- Clock ----------
function tickClock() {
  const clockEl = document.getElementById("clock");
  const dateEl = document.getElementById("dateLine");
  if (!settings.showClock) {
    clockEl.style.display = "none";
    dateEl.style.display = "none";
    return;
  }
  clockEl.style.display = "";
  dateEl.style.display = "";
  const now = new Date();
  clockEl.textContent =
    String(now.getHours()).padStart(2, "0") + ":" + String(now.getMinutes()).padStart(2, "0");
  dateEl.textContent = now.toLocaleDateString(undefined, {
    weekday: "long", month: "long", day: "numeric"
  });
}

// ---------- Shortcuts grid ----------
function glyphFor(name) {
  const clean = (name || "?").trim();
  return escapeHtml(clean.charAt(0).toUpperCase() || "?");
}

function renderGrid() {
  const grid = document.getElementById("shortcutGrid");
  if (!settings.shortcuts.length) {
    grid.innerHTML = '<div class="empty-grid">No shortcuts yet — open Settings (gear icon) to add some.</div>';
    return;
  }
  grid.innerHTML = settings.shortcuts
    .map((s) => {
      const safeUrl = normalizeUrl(s.url);
      return (
        '<a class="tile" href="' + escapeHtml(safeUrl) + '">' +
          '<div class="tile-glyph">' + glyphFor(s.name) + "</div>" +
          '<div class="tile-name">' + escapeHtml(s.name) + "</div>" +
        "</a>"
      );
    })
    .join("");
}

// Only http(s) shortcuts are accepted — blocks javascript: and friends.
function normalizeUrl(raw) {
  let u = String(raw || "").trim();
  if (!/^https?:\/\//i.test(u)) u = "https://" + u;
  try {
    const parsed = new URL(u);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return "https://example.com";
    return parsed.href;
  } catch (e) {
    return "https://example.com";
  }
}

// ---------- Search ----------
function bindSearch() {
  document.getElementById("searchForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const q = document.getElementById("searchInput").value.trim();
    if (!q) return;
    // Bare domains / URLs navigate directly; everything else goes to the engine.
    if (/^[\w-]+(\.[\w-]+)+(\/\S*)?$/.test(q) && !/\s/.test(q)) {
      location.href = normalizeUrl(q);
    } else {
      location.href = settings.engine.replace("%s", encodeURIComponent(q));
    }
  });
}

// ---------- Theme ----------
function applyTheme() {
  document.body.classList.toggle("light", settings.theme === "light");
  document.getElementById("themeIcon").innerHTML =
    settings.theme === "light"
      ? '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>'
      : '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>';
}

// ---------- Settings ----------
function renderEditor() {
  const ed = document.getElementById("shortcutEditor");
  ed.innerHTML = settings.shortcuts
    .map((s, i) =>
      '<div class="shortcut-row">' +
        '<span class="s-name">' + escapeHtml(s.name) + "</span>" +
        '<span class="s-url">' + escapeHtml(s.url) + "</span>" +
        '<button class="del-btn" data-i="' + i + '" title="Remove" aria-label="Remove">×</button>' +
      "</div>"
    )
    .join("");
  ed.querySelectorAll(".del-btn").forEach((b) =>
    b.addEventListener("click", () => {
      settings.shortcuts.splice(Number(b.dataset.i), 1);
      save();
      renderGrid();
      renderEditor();
    })
  );
}

function bindSettings() {
  const panel = document.getElementById("settingsPanel");
  document.getElementById("settingsBtn").addEventListener("click", () => {
    document.getElementById("engineSelect").value = settings.engine;
    document.getElementById("clockToggle").checked = settings.showClock;
    renderEditor();
    panel.classList.remove("hidden");
  });
  document.getElementById("closeSettingsBtn").addEventListener("click", () => {
    panel.classList.add("hidden");
  });
  panel.addEventListener("click", (e) => {
    if (e.target === panel) panel.classList.add("hidden");
  });

  document.getElementById("engineSelect").addEventListener("change", (e) => {
    settings.engine = e.target.value;
    save();
  });
  document.getElementById("clockToggle").addEventListener("change", (e) => {
    settings.showClock = e.target.checked;
    save();
    tickClock();
  });

  document.getElementById("addShortcutBtn").addEventListener("click", () => {
    const name = document.getElementById("newName").value.trim();
    const url = document.getElementById("newUrl").value.trim();
    if (!name || !url) return;
    settings.shortcuts.push({ name: name.slice(0, 24), url });
    document.getElementById("newName").value = "";
    document.getElementById("newUrl").value = "";
    save();
    renderGrid();
    renderEditor();
  });

  document.getElementById("resetBtn").addEventListener("click", () => {
    settings = structuredClone(DEFAULTS);
    save();
    applyAll();
  });

  document.getElementById("themeBtn").addEventListener("click", () => {
    settings.theme = settings.theme === "light" ? "dark" : "light";
    save();
    applyTheme();
  });
}

function applyAll() {
  applyTheme();
  tickClock();
  renderGrid();
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[c]);
}

document.addEventListener("DOMContentLoaded", () => {
  bindSearch();
  bindSettings();
  applyAll();
  setInterval(tickClock, 10000);
});
