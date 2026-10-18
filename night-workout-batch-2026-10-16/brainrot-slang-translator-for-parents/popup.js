// SlangSense popup logic.
// Merges the bundled dictionary with user-suggested terms from local storage.
// SLANG is provided by dictionary.js.

// Escape regex special chars in a term.
function escRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

async function getDictionary() {
  const { custom = [] } = await chrome.storage.local.get("custom");
  // user terms first so they win on duplicates
  const seen = new Set();
  const merged = [];
  for (const e of [...custom, ...SLANG]) {
    const k = e.t.toLowerCase();
    if (!seen.has(k)) { seen.add(k); merged.push(e); }
  }
  return merged;
}

// Find all dictionary hits in text (longest terms first to avoid partial overlaps).
function findHits(text, dict) {
  const hits = [];
  const sorted = [...dict].sort((a, b) => b.t.length - a.t.length);
  const used = []; // [start, end] ranges already claimed
  for (const entry of sorted) {
    const re = new RegExp(`\\b${escRe(entry.t)}\\b`, "gi");
    let m;
    while ((m = re.exec(text))) {
      const s = m.index, e = s + m[0].length;
      if (used.some(([a, b]) => s < b && e > a)) continue;
      used.push([s, e]);
      hits.push({ entry, start: s, end: e, word: m[0] });
    }
  }
  return hits.sort((a, b) => a.start - b.start);
}

function renderHit(h) {
  const div = document.createElement("div");
  div.className = "hit";
  div.innerHTML = `<b></b><span class="tag"></span><div></div><div class="ex"></div>`;
  div.querySelector("b").textContent = h.word;
  div.querySelector(".tag").textContent = h.entry.tag || "";
  div.querySelector("div").textContent = h.entry.def;
  div.querySelector(".ex").textContent = h.entry.ex || "";
  return div;
}

// ---------- tabs ----------
function showPane(name) {
  ["Paste", "Scan", "Dict"].forEach((p) => {
    document.getElementById("pane" + p).classList.toggle("hidden", p !== name);
    document.getElementById("tab" + p).classList.toggle("active", p !== name ? false : true);
  });
}
["Paste", "Scan", "Dict"].forEach((p) =>
  document.getElementById("tab" + p).addEventListener("click", () => showPane(p)));

// ---------- paste decode ----------
document.getElementById("decodeBtn").addEventListener("click", async () => {
  const text = document.getElementById("inputText").value;
  const out = document.getElementById("decodeOut");
  out.innerHTML = "";
  if (!text.trim()) return;
  const dict = await getDictionary();
  const hits = findHits(text, dict);
  if (!hits.length) {
    out.innerHTML = '<p class="none">No slang found — suspiciously wholesome message.</p>';
    return;
  }
  const seen = new Set();
  for (const h of hits) {
    if (seen.has(h.entry.t.toLowerCase())) continue;
    seen.add(h.entry.t.toLowerCase());
    out.appendChild(renderHit(h));
  }
});

// ---------- page scan ----------
document.getElementById("scanBtn").addEventListener("click", async () => {
  const msg = document.getElementById("scanMsg");
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id || !/^https?:/.test(tab.url || "")) {
      msg.textContent = "Open a normal web page first (not settings or new-tab).";
      return;
    }
    const dict = await getDictionary();
    const terms = dict.map((e) => ({ t: e.t, def: e.def }));
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: (terms) => {
        if (window.__slangsense) return { count: -1 }; // already scanned
        window.__slangsense = true;
        const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const style = document.createElement("style");
        style.textContent = ".slangsense-hl{background:rgba(167,139,250,.35);border-bottom:2px dotted #a78bfa;border-radius:3px;cursor:help;}";
        document.documentElement.appendChild(style);
        const sorted = [...terms].sort((a, b) => b.t.length - a.t.length);
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        const nodes = [];
        while (walker.nextNode()) {
          const n = walker.currentNode;
          if (n.parentElement && !/^(SCRIPT|STYLE|TEXTAREA|INPUT)$/.test(n.parentElement.tagName)) nodes.push(n);
        }
        let count = 0;
        for (const node of nodes) {
          let html = node.nodeValue;
          let changed = false;
          for (const { t, def } of sorted) {
            const re = new RegExp(`\\b(${esc(t)})\\b`, "gi");
            if (re.test(html)) {
              changed = true;
              html = html.replace(re, (m) =>
                `<span class="slangsense-hl" title="${def.replace(/"/g, "&quot;")}">${m}</span>`);
            }
          }
          if (changed) {
            const span = document.createElement("span");
            span.innerHTML = html;
            node.replaceWith(span);
            count++;
          }
        }
        return { count };
      },
      args: [terms]
    });
    msg.textContent = result && result.count >= 0
      ? `Highlighted slang on this page (hover for definitions).`
      : "Page already scanned — hit Clear to re-scan.";
  } catch (e) {
    msg.textContent = "Couldn't scan this page (it may be protected).";
  }
});

document.getElementById("clearBtn").addEventListener("click", async () => {
  const msg = document.getElementById("scanMsg");
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id) return;
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        document.querySelectorAll(".slangsense-hl").forEach((el) => {
          el.replaceWith(document.createTextNode(el.textContent));
        });
        window.__slangsense = false;
      }
    });
    msg.textContent = "Highlights cleared.";
  } catch { msg.textContent = "Couldn't clear this page."; }
});

// ---------- dictionary tab ----------
async function renderDict(filter = "") {
  const dict = await getDictionary();
  const list = document.getElementById("dictList");
  list.innerHTML = "";
  const f = filter.trim().toLowerCase();
  dict
    .filter((e) => !f || e.t.includes(f) || e.def.toLowerCase().includes(f))
    .forEach((e) => list.appendChild(renderHit({ entry: e, word: e.t })));
}

document.getElementById("dictSearch").addEventListener("input", (e) => renderDict(e.target.value));

document.getElementById("addTerm").addEventListener("click", async () => {
  const t = document.getElementById("newTerm").value.trim().toLowerCase();
  const def = document.getElementById("newDef").value.trim();
  if (!t || !def) return;
  const { custom = [] } = await chrome.storage.local.get("custom");
  if (!custom.some((e) => e.t === t)) custom.push({ t, def, ex: "", tag: "yours" });
  await chrome.storage.local.set({ custom });
  document.getElementById("newTerm").value = "";
  document.getElementById("newDef").value = "";
  renderDict(document.getElementById("dictSearch").value);
});

document.addEventListener("DOMContentLoaded", () => renderDict());
