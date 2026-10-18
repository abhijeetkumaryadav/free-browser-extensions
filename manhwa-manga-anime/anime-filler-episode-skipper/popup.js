/* FillerSkip — static anime filler guide.
   Dataset compiled Oct 2026 from commonly cited filler lists (animefillerlist-style).
   Ranges are APPROXIMATE — users should verify against an up-to-date list.
   Everything runs on-device; only permission used is `storage` (custom series). */

"use strict";

/* Range format: [fromEpisode, toEpisode, type] where type ∈ canon | mixed | filler */
const BUILTIN_SERIES = [
  {
    id: "naruto",
    name: "Naruto",
    total: 220,
    updated: "2026-10",
    ranges: [
      [1, 100, "canon"],
      [101, 103, "mixed"],
      [104, 107, "canon"],
      [108, 109, "mixed"],
      [110, 135, "canon"],
      [136, 219, "filler"],
      [220, 220, "mixed"],
    ],
  },
  {
    id: "naruto-shippuden",
    name: "Naruto Shippuden",
    total: 500,
    updated: "2026-10",
    ranges: [
      [1, 27, "canon"], [28, 28, "mixed"], [29, 53, "canon"], [54, 54, "mixed"],
      [55, 71, "filler"], [72, 88, "canon"], [89, 89, "mixed"], [90, 112, "filler"],
      [113, 143, "canon"], [144, 144, "mixed"], [145, 151, "filler"],
      [152, 169, "canon"], [170, 171, "filler"], [172, 175, "canon"],
      [176, 176, "mixed"], [177, 196, "filler"], [197, 221, "canon"],
      [222, 222, "mixed"], [223, 241, "filler"], [242, 242, "mixed"],
      [243, 256, "canon"], [257, 257, "mixed"], [258, 259, "filler"],
      [260, 260, "mixed"], [261, 270, "canon"], [271, 271, "mixed"],
      [272, 278, "canon"], [279, 279, "mixed"], [280, 280, "filler"],
      [281, 281, "mixed"], [282, 283, "canon"], [284, 284, "mixed"],
      [285, 294, "filler"], [295, 295, "mixed"], [296, 302, "canon"],
      [303, 303, "mixed"], [304, 319, "filler"], [320, 320, "mixed"],
      [321, 346, "canon"], [347, 347, "mixed"], [348, 360, "filler"],
      [361, 361, "mixed"], [362, 375, "canon"], [376, 377, "mixed"],
      [378, 387, "canon"], [388, 388, "mixed"], [389, 389, "filler"],
      [390, 390, "mixed"], [391, 393, "canon"], [394, 394, "mixed"],
      [395, 412, "filler"], [413, 413, "mixed"], [414, 415, "canon"],
      [416, 417, "mixed"], [418, 421, "canon"], [422, 423, "mixed"],
      [424, 426, "canon"], [427, 427, "mixed"], [428, 482, "filler"],
      [483, 483, "mixed"], [484, 500, "canon"],
    ],
  },
  {
    id: "one-piece",
    name: "One Piece",
    total: 1100,
    updated: "2026-10",
    ranges: [
      [50, 50, "mixed"], [54, 61, "filler"], [93, 93, "mixed"],
      [98, 99, "filler"], [101, 102, "filler"], [131, 143, "filler"],
      [196, 206, "filler"], [213, 214, "mixed"], [220, 225, "filler"],
      [227, 227, "mixed"], [279, 283, "filler"], [291, 292, "filler"],
      [299, 302, "mixed"], [303, 303, "filler"], [304, 304, "mixed"],
      [317, 319, "filler"], [326, 336, "filler"], [369, 369, "mixed"],
      [371, 371, "mixed"], [376, 377, "mixed"], [382, 384, "filler"],
      [405, 405, "mixed"], [406, 407, "filler"], [425, 425, "mixed"],
      [426, 429, "filler"], [430, 431, "mixed"], [456, 456, "mixed"],
      [457, 458, "filler"], [491, 491, "mixed"], [492, 492, "filler"],
      [498, 498, "mixed"], [499, 500, "filler"], [501, 501, "mixed"],
      [505, 505, "mixed"], [506, 506, "filler"], [520, 522, "filler"],
      [523, 523, "mixed"], [574, 574, "mixed"], [575, 578, "filler"],
      [589, 589, "mixed"], [590, 590, "filler"], [625, 625, "mixed"],
      [626, 628, "filler"], [629, 629, "mixed"], [652, 652, "mixed"],
      [653, 654, "filler"], [655, 655, "mixed"], [750, 750, "mixed"],
      [751, 752, "filler"], [753, 753, "mixed"], [774, 774, "mixed"],
      [775, 776, "filler"], [777, 777, "mixed"], [779, 779, "mixed"],
      [780, 782, "filler"], [783, 783, "mixed"], [894, 894, "mixed"],
      [895, 896, "filler"], [897, 897, "mixed"], [906, 906, "mixed"],
      [907, 907, "filler"], [908, 908, "mixed"], [1028, 1028, "mixed"],
      [1029, 1030, "filler"], [1031, 1031, "mixed"],
    ],
  },
  {
    id: "bleach",
    name: "Bleach",
    total: 366,
    updated: "2026-10",
    ranges: [
      [33, 33, "filler"], [50, 50, "filler"], [64, 91, "filler"],
      [92, 92, "mixed"], [98, 98, "mixed"], [106, 108, "filler"],
      [109, 109, "mixed"], [128, 137, "filler"], [138, 138, "mixed"],
      [146, 146, "mixed"], [147, 149, "filler"], [150, 150, "mixed"],
      [167, 167, "mixed"], [168, 189, "filler"], [190, 190, "mixed"],
      [203, 203, "mixed"], [204, 205, "filler"], [206, 206, "mixed"],
      [212, 212, "mixed"], [213, 214, "filler"], [215, 215, "mixed"],
      [227, 227, "mixed"], [228, 229, "filler"], [230, 265, "filler"],
      [266, 266, "mixed"], [286, 286, "mixed"], [287, 287, "filler"],
      [288, 288, "mixed"], [297, 297, "mixed"], [298, 299, "filler"],
      [300, 300, "mixed"], [302, 302, "mixed"], [303, 305, "filler"],
      [306, 306, "mixed"], [310, 310, "mixed"], [311, 342, "filler"],
      [343, 343, "mixed"], [354, 354, "mixed"], [355, 355, "filler"],
      [356, 356, "mixed"],
    ],
  },
  {
    id: "dragon-ball-z",
    name: "Dragon Ball Z",
    total: 291,
    updated: "2026-10",
    ranges: [
      [9, 17, "filler"], [39, 44, "filler"], [100, 101, "mixed"],
      [102, 104, "filler"], [105, 105, "mixed"], [108, 117, "filler"],
      [123, 123, "mixed"], [124, 125, "filler"], [170, 171, "filler"],
      [172, 173, "mixed"], [174, 174, "filler"], [195, 199, "filler"],
      [200, 201, "mixed"], [202, 203, "filler"], [274, 287, "filler"],
      [288, 289, "mixed"],
    ],
  },
];

const TYPE_LABEL = {
  canon: "CANON",
  mixed: "MIXED",
  filler: "FILLER",
  unknown: "UNKNOWN",
};

const TYPE_NOTE = {
  canon: (ep) => `Episode ${ep} is canon — adapts the manga. Watch it for the main story.`,
  mixed: (ep) => `Episode ${ep} is mixed canon/filler — main story with anime-original padding.`,
  filler: (ep) => `Episode ${ep} is filler — anime-original. Skippable without missing the plot.`,
  unknown: (ep) => `Episode ${ep} isn't in the dataset — it may be outside the covered range.`,
};

/* ---------- storage ---------- */
const store = {
  async get(keys) {
    try { return await chrome.storage.local.get(keys); } catch { return {}; }
  },
  async set(obj) {
    try { await chrome.storage.local.set(obj); } catch { /* ignore */ }
  },
};

function allSeries(custom) {
  return [...BUILTIN_SERIES, ...(custom || []).map((c) => ({ ...c, custom: true }))];
}

/* ---------- lookup ---------- */
function lookup(series, ep) {
  for (const [from, to, type] of series.ranges) {
    if (ep >= from && ep <= to) return type;
  }
  return "unknown";
}

function stats(series) {
  const counts = { canon: 0, mixed: 0, filler: 0 };
  for (const [from, to, type] of series.ranges) {
    if (counts[type] !== undefined) counts[type] += to - from + 1;
  }
  return counts;
}

/* ---------- ui ---------- */
const $ = (id) => document.getElementById(id);
let seriesList = [];

function currentSeries() {
  return seriesList.find((s) => s.id === $("series").value);
}

function renderStats(series) {
  const c = stats(series);
  $("statCanon").textContent = c.canon;
  $("statMixed").textContent = c.mixed;
  $("statFiller").textContent = c.filler;
  const covered = c.canon + c.mixed + c.filler;
  $("stats").title = `${covered} of ${series.total} episodes classified`;
  // Show delete button only for custom series
  $("deleteCustom").classList.toggle("hidden", !series.custom);
  if (series.custom) {
    $("customName").value = series.name;
    $("customTotal").value = series.total;
    $("customRanges").value = series.ranges.map(([f, t, ty]) => `${f}-${t} ${ty}`).join("\n");
  }
}

function check() {
  const series = currentSeries();
  const ep = parseInt($("episode").value, 10);
  const result = $("result");
  if (!series || !Number.isInteger(ep) || ep < 1) {
    result.classList.add("hidden");
    return;
  }
  const type = ep > series.total ? "unknown" : lookup(series, ep);
  const badge = $("badge");
  badge.className = "badge " + type;
  badge.textContent = TYPE_LABEL[type];
  $("resultTitle").textContent = `${series.name} — Episode ${ep}`;
  $("resultNote").textContent = TYPE_NOTE[type](ep);
  result.classList.remove("hidden");
}

/* ---------- custom series ---------- */
const RANGE_RE = /^(\d+)\s*-\s*(\d+)\s+(canon|mixed|filler)$/i;

function parseRanges(text, total) {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  if (!lines.length) throw new Error("Add at least one range line.");
  const ranges = [];
  for (const line of lines) {
    const m = line.match(RANGE_RE);
    if (!m) throw new Error(`Bad line: "${line}" — use "from-to type".`);
    const from = parseInt(m[1], 10), to = parseInt(m[2], 10);
    const type = m[3].toLowerCase();
    if (from < 1 || to > total || from > to)
      throw new Error(`Range ${from}-${to} is out of bounds for ${total} episodes.`);
    ranges.push([from, to, type]);
  }
  // overlap check
  const sorted = [...ranges].sort((a, b) => a[0] - b[0]);
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i][0] <= sorted[i - 1][1])
      throw new Error(`Overlapping ranges: ${sorted[i - 1][0]}-${sorted[i - 1][1]} and ${sorted[i][0]}-${sorted[i][1]}.`);
  }
  return ranges;
}

async function saveCustom() {
  const err = $("customError");
  err.classList.add("hidden");
  try {
    const name = $("customName").value.trim();
    const total = parseInt($("customTotal").value, 10);
    if (!name) throw new Error("Give the series a name.");
    if (!Number.isInteger(total) || total < 1) throw new Error("Total episodes must be a positive number.");
    const ranges = parseRanges($("customRanges").value, total);
    const { customSeries = [] } = await store.get(["customSeries"]);
    const existing = currentSeries();
    const entry = {
      id: existing && existing.custom ? existing.id : "custom-" + Date.now(),
      name, total, updated: "custom", ranges,
    };
    const idx = customSeries.findIndex((c) => c.id === entry.id);
    if (idx >= 0) customSeries[idx] = entry; else customSeries.push(entry);
    await store.set({ customSeries, lastSeries: entry.id });
    await init();
    err.classList.add("hidden");
  } catch (e) {
    err.textContent = e.message;
    err.classList.remove("hidden");
  }
}

async function deleteCustom() {
  const series = currentSeries();
  if (!series || !series.custom) return;
  const { customSeries = [] } = await store.get(["customSeries"]);
  await store.set({
    customSeries: customSeries.filter((c) => c.id !== series.id),
    lastSeries: BUILTIN_SERIES[0].id,
  });
  await init();
}

/* ---------- init ---------- */
async function init() {
  const { customSeries = [], lastSeries } = await store.get(["customSeries", "lastSeries"]);
  seriesList = allSeries(customSeries);
  const sel = $("series");
  sel.innerHTML = "";
  for (const s of seriesList) {
    const opt = document.createElement("option");
    opt.value = s.id;
    opt.textContent = s.name + (s.custom ? " (custom)" : "");
    sel.appendChild(opt);
  }
  sel.value = seriesList.some((s) => s.id === lastSeries) ? lastSeries : seriesList[0].id;
  renderStats(currentSeries());
}

document.addEventListener("DOMContentLoaded", async () => {
  await init();
  $("check").addEventListener("click", check);
  $("episode").addEventListener("keydown", (e) => { if (e.key === "Enter") check(); });
  $("series").addEventListener("change", async () => {
    await store.set({ lastSeries: $("series").value });
    $("result").classList.add("hidden");
    $("episode").value = "";
    renderStats(currentSeries());
  });
  $("toggleCustom").addEventListener("click", () => {
    const form = $("customForm");
    const open = form.classList.toggle("hidden");
    $("toggleCustom").setAttribute("aria-expanded", String(!open));
  });
  $("saveCustom").addEventListener("click", saveCustom);
  $("deleteCustom").addEventListener("click", deleteCustom);
});
