/* GradCraft — visual CSS gradient builder. All logic local, state persisted via chrome.storage.local. */
"use strict";

const DEFAULT_STATE = {
  type: "linear",          // "linear" | "radial"
  angle: 90,               // degrees, linear only
  shape: "circle",         // radial only
  stops: [
    { color: "#a855f7", position: 0 },
    { color: "#ec4899", position: 50 },
    { color: "#f59e0b", position: 100 }
  ]
};

const MAX_STOPS = 8;
let state = structuredClone(DEFAULT_STATE);

// --- Element handles ---
const $ = (id) => document.getElementById(id);
const els = {
  preview: $("preview"), cssOut: $("cssOut"), stops: $("stops"),
  linearBtn: $("linearBtn"), radialBtn: $("radialBtn"),
  angle: $("angle"), angleVal: $("angleVal"), angleWrap: $("angleWrap"),
  shapeWrap: $("shapeWrap"), circleBtn: $("circleBtn"), ellipseBtn: $("ellipseBtn"),
  addStop: $("addStop"), copyBtn: $("copyBtn"), copyNote: $("copyNote"),
  randomBtn: $("randomBtn")
};

// --- Persistence ---
function save() {
  chrome.storage.local.set({ gradcraft: state });
}
function load() {
  chrome.storage.local.get("gradcraft", (res) => {
    if (res.gradcraft && Array.isArray(res.gradcraft.stops)) {
      state = { ...structuredClone(DEFAULT_STATE), ...res.gradcraft };
      if (!state.stops.length) state.stops = structuredClone(DEFAULT_STATE.stops);
    }
    els.angle.value = state.angle;
    render();
  });
}

// --- Gradient generation ---
function sortedStops() {
  return [...state.stops].sort((a, b) => a.position - b.position);
}

function buildCss() {
  const stopStr = sortedStops()
    .map((s) => `${s.color} ${Math.round(s.position)}%`)
    .join(", ");
  if (state.type === "linear") {
    return `linear-gradient(${state.angle}deg, ${stopStr})`;
  }
  return `radial-gradient(${state.shape}, ${stopStr})`;
}

function applyPreview() {
  const css = buildCss();
  els.preview.style.background = css;
  els.cssOut.textContent = `background: ${css};`;
}

// --- Rendering the stop list ---
function render() {
  // type toggle
  els.linearBtn.classList.toggle("active", state.type === "linear");
  els.radialBtn.classList.toggle("active", state.type === "radial");
  els.angleWrap.classList.toggle("hidden", state.type !== "linear");
  els.shapeWrap.classList.toggle("hidden", state.type !== "radial");
  els.circleBtn.classList.toggle("active", state.shape === "circle");
  els.ellipseBtn.classList.toggle("active", state.shape === "ellipse");
  els.angleVal.textContent = `${state.angle}°`;

  // stop rows
  els.stops.innerHTML = "";
  state.stops.forEach((stop, idx) => {
    const li = document.createElement("li");
    li.className = "stop";

    const color = document.createElement("input");
    color.type = "color";
    color.className = "stop-color";
    color.value = stop.color;
    color.title = `Stop ${idx + 1} color`;
    color.setAttribute("aria-label", `Stop ${idx + 1} color`);
    color.addEventListener("input", (e) => {
      stop.color = e.target.value;
      hexLabel.textContent = stop.color;
      applyPreview();
      save();
    });

    const posWrap = document.createElement("div");
    posWrap.className = "stop-pos";
    const head = document.createElement("div");
    head.className = "pos-head";
    const hexLabel = document.createElement("span");
    hexLabel.className = "hex";
    hexLabel.textContent = stop.color;
    const posLabel = document.createElement("span");
    posLabel.textContent = `${Math.round(stop.position)}%`;
    head.append(hexLabel, posLabel);

    const slider = document.createElement("input");
    slider.type = "range";
    slider.min = "0"; slider.max = "100";
    slider.value = stop.position;
    slider.setAttribute("aria-label", `Stop ${idx + 1} position`);
    slider.addEventListener("input", (e) => {
      stop.position = Number(e.target.value);
      posLabel.textContent = `${stop.position}%`;
      applyPreview();
      save();
    });
    posWrap.append(head, slider);

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "stop-remove";
    remove.title = "Remove stop";
    remove.disabled = state.stops.length <= 2;
    remove.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>`;
    remove.addEventListener("click", () => {
      if (state.stops.length <= 2) return;
      state.stops.splice(idx, 1);
      render(); applyPreview(); save();
    });

    li.append(color, posWrap, remove);
    els.stops.appendChild(li);
  });

  els.addStop.disabled = state.stops.length >= MAX_STOPS;
  els.addStop.style.opacity = state.stops.length >= MAX_STOPS ? 0.4 : 1;
  applyPreview();
}

// --- Events ---
els.linearBtn.addEventListener("click", () => { state.type = "linear"; render(); save(); });
els.radialBtn.addEventListener("click", () => { state.type = "radial"; render(); save(); });
els.circleBtn.addEventListener("click", () => { state.shape = "circle"; render(); save(); });
els.ellipseBtn.addEventListener("click", () => { state.shape = "ellipse"; render(); save(); });
els.angle.addEventListener("input", (e) => {
  state.angle = Number(e.target.value);
  els.angleVal.textContent = `${state.angle}°`;
  applyPreview(); save();
});

els.addStop.addEventListener("click", () => {
  if (state.stops.length >= MAX_STOPS) return;
  // Insert midway between the two most central stops for a sensible default.
  const sorted = sortedStops();
  let mid = 50;
  if (sorted.length >= 2) {
    let best = null;
    for (let i = 0; i < sorted.length - 1; i++) {
      const gap = sorted[i + 1].position - sorted[i].position;
      if (!best || gap > best.gap) best = { gap, lo: sorted[i], hi: sorted[i + 1] };
    }
    if (best) mid = Math.round((best.lo.position + best.hi.position) / 2);
  }
  state.stops.push({ color: "#ffffff", position: mid });
  render(); applyPreview(); save();
});

// Random palette from a curated hue-friendly set — always looks decent.
els.randomBtn.addEventListener("click", () => {
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const hues = [pick(["#a855f7", "#8b5cf6", "#6366f1"]), pick(["#ec4899", "#f43f5e", "#fb7185"]), pick(["#f59e0b", "#f97316", "#eab308"]), pick(["#22d3ee", "#38bdf8", "#34d399"])];
  hues.sort(() => Math.random() - 0.5);
  const count = 2 + Math.floor(Math.random() * 2); // 2–3 stops
  state.stops = hues.slice(0, count).map((c, i) => ({
    color: c, position: Math.round((i / (count - 1)) * 100)
  }));
  state.angle = Math.floor(Math.random() * 360);
  els.angle.value = state.angle;
  render(); applyPreview(); save();
});

async function copyCss() {
  const text = els.cssOut.textContent;
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    // Fallback for contexts where the Clipboard API is unavailable.
    const ta = document.createElement("textarea");
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    ta.remove();
  }
  els.copyNote.classList.remove("hidden");
  setTimeout(() => els.copyNote.classList.add("hidden"), 1600);
}
els.copyBtn.addEventListener("click", copyCss);

// --- Init ---
load();
