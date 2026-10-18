// Industry Jargon Simplifier — popup logic. All matching is on-device.

// Built-in glossary: term -> plain-language replacement.
const GLOSSARY = {
  business: {
    "synergy": "combined effort", "leverage": "use", "bandwidth": "time / capacity",
    "touch base": "check in", "circle back": "follow up", "deep dive": "close look",
    "low-hanging fruit": "easy wins", "move the needle": "make a difference",
    "boil the ocean": "overcomplicate", "paradigm shift": "big change",
    "thought leadership": "expert opinion", "ecosystem": "network",
    "disrupt": "shake up", "scalable": "able to grow", "granular": "detailed",
    "actionable": "practical", "deliverables": "outputs", "KPIs": "key goals",
    "ROI": "return on investment", "runway": "time before money runs out",
  },
  legal: {
    "force majeure": "events beyond anyone's control", "indemnify": "cover costs for",
    "arbitration": "private dispute resolution", "subpoena": "court order to appear",
    "affidavit": "sworn written statement", "tort": "civil wrong",
    "precedent": "earlier court decision", "injunction": "court order to stop",
    "liquidated damages": "agreed penalty payment", "severability": "splitting off bad clauses",
    "estoppel": "being held to your word", "heretofore": "until now",
  },
  tech: {
    "API": "app connector", "cloud-native": "built for the cloud",
    "blockchain": "shared digital ledger", "machine learning": "pattern-learning software",
    "bandwidth": "time / capacity", "synergy": "combined effort",
    "refactor": "rewrite cleanly", "deprecated": "being phased out",
    "latency": "delay", "throughput": "processing rate", "idempotent": "safe to repeat",
    "containerization": "packaging apps to run anywhere",
  },
  medical: {
    "benign": "not harmful", "malignant": "cancerous / harmful", "acute": "sudden and severe",
    "chronic": "long-lasting", "idiopathic": "of unknown cause", "prognosis": "expected outcome",
    "contraindication": "reason not to use it", "hypertension": "high blood pressure",
    "myocardial infarction": "heart attack", "placebo": "inactive treatment",
    "remission": "symptoms gone for now", "etiology": "cause",
  },
};

// Flatten, longest-first so multi-word phrases match before single words.
function mergedGlossary(custom) {
  const flat = {};
  for (const cat of Object.values(GLOSSARY)) Object.assign(flat, cat);
  Object.assign(flat, custom || {});
  return Object.entries(flat).sort((a, b) => b[0].length - a[0].length);
}
function escRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
function escHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}

const $ = (id) => document.getElementById(id);
let lastMatches = 0, lastText = "";

document.addEventListener("DOMContentLoaded", init);

async function init() {
  $("analyze").addEventListener("click", analyze);
  $("simplify").addEventListener("click", simplifyAll);
  $("copy").addEventListener("click", copySimplified);
  $("addTerm").addEventListener("click", addTerm);
  renderCustom();
}

async function getCustom() {
  const { customTerms = {} } = await chrome.storage.local.get("customTerms");
  return customTerms;
}

function analyze() {
  const text = $("input").value.trim();
  if (!text) return;
  getCustom().then((custom) => {
    const terms = mergedGlossary(custom);
    const re = new RegExp("\\b(" + terms.map(([t]) => escRe(t)).join("|") + ")\\b", "gi");
    const map = Object.fromEntries(terms.map(([t, p]) => [t.toLowerCase(), p]));
    lastMatches = 0;
    const html = escHtml(text).replace(re, (m) => {
      lastMatches++;
      const plain = map[m.toLowerCase()] || "";
      return `<span class="term" data-plain="${escHtml(plain)}">${escHtml(m)}</span>`;
    });
    lastText = text;
    const box = $("analyzed");
    box.innerHTML = html || escHtml(text);
    box.querySelectorAll(".term").forEach((el) =>
      el.addEventListener("click", () => el.classList.toggle("show"))
    );
    $("analyzedCard").hidden = false;
    const c = $("count");
    c.hidden = false;
    c.textContent = lastMatches
      ? `${lastMatches} jargon term${lastMatches > 1 ? "s" : ""} found — click to see plain meanings.`
      : "No jargon found — the text already reads plain.";
    $("simplify").disabled = lastMatches === 0;
    $("simpleCard").hidden = true;
  });
}

function simplifyAll() {
  if (!lastText) return;
  getCustom().then((custom) => {
    const terms = mergedGlossary(custom);
    const re = new RegExp("\\b(" + terms.map(([t]) => escRe(t)).join("|") + ")\\b", "gi");
    const map = Object.fromEntries(terms.map(([t, p]) => [t.toLowerCase(), p]));
    const out = lastText.replace(re, (m) => {
      const plain = map[m.toLowerCase()];
      // preserve leading capital on the replacement when the original was capitalized
      if (plain && /^[A-Z]/.test(m) && m.length > 1 && m[1] === m[1].toUpperCase()) return plain;
      if (plain && /^[A-Z]/.test(m)) return plain.charAt(0).toUpperCase() + plain.slice(1);
      return plain || m;
    });
    $("simplified").textContent = out;
    $("simpleCard").hidden = false;
  });
}

async function copySimplified() {
  try {
    await navigator.clipboard.writeText($("simplified").textContent);
    $("copy").textContent = "Copied ✓";
    setTimeout(() => $("copy").textContent = "Copy simplified text", 1500);
  } catch (e) {}
}

async function addTerm() {
  const term = $("tTerm").value.trim();
  const plain = $("tPlain").value.trim();
  if (!term || !plain) return;
  const custom = await getCustom();
  custom[term.toLowerCase()] = plain;
  await chrome.storage.local.set({ customTerms: custom });
  $("tTerm").value = $("tPlain").value = "";
  renderCustom();
}

async function renderCustom() {
  const custom = await getCustom();
  const box = $("customTerms");
  box.innerHTML = "";
  const keys = Object.keys(custom);
  if (!keys.length) {
    const d = document.createElement("div");
    d.className = "empty-note";
    d.textContent = "None yet — add terms you see in your industry.";
    box.appendChild(d);
    return;
  }
  for (const k of keys.sort()) {
    const row = document.createElement("div");
    row.className = "cterm";
    const nm = document.createElement("div");
    nm.className = "nm";
    nm.innerHTML = `<b>${escHtml(k)}</b><span>${escHtml(custom[k])}</span>`;
    const x = document.createElement("button");
    x.className = "x"; x.textContent = "×";
    x.addEventListener("click", async () => {
      const cur = await getCustom();
      delete cur[k];
      await chrome.storage.local.set({ customTerms: cur });
      renderCustom();
    });
    row.append(nm, x);
    box.appendChild(row);
  }
}
