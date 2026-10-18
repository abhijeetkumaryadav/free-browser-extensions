/* Instagram Grid Aspect Ratio Planner — pure client-side grid tool.
 * Images are previewed via object URLs and never leave the device.
 * Layout order is persisted to chrome.storage.local (metadata only). */

const $ = (id) => document.getElementById(id);
const MAX_ITEMS = 9;

// IG recommended ratios: [label, value, description]
const PRESETS = [
  { label: "1:1", value: 1, desc: "Square post" },
  { label: "4:5", value: 4 / 5, desc: "Portrait post" },
  { label: "1.91:1", value: 1.91, desc: "Landscape post" },
];
const TOLERANCE = 0.02; // 2% — close enough to an IG preset

let items = []; // {id, name, url, w, h}
let uid = 0;
let dragIdx = null;

/** Greatest common divisor for simplified ratios. */
function gcd(a, b) {
  return b ? gcd(b, a % b) : a;
}

function simplifiedRatio(w, h) {
  const g = gcd(w, h) || 1;
  return `${w / g}:${h / g}`;
}

/** Match the image ratio against IG presets. */
function matchPreset(w, h) {
  const r = w / h;
  let best = null;
  for (const p of PRESETS) {
    const diff = Math.abs(r - p.value) / p.value;
    if (diff <= TOLERANCE && (!best || diff < best.diff)) best = { ...p, diff };
  }
  return best;
}

/** Load image dimensions for a File, resolving {w, h, url}. */
function probeImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight, url });
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("unreadable"));
    };
    img.src = url;
  });
}

function toast(msg) {
  const t = $("toast");
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(t._timer);
  t._timer = setTimeout(() => (t.hidden = true), 1800);
}

function hint(msg) {
  const h = $("hint");
  h.textContent = msg || "";
  h.hidden = !msg;
  if (msg) setTimeout(() => (h.hidden = true), 3500);
}

/** Add files, respecting the 9-image cap. */
async function addFiles(fileList) {
  const files = Array.from(fileList).filter((f) => f.type.startsWith("image/"));
  if (!files.length) {
    hint("No image files in that selection.");
    return;
  }
  const room = MAX_ITEMS - items.length;
  if (room <= 0) {
    hint(`Grid is full — remove an image to add more (max ${MAX_ITEMS}).`);
    return;
  }
  if (files.length > room) hint(`Only ${room} more fit — added the first ${room}.`);
  for (const file of files.slice(0, room)) {
    try {
      const { w, h, url } = await probeImage(file);
      items.push({ id: ++uid, name: file.name, url, w, h });
    } catch {
      hint(`Skipped an unreadable file: ${file.name}`);
    }
  }
  render();
  persist();
}

/** Render the 3-column grid with badges and drag handles. */
function render() {
  const grid = $("grid");
  grid.innerHTML = "";
  $("empty").style.display = items.length ? "none" : "";
  $("count").textContent = `${items.length}/${MAX_ITEMS}`;
  $("exportBtn").disabled = !items.length;
  $("clearBtn").disabled = !items.length;

  items.forEach((it, idx) => {
    const preset = matchPreset(it.w, it.h);
    const tile = document.createElement("div");
    tile.className = "tile";
    tile.draggable = true;
    tile.dataset.idx = idx;
    tile.title = `${it.name} — ${it.w}×${it.h} (drag to reorder)`;

    const img = document.createElement("img");
    img.src = it.url;
    img.alt = it.name;
    tile.appendChild(img);

    const ratio = document.createElement("span");
    ratio.className = "ratio";
    ratio.textContent = simplifiedRatio(it.w, it.h);
    tile.appendChild(ratio);

    const badge = document.createElement("span");
    badge.className = "badge" + (preset ? "" : " custom");
    badge.textContent = preset ? `${preset.label} · ${preset.desc}` : "Custom ratio";
    tile.appendChild(badge);

    const rm = document.createElement("button");
    rm.className = "rm";
    rm.textContent = "×";
    rm.title = "Remove";
    rm.addEventListener("click", (e) => {
      e.stopPropagation();
      URL.revokeObjectURL(it.url);
      items.splice(idx, 1);
      render();
      persist();
    });
    tile.appendChild(rm);

    // Drag-to-reorder (HTML5 DnD)
    tile.addEventListener("dragstart", (e) => {
      dragIdx = idx;
      tile.classList.add("dragging");
      e.dataTransfer.effectAllowed = "move";
    });
    tile.addEventListener("dragend", () => {
      tile.classList.remove("dragging");
      grid.querySelectorAll(".drop-target").forEach((t) => t.classList.remove("drop-target"));
    });
    tile.addEventListener("dragover", (e) => {
      e.preventDefault();
      tile.classList.add("drop-target");
    });
    tile.addEventListener("dragleave", () => tile.classList.remove("drop-target"));
    tile.addEventListener("drop", (e) => {
      e.preventDefault();
      if (dragIdx === null || dragIdx === idx) return;
      const [moved] = items.splice(dragIdx, 1);
      items.splice(idx, 0, moved);
      dragIdx = null;
      render();
      persist();
    });

    grid.appendChild(tile);
  });
}

/** Copy the planned order as JSON. */
async function exportPlan() {
  const plan = items.map((it, i) => {
    const preset = matchPreset(it.w, it.h);
    return {
      position: i + 1,
      name: it.name,
      dimensions: `${it.w}x${it.h}`,
      ratio: simplifiedRatio(it.w, it.h),
      ig_preset: preset ? `${preset.label} (${preset.desc})` : "custom",
    };
  });
  try {
    await navigator.clipboard.writeText(JSON.stringify(plan, null, 2));
    toast("Plan copied to clipboard");
  } catch {
    toast("Clipboard blocked — copy manually");
  }
}

function clearAll() {
  items.forEach((it) => URL.revokeObjectURL(it.url));
  items = [];
  render();
  persist();
}

/** Persist metadata only (no image bytes) so order survives popup reopen. */
function persist() {
  chrome.storage.local.set({
    igp_order: items.map((it) => ({ name: it.name, w: it.w, h: it.h })),
  });
}

// --- Wiring ---
$("fileInput").addEventListener("change", (e) => {
  addFiles(e.target.files);
  e.target.value = ""; // allow re-selecting the same file
});

const dz = $("dropzone");
["dragenter", "dragover"].forEach((ev) =>
  dz.addEventListener(ev, (e) => {
    e.preventDefault();
    dz.classList.add("over");
  })
);
["dragleave", "drop"].forEach((ev) =>
  dz.addEventListener(ev, (e) => {
    e.preventDefault();
    dz.classList.remove("over");
  })
);
dz.addEventListener("drop", (e) => addFiles(e.dataTransfer.files));

$("exportBtn").addEventListener("click", exportPlan);
$("clearBtn").addEventListener("click", clearAll);

render();
