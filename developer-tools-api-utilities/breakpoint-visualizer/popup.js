// Breakpoint Visualizer — popup logic: manage breakpoints, position, overlay toggle.

const DEFAULTS = [
  { name: "Mobile", min: 0 },
  { name: "Tablet", min: 640 },
  { name: "Desktop", min: 1024 },
  { name: "Wide", min: 1440 },
];

const $ = (id) => document.getElementById(id);

document.addEventListener("DOMContentLoaded", init);

async function init() {
  $("addBp").addEventListener("click", addBreakpoint);
  $("position").addEventListener("change", async (e) => {
    const s = await getSettings();
    s.position = e.target.value;
    await chrome.storage.local.set({ bv: s });
  });
  $("toggle").addEventListener("click", toggleOverlay);
  const s = await getSettings();
  $("position").value = s.position;
  renderBps(s.breakpoints);
}

async function getSettings() {
  const { bv } = await chrome.storage.local.get("bv");
  if (bv && Array.isArray(bv.breakpoints)) return bv;
  return { breakpoints: [...DEFAULTS], position: "bottom-right" };
}

async function addBreakpoint() {
  const name = $("bpName").value.trim();
  const min = parseInt($("bpMin").value, 10);
  if (!name || isNaN(min) || min < 0) {
    $("bpName").focus();
    return;
  }
  const s = await getSettings();
  s.breakpoints.push({ name: name.slice(0, 24), min });
  s.breakpoints.sort((a, b) => a.min - b.min);
  await chrome.storage.local.set({ bv: s });
  $("bpName").value = "";
  $("bpMin").value = "";
  renderBps(s.breakpoints);
}

function renderBps(bps) {
  const box = $("bps");
  box.innerHTML = "";
  bps.forEach((bp, i) => {
    const row = document.createElement("div");
    row.className = "bp";
    const nm = document.createElement("div");
    nm.className = "nm";
    nm.textContent = bp.name;
    const min = document.createElement("span");
    min.className = "min";
    min.textContent = "≥ " + bp.min + "px";
    const x = document.createElement("button");
    x.className = "x";
    x.textContent = "×";
    x.title = "Remove";
    x.addEventListener("click", async () => {
      const s = await getSettings();
      s.breakpoints.splice(i, 1);
      await chrome.storage.local.set({ bv: s });
      renderBps(s.breakpoints);
    });
    row.append(nm, min, x);
    box.appendChild(row);
  });
}

async function toggleOverlay() {
  const btn = $("toggle");
  const hint = $("hint");
  hint.hidden = true;
  btn.disabled = true;
  btn.textContent = "Working…";
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id) throw new Error("no-tab");
    // overlay.js toggles itself: removes if present, renders if absent.
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["overlay.js"] });
    window.close();
  } catch (e) {
    hint.hidden = false;
    hint.textContent = "Can’t inject on this page (e.g. chrome:// or the web store). Try a regular website.";
  } finally {
    btn.disabled = false;
    btn.textContent = "Toggle overlay on this tab";
  }
}
