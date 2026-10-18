// Zero-Shot Regex Builder — popup logic. All on-device, no network.

const BLOCK_TYPES = {
  email:      { label: "Email",        make: () => "[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}" },
  url:        { label: "URL",          make: () => "https?:\\/\\/[^\\s/$.?#][^\\s]*" },
  date:       { label: "Date",        make: () => "\\d{4}-\\d{2}-\\d{2}" },
  phone:      { label: "Phone",       make: () => "\\+?[\\d\\s().-]{7,}" },
  numrange:   { label: "Number range", make: (cfg) => rangeToRegex(cfg.min, cfg.max), cfg: ["min", "max"] },
  digits:     { label: "Digits",       make: (cfg) => `\\d{${cfg.min || 1},${cfg.max || ""}}`.replace(",}", "}"), cfg: ["min", "max"] },
  word:       { label: "Word",         make: () => "[A-Za-z]+" },
  alnum:      { label: "Word+digits",  make: () => "\\w+" },
  literal:    { label: "Literal",      make: (cfg) => escapeRe(cfg.text || ""), cfg: ["text"] },
  charset:    { label: "Charset",      make: (cfg) => "[" + escapeCharset(cfg.text || "") + "]", cfg: ["text"] },
  any:        { label: "Any char",     make: () => "." },
  whitespace: { label: "Whitespace",   make: () => "\\s+" },
};

const QUANTIFIERS = [
  ["", "once"], ["*", "0+"], ["+", "1+"], ["?", "optional"],
  ["{n}", "exactly n"], ["{n,m}", "n to m"],
];

const $ = (id) => document.getElementById(id);
let blocks = []; // [{ uid, type, quant, qn, qm, cfg: {min,max,text} }]
let uidSeq = 1;

document.addEventListener("DOMContentLoaded", init);

async function init() {
  const pal = $("palette");
  for (const [type, def] of Object.entries(BLOCK_TYPES)) {
    const b = document.createElement("button");
    b.textContent = def.label;
    b.addEventListener("click", () => addBlock(type));
    pal.appendChild(b);
  }
  $("flagI").addEventListener("change", refresh);
  $("sample").addEventListener("input", () => { refresh(); persistDebounced(); });
  $("copyBtn").addEventListener("click", copyRegex);
  $("clearBtn").addEventListener("click", () => { blocks = []; refresh(); persist(); });
  // restore saved pattern
  try {
    const saved = await chrome.storage.local.get("rzb");
    if (saved.rzb && Array.isArray(saved.rzb.blocks)) {
      blocks = saved.rzb.blocks.filter((b) => BLOCK_TYPES[b.type]);
      uidSeq = blocks.reduce((m, b) => Math.max(m, b.uid || 0), 0) + 1;
      if (saved.rzb.ignoreCase) $("flagI").checked = true;
      if (typeof saved.rzb.sample === "string") $("sample").value = saved.rzb.sample;
    }
  } catch (e) {}
  refresh();
}

// --- regex construction -------------------------------------------------

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function escapeCharset(s) {
  return s.replace(/[\\\]\[^-]/g, "\\$&");
}

// Explicit alternation for bounded integer ranges (exact, honest).
// Returns null when the range is too large to enumerate.
function rangeToRegex(min, max) {
  min = Math.max(0, Math.floor(Number(min) || 0));
  max = Math.floor(Number(max));
  if (isNaN(max)) max = min;
  if (max < min) { const t = min; min = max; max = t; }
  if (max - min > 500) return null;
  const parts = [];
  for (let n = min; n <= max; n++) parts.push(String(n));
  return parts.length > 1 ? `(?:${parts.join("|")})` : parts[0];
}

function blockSource(b) {
  const def = BLOCK_TYPES[b.type];
  let src;
  try { src = def.make(b.cfg || {}); }
  catch (e) { src = null; }
  if (src == null || src === "") return { src: null, err: `"${def.label}" needs valid settings.` };
  if (b.quant === "{n}") return { src: `(?:${src}){${Math.max(1, b.qn || 1)}}` };
  if (b.quant === "{n,m}") {
    const n = Math.max(0, b.qn || 0), m = Math.max(n, b.qm == null ? n : b.qm);
    return { src: `(?:${src}){${n},${m}}` };
  }
  if (b.quant) return { src: `(?:${src})${b.quant}` };
  return { src };
}

function buildRegex() {
  if (!blocks.length) return { src: "", err: null };
  const parts = [];
  for (const b of blocks) {
    const r = blockSource(b);
    if (r.err) return { src: "", err: r.err };
    parts.push(r.src);
  }
  return { src: parts.join(""), err: null };
}

// --- rendering ------------------------------------------------------------

function addBlock(type) {
  const def = BLOCK_TYPES[type];
  const cfg = {};
  if (def.cfg) for (const k of def.cfg) cfg[k] = k === "min" ? "1" : k === "max" ? "10" : "";
  blocks.push({ uid: uidSeq++, type, quant: "", qn: 1, qm: 3, cfg });
  refresh(); persist();
}

function refresh() {
  renderBlocks();
  const { src, err } = buildRegex();
  const errBox = $("regexErr");
  if (err) {
    errBox.hidden = false; errBox.textContent = err;
    $("regexStr").textContent = "—";
  } else {
    errBox.hidden = true;
    $("regexStr").textContent = src ? `/${src}/${$("flagI").checked ? "i" : ""}` : "—";
  }
  testRegex(src);
}

function renderBlocks() {
  const box = $("blocks");
  box.innerHTML = "";
  if (!blocks.length) {
    const d = document.createElement("div");
    d.className = "empty-blocks";
    d.textContent = "Add blocks above to compose your pattern.";
    box.appendChild(d);
    return;
  }
  blocks.forEach((b, i) => {
    const def = BLOCK_TYPES[b.type];
    const row = document.createElement("div");
    row.className = "block";
    const chip = document.createElement("span");
    chip.className = "chip"; chip.textContent = def.label;
    row.appendChild(chip);
    if (def.cfg) {
      const cfg = document.createElement("div");
      cfg.className = "cfg";
      for (const k of def.cfg) {
        const inp = document.createElement("input");
        inp.value = b.cfg[k] || "";
        inp.placeholder = k === "text" ? (b.type === "literal" ? "exact text" : "characters") : k;
        if (k === "min" || k === "max") inp.type = "number";
        inp.addEventListener("input", () => { b.cfg[k] = inp.value; refresh(); persistDebounced(); });
        cfg.appendChild(inp);
      }
      row.appendChild(cfg);
    } else {
      const sp = document.createElement("div"); sp.className = "cfg"; row.appendChild(sp);
    }
    const q = document.createElement("select");
    q.title = "Quantifier";
    for (const [v, label] of QUANTIFIERS) {
      const o = document.createElement("option");
      o.value = v; o.textContent = label;
      if (b.quant === v) o.selected = true;
      q.appendChild(o);
    }
    q.addEventListener("change", () => { b.quant = q.value; refresh(); persist(); });
    row.appendChild(q);
    if (b.quant === "{n}" || b.quant === "{n,m}") {
      const nums = document.createElement("div");
      nums.className = "cfg";
      const n1 = document.createElement("input");
      n1.type = "number"; n1.min = "0"; n1.value = b.qn; n1.title = "n";
      n1.addEventListener("input", () => { b.qn = parseInt(n1.value, 10) || 0; refresh(); persistDebounced(); });
      nums.appendChild(n1);
      if (b.quant === "{n,m}") {
        const n2 = document.createElement("input");
        n2.type = "number"; n2.min = "0"; n2.value = b.qm; n2.title = "m";
        n2.addEventListener("input", () => { b.qm = parseInt(n2.value, 10) || 0; refresh(); persistDebounced(); });
        nums.appendChild(n2);
      }
      row.appendChild(nums);
    }
    const mv = document.createElement("div");
    mv.className = "mv";
    const up = document.createElement("button"); up.textContent = "▲"; up.title = "Move up";
    up.addEventListener("click", () => { if (i > 0) { [blocks[i - 1], blocks[i]] = [blocks[i], blocks[i - 1]]; refresh(); persist(); } });
    const dn = document.createElement("button"); dn.textContent = "▼"; dn.title = "Move down";
    dn.addEventListener("click", () => { if (i < blocks.length - 1) { [blocks[i + 1], blocks[i]] = [blocks[i], blocks[i + 1]]; refresh(); persist(); } });
    mv.append(up, dn);
    row.appendChild(mv);
    const x = document.createElement("button");
    x.className = "x"; x.textContent = "×"; x.title = "Remove block";
    x.addEventListener("click", () => { blocks.splice(i, 1); refresh(); persist(); });
    row.appendChild(x);
    box.appendChild(row);
  });
}

function escHtml(s) {
  return s.replace(/[&<>"']/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}

// --- live testing ----------------------------------------------------------

function testRegex(src) {
  const sample = $("sample").value;
  const out = $("highlight");
  if (!src || !sample) {
    out.innerHTML = sample ? escHtml(sample) : '<span style="color:var(--muted)">Type sample text to test.</span>';
    $("matchCount").textContent = "0 matches";
    return;
  }
  let re;
  try { re = new RegExp(src, "g" + ($("flagI").checked ? "i" : "")); }
  catch (e) {
    out.innerHTML = escHtml(sample);
    $("matchCount").textContent = "invalid pattern";
    return;
  }
  let html = "", last = 0, count = 0, m;
  re.lastIndex = 0;
  const guard = sample.length * 4 + 1000;
  let steps = 0;
  while ((m = re.exec(sample)) !== null && steps++ < guard) {
    count++;
    html += escHtml(sample.slice(last, m.index)) + "<mark>" + escHtml(m[0]) + "</mark>";
    last = m.index + m[0].length;
    if (m[0].length === 0) re.lastIndex++; // avoid zero-length infinite loop
  }
  html += escHtml(sample.slice(last));
  out.innerHTML = html;
  $("matchCount").textContent = `${count} match${count === 1 ? "" : "es"}`;
}

async function copyRegex() {
  const { src, err } = buildRegex();
  if (err || !src) return;
  const full = `/${src}/${$("flagI").checked ? "i" : ""}`;
  try { await navigator.clipboard.writeText(full); }
  catch (e) {
    const ta = document.createElement("textarea");
    ta.value = full; document.body.appendChild(ta); ta.select();
    document.execCommand("copy"); ta.remove();
  }
  const btn = $("copyBtn");
  btn.textContent = "Copied ✓";
  setTimeout(() => { btn.textContent = "Copy regex"; }, 1500);
}

let persistTimer = null;
function persistDebounced() {
  clearTimeout(persistTimer);
  persistTimer = setTimeout(persist, 600);
}
async function persist() {
  try {
    await chrome.storage.local.set({ rzb: { blocks, ignoreCase: $("flagI").checked, sample: $("sample").value } });
  } catch (e) {}
}
