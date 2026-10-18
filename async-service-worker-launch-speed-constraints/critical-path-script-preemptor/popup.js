// popup.js — RenderLens. Runs the in-page scanner on user click, renders results.
// The scan only ever runs when the user presses "Scan this page".

const ICON_SCRIPT = '<svg class="item-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m16 18 6-6-6-6"/><path d="m8 6-6 6 6 6"/></svg>';
const ICON_STYLE = '<svg class="item-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="13.5" cy="6.5" r=".5"/><circle cx="17.5" cy="10.5" r=".5"/><circle cx="8.5" cy="7.5" r=".5"/><circle cx="6.5" cy="12.5" r=".5"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10a2.5 2.5 0 0 0 2.5-2.5c0-.6-.24-1.2-.65-1.65-.4-.45-.65-1-.65-1.6A2.5 2.5 0 0 0 15.75 14h2.75A4.5 4.5 0 0 0 23 9.5 7.5 7.5 0 0 0 12 2z"/></svg>';
const ICON_TIP = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18h6"/><path d="M10 22h4"/><path d="M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.4 1 2.3h6c0-.9.4-1.8 1-2.3A7 7 0 0 0 12 2z"/></svg>';

let lastResult = null;
let activeFilter = "all";

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("scanBtn").addEventListener("click", runScan);
  document.getElementById("rescanBtn").addEventListener("click", runScan);
  document.querySelectorAll(".chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      document.querySelectorAll(".chip").forEach((c) => c.classList.remove("active"));
      chip.classList.add("active");
      activeFilter = chip.dataset.filter;
      renderList();
    });
  });
  // Restore the most recent scan for convenience.
  chrome.storage.local.get(["renderlens:last"], (data) => {
    if (data["renderlens:last"]) {
      lastResult = data["renderlens:last"];
      renderAll();
    }
  });
});

async function runScan() {
  const btn = document.getElementById("scanBtn");
  btn.textContent = "Scanning…";
  btn.disabled = true;
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id || /^chrome/.test(tab.url || "")) {
      throw new Error("Cannot scan browser pages like chrome://");
    }
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["scanner.js"]
    });
    lastResult = result;
    chrome.storage.local.set({ "renderlens:last": result });
    renderAll();
  } catch (err) {
    document.getElementById("emptyState").innerHTML =
      '<p style="color:#ef4444">Could not scan this page: ' + escapeHtml(err.message) + "</p>" +
      '<button id="retryBtn" class="primary-btn">Try again</button>';
    document.getElementById("retryBtn").addEventListener("click", () => location.reload());
  } finally {
    btn.textContent = "Scan this page";
    btn.disabled = false;
  }
}

function renderAll() {
  document.getElementById("emptyState").classList.add("hidden");
  document.getElementById("results").classList.remove("hidden");

  const blocking = lastResult.items.filter((i) => i.blocking).length;
  document.getElementById("statBlocking").textContent = blocking;
  document.getElementById("statTotal").textContent = lastResult.items.length;
  document.getElementById("statHost").textContent = lastResult.host;

  const badge = document.getElementById("gradeBadge");
  badge.classList.remove("hidden");
  badge.textContent = lastResult.grade.label;
  badge.style.color = lastResult.grade.color;
  badge.style.borderColor = lastResult.grade.color;

  const tRow = document.getElementById("timingRow");
  if (lastResult.timing) {
    tRow.classList.remove("hidden");
    tRow.innerHTML =
      chip("First byte", lastResult.timing.firstByte + " ms") +
      chip("DOMContentLoaded", lastResult.timing.domContentLoaded + " ms") +
      chip("Load", lastResult.timing.load + " ms");
  }
  renderList();
}

function chip(label, value) {
  return '<span class="timing-chip">' + escapeHtml(label) + ' <b>' + escapeHtml(String(value)) + "</b></span>";
}

function renderList() {
  const list = document.getElementById("itemList");
  let items = lastResult.items;
  if (activeFilter === "blocking") items = items.filter((i) => i.blocking);
  if (activeFilter === "script") items = items.filter((i) => i.kind === "script");
  if (activeFilter === "stylesheet") items = items.filter((i) => i.kind === "stylesheet");

  if (items.length === 0) {
    list.innerHTML = '<p style="color:#9a9aa5;font-size:12px;text-align:center;padding:12px">' +
      escapeHtml(lastResult.grade.text) + "</p>";
    return;
  }

  list.innerHTML = items.map((item) => {
    const icon = item.kind === "script" ? ICON_SCRIPT : ICON_STYLE;
    const cls = item.blocking ? "blocking" : "clean";
    const tag = item.blocking ? "blocking" : "ok";
    const suggestions = item.suggestions
      .map((s) => '<div class="suggestion">' + ICON_TIP + "<span>" + escapeHtml(s) + "</span></div>")
      .join("");
    return (
      '<div class="item-card ' + cls + '">' +
        '<div class="item-top">' + icon +
          '<span class="item-name" title="' + escapeHtml(item.url) + '">' + escapeHtml(item.label) + "</span>" +
          '<span class="item-tag ' + cls + '">' + tag + "</span>" +
        "</div>" +
        '<div class="item-meta"><span>' + escapeHtml(item.size) + "</span><span>" +
          (item.durationMs != null ? item.durationMs + " ms" : "not in timing") + "</span></div>" +
        '<div class="item-notes">' + escapeHtml(item.notes) + "</div>" +
        suggestions +
      "</div>"
    );
  }).join("");
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[c]);
}
