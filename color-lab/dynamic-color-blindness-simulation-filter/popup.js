/* ChromaSim — color blindness simulation via SVG feColorMatrix on the active tab.
 * Everything runs on the user's explicit click (activeTab), is fully
 * reversible, and is clearly labeled a simulation/approximation — not a
 * medical test. No network. */

"use strict";

/* Machado et al. (2009) / common simulation matrices. Each is a 4x5 matrix. */
const MATRICES = {
  protanopia: [
    0.567, 0.433, 0.000, 0, 0,
    0.558, 0.442, 0.000, 0, 0,
    0.000, 0.242, 0.758, 0, 0,
    0.000, 0.000, 0.000, 1, 0,
  ],
  deuteranopia: [
    0.625, 0.375, 0.000, 0, 0,
    0.700, 0.300, 0.000, 0, 0,
    0.000, 0.300, 0.700, 0, 0,
    0.000, 0.000, 0.000, 1, 0,
  ],
  tritanopia: [
    0.950, 0.050, 0.000, 0, 0,
    0.000, 0.433, 0.567, 0, 0,
    0.000, 0.475, 0.525, 0, 0,
    0.000, 0.000, 0.000, 1, 0,
  ],
  achromatopsia: [
    0.299, 0.587, 0.114, 0, 0,
    0.299, 0.587, 0.114, 0, 0,
    0.299, 0.587, 0.114, 0, 0,
    0.000, 0.000, 0.000, 1, 0,
  ],
};

const STYLE_ID = "chromasim-simulation-filter";

/* ----- injected functions: fully self-contained (func + args only) ----- */

/** Apply the named simulation to the page. Runs inside the target tab. */
function applySimulation(mode) {
  const id = "chromasim-simulation-filter";
  const matrices = {
    protanopia: "0.567 0.433 0 0 0 0.558 0.442 0 0 0 0 0.242 0.758 0 0 0 0 0 1 0",
    deuteranopia: "0.625 0.375 0 0 0 0.7 0.3 0 0 0 0 0.3 0.7 0 0 0 0 0 1 0",
    tritanopia: "0.95 0.05 0 0 0 0 0.433 0.567 0 0 0 0.475 0.525 0 0 0 0 0 1 0",
    achromatopsia: "0.299 0.587 0.114 0 0 0.299 0.587 0.114 0 0 0.299 0.587 0.114 0 0 0 0 0 1 0",
  };
  const m = matrices[mode];
  if (!m) return { ok: false, error: "unknown mode" };
  let style = document.getElementById(id);
  if (!style) {
    style = document.createElement("style");
    style.id = id;
    (document.head || document.documentElement).appendChild(style);
  }
  style.textContent =
    "html.chromasim-on > body { filter: url(#chromasim-filter); }" +
    "/* ChromaSim simulation: " + mode + " (approximation) */";
  let svg = document.getElementById("chromasim-svg");
  if (!svg) {
    svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("id", "chromasim-svg");
    svg.setAttribute("width", "0");
    svg.setAttribute("height", "0");
    svg.style.position = "absolute";
    svg.innerHTML =
      '<defs><filter id="chromasim-filter">' +
      '<feColorMatrix type="matrix" values="' + m + '"/>' +
      "</filter></defs>";
    (document.head || document.documentElement).appendChild(svg);
  }
  document.documentElement.classList.add("chromasim-on");
  return { ok: true, mode };
}

/** Remove the simulation. Runs inside the target tab. */
function removeSimulation() {
  const id = "chromasim-simulation-filter";
  const style = document.getElementById(id);
  if (style) style.remove();
  const svg = document.getElementById("chromasim-svg");
  if (svg) svg.remove();
  document.documentElement.classList.remove("chromasim-on");
  return { ok: true };
}

/** Report whether a simulation is currently active. Runs inside the tab. */
function probeSimulation() {
  const style = document.getElementById("chromasim-simulation-filter");
  return { active: !!style };
}

/* ----- popup logic ----- */

const stateEl = document.getElementById("state");
const toastEl = document.getElementById("toast");
const modeBtns = Array.from(document.querySelectorAll(".mode"));
const restoreBtn = document.getElementById("restore");

function toast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add("show");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => toastEl.classList.remove("show"), 1700);
}

async function activeTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

function isRestricted(url) {
  return !url || /^(chrome|edge|about|chrome-extension|moz-extension):\/\//.test(url) ||
    /^https?:\/\/chrome\.google\.com\/webstore/.test(url);
}

async function runInTab(fn, args) {
  const tab = await activeTab();
  if (!tab || isRestricted(tab.url)) {
    toast("Restricted page — try a normal website");
    return null;
  }
  try {
    const [res] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: fn,
      args: args || [],
    });
    return res ? res.result : null;
  } catch (e) {
    toast("Could not access this page");
    return null;
  }
}

function setState(mode) {
  modeBtns.forEach((b) => b.classList.toggle("selected", b.dataset.mode === mode));
  if (mode) {
    stateEl.textContent = mode;
    stateEl.className = "state active";
  } else {
    stateEl.textContent = "idle";
    stateEl.className = "state idle";
  }
}

async function persist(mode) {
  try { await chrome.storage.local.set({ chromasim: { mode } }); } catch (e) {}
}

modeBtns.forEach((btn) => {
  btn.addEventListener("click", async () => {
    const mode = btn.dataset.mode;
    const res = await runInTab(applySimulation, [mode]);
    if (res && res.ok) {
      setState(mode);
      await persist(mode);
      toast("Simulating " + mode);
    }
  });
});

restoreBtn.addEventListener("click", async () => {
  const res = await runInTab(removeSimulation);
  if (res && res.ok) {
    setState(null);
    await persist(null);
    toast("Normal vision restored");
  }
});

/* Probe the tab on open so the UI reflects reality. */
(async () => {
  try {
    const saved = await chrome.storage.local.get("chromasim");
    const probe = await runInTab(probeSimulation);
    if (probe && probe.active && saved.chromasim && saved.chromasim.mode) {
      setState(saved.chromasim.mode);
    } else {
      setState(null);
    }
  } catch (e) {
    setState(null);
  }
})();
