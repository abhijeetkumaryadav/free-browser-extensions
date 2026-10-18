// Address Permutation Verifier — popup logic. All on-device.

// Common street/designator abbreviations expanded before comparison.
const ABBREV = {
  "st": "street", "ave": "avenue", "av": "avenue", "rd": "road",
  "blvd": "boulevard", "dr": "drive", "ln": "lane", "ct": "court",
  "pl": "place", "pkwy": "parkway", "hwy": "highway", "trl": "trail",
  "apt": "apartment", "ste": "suite", "fl": "floor", "rm": "room",
  "bldg": "building", "dept": "department", "no": "number", "n": "north",
  "s": "south", "e": "east", "w": "west",
};

function normalize(addr) {
  return addr
    .toLowerCase()
    .replace(/[.,#;:!?()\[\]{}"']/g, " ")          // drop punctuation
    .split(/\s+/)
    .filter(Boolean)
    .map((tok) => ABBREV[tok.replace(/\.$/, "")] || tok.replace(/\.$/, ""))
    .join(" ");
}

// Levenshtein distance (bounded strings: fine on-device).
function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = new Array(b.length + 1);
  let cur = new Array(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    cur[0] = i;
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    [prev, cur] = [cur, prev];
  }
  return prev[b.length];
}

// Hybrid similarity: 60% token Jaccard + 40% character-level Levenshtein ratio.
function similarity(a, b) {
  const ta = new Set(a.split(" ")), tb = new Set(b.split(" "));
  const inter = [...ta].filter((t) => tb.has(t)).length;
  const union = new Set([...ta, ...tb]).size;
  const jaccard = union ? inter / union : 1;
  const lev = 1 - levenshtein(a, b) / Math.max(a.length, b.length, 1);
  return Math.round((0.6 * jaccard + 0.4 * lev) * 100);
}

// Union-find grouping of near-duplicate indices.
function groupDupes(items, threshold) {
  const parent = items.map((_, i) => i);
  const find = (x) => (parent[x] === x ? x : (parent[x] = find(parent[x])));
  const union = (a, b) => { parent[find(a)] = find(b); };
  const pairs = [];
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const score = similarity(items[i].norm, items[j].norm);
      if (score >= threshold) { union(i, j); pairs.push({ i, j, score }); }
    }
  }
  const groups = new Map();
  items.forEach((it, i) => {
    const r = find(i);
    if (!groups.has(r)) groups.set(r, []);
    groups.get(r).push(i);
  });
  return { groups: [...groups.values()].sort((a, b) => b.length - a.length), pairs };
}

const $ = (id) => document.getElementById(id);

document.addEventListener("DOMContentLoaded", () => {
  $("analyze").addEventListener("click", analyze);
  $("clear").addEventListener("click", () => {
    $("input").value = "";
    $("results").hidden = true;
    chrome.storage.local.remove("lastInput");
  });
  $("thresh").addEventListener("input", () => { $("threshVal").textContent = $("thresh").value + "%"; });
  chrome.storage.local.get("lastInput", ({ lastInput }) => {
    if (lastInput) $("input").value = lastInput;
  });
});

function analyze() {
  const raw = $("input").value;
  chrome.storage.local.set({ lastInput: raw });
  const blocks = raw.split(/\n\s*\n/).map((b) => b.replace(/\s+/g, " ").trim()).filter(Boolean);
  const box = $("results"), out = $("groups");
  box.hidden = false; out.innerHTML = "";
  if (blocks.length < 2) {
    $("summary").textContent = "Paste at least 2 addresses to compare.";
    return;
  }
  const items = blocks.map((orig) => ({ orig, norm: normalize(orig) }));
  const threshold = parseInt($("thresh").value, 10);
  const { groups, pairs } = groupDupes(items, threshold);
  const dupeGroups = groups.filter((g) => g.length > 1);
  $("summary").textContent = dupeGroups.length
    ? `⚠ ${dupeGroups.length} likely duplicate group${dupeGroups.length > 1 ? "s" : ""} found`
    : "✓ No duplicates found at this sensitivity";

  const maxScore = (gi) => {
    let m = 0;
    for (const p of pairs) if (gi.includes(p.i) && gi.includes(p.j)) m = Math.max(m, p.score);
    return m;
  };

  for (const g of groups) {
    const card = document.createElement("div");
    card.className = "group" + (g.length > 1 ? "" : " clean");
    const head = document.createElement("div");
    head.className = "ghead";
    const sc = document.createElement("span");
    sc.className = "score";
    sc.textContent = g.length > 1 ? maxScore(g) + "% match" : "unique";
    const flag = document.createElement("span");
    flag.className = "flag";
    flag.textContent = g.length > 1
      ? `${g.length} addresses look like the same location`
      : "No close matches";
    head.append(sc, flag);
    card.appendChild(head);
    for (const idx of g) {
      const d = document.createElement("div");
      d.className = "addr";
      d.textContent = items[idx].orig;
      const n = document.createElement("span");
      n.className = "norm";
      n.textContent = "normalized: " + items[idx].norm;
      d.appendChild(n);
      card.appendChild(d);
    }
    out.appendChild(card);
  }
}
