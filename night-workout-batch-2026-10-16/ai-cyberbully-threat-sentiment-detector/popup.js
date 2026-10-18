/* BullyShield popup — LOCAL heuristic scan. Not AI, not a clinical tool.
   Text is extracted on demand and never leaves the device. */

/* Bundled heuristic pattern list: [phrase, severity 1-3, category, strictOnly?] */
const PATTERNS = [
  // --- severe threats (sev 3) ---
  ["kill yourself", 3, "Threat"], ["kys", 3, "Threat"],
  ["i will kill you", 3, "Threat"], ["i'll kill you", 3, "Threat"],
  ["you should die", 3, "Threat"], ["hope you die", 3, "Threat"],
  ["wish you were dead", 3, "Threat"], ["you're dead", 3, "Threat"],
  ["you are dead", 3, "Threat"], ["watch your back", 3, "Threat"],
  ["i will hurt you", 3, "Threat"], ["i'll hurt you", 3, "Threat"],
  ["i'm going to hurt you", 3, "Threat"], ["beat you up", 3, "Threat"],
  ["gonna find you", 3, "Threat"],
  // --- insults / targeted harassment (sev 2) ---
  ["nobody likes you", 2, "Insult"], ["everybody hates you", 2, "Insult"],
  ["everyone hates you", 2, "Insult"], ["i hate you", 2, "Insult"],
  ["you're worthless", 2, "Insult"], ["you are worthless", 2, "Insult"],
  ["you're pathetic", 2, "Insult"], ["shut up", 2, "Insult"],
  ["loser", 2, "Insult"], ["moron", 2, "Insult"], ["freak", 2, "Insult"],
  ["weirdo", 2, "Insult"], ["ugly", 2, "Insult"], ["stupid", 2, "Insult"],
  ["idiot", 2, "Insult"],
  // --- exclusion & taunts (sev 1) ---
  ["not invited", 1, "Exclusion"], ["go away", 1, "Exclusion"],
  ["leave us alone", 1, "Exclusion"], ["nobody wants you", 1, "Exclusion"],
  ["we don't want you", 1, "Exclusion"], ["crybaby", 1, "Taunt"],
  ["cry about it", 1, "Taunt"], ["imagine being you", 1, "Taunt"],
  ["l + ratio", 1, "Taunt"], ["ratio", 1, "Taunt", true],
  ["skill issue", 1, "Taunt", true], ["you're trash", 1, "Taunt", true],
  ["clown", 1, "Taunt", true],
];

const $ = (id) => document.getElementById(id);
const esc = (t) => String(t).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const rxEsc = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function analyze(text, strict) {
  const hits = [];
  for (const [phrase, sev, cat, strictOnly] of PATTERNS) {
    if (strictOnly && !strict) continue;
    const rx = new RegExp(`\\b${rxEsc(phrase)}\\b`, "gi");
    const m = rx.exec(text);
    if (m) hits.push({ phrase, sev, cat, index: m.index, count: (text.match(new RegExp(`\\b${rxEsc(phrase)}\\b`, "gi")) || []).length });
  }
  hits.sort((a, b) => b.sev - a.sev || b.count - a.count);
  return hits;
}

function snippet(text, index, len) {
  const start = Math.max(0, index - 45), end = Math.min(text.length, index + len + 45);
  let s = esc(text.slice(start, end));
  const rel = index - start;
  return (start > 0 ? "…" : "") + s.slice(0, rel) +
    "<mark>" + s.slice(rel, rel + len) + "</mark>" +
    s.slice(rel + len) + (end < text.length ? "…" : "");
}

function verdictFor(score) {
  if (score === 0) return ["none", "No signals detected", "No bullying/threat patterns matched this scan. Heuristics can miss things — trust your eyes too."];
  if (score <= 2) return ["low", "Low — a few mild flags", "Mild teasing patterns found. Read them in context before deciding anything."];
  if (score <= 5) return ["mod", "Moderate — review recommended", "Several concerning patterns. Read the full conversation and talk with your child."];
  return ["high", "High — take a closer look now", "Strong or repeated threat/insult signals. Review the messages, save evidence, and consider reporting/blocking."];
}

async function scan() {
  $("err").classList.add("hidden");
  const strict = $("sensitivity").value === "strict";
  let tab;
  try { [tab] = await chrome.tabs.query({ active: true, currentWindow: true }); }
  catch { return fail("Could not access the active tab."); }
  if (!tab || !tab.id || !/^https?:/.test(tab.url || "")) {
    return fail("Scan works on regular web pages (not the new-tab page or browser settings).");
  }
  try {
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["content.js"] });
    const res = await chrome.tabs.sendMessage(tab.id, { type: "bullyshield-scan" });
    if (!res || !res.ok) return fail("Could not read page text.");
    render(res.text, strict);
  } catch (e) { fail("Scan failed: " + (e.message || e)); }
}

function fail(msg) { const e = $("err"); e.textContent = msg; e.classList.remove("hidden"); }

function render(text, strict) {
  const hits = analyze(text, strict);
  const score = hits.reduce((a, h) => a + h.sev, 0);
  const [cls, title, sub] = verdictFor(score);
  const v = $("verdict");
  v.className = "verdict " + cls;
  v.innerHTML = esc(title) + `<div style="font-weight:400;font-size:12px;margin-top:4px">${esc(sub)}</div>`;

  const byCat = {};
  for (const h of hits) byCat[h.cat] = (byCat[h.cat] || 0) + 1;
  $("counts").innerHTML = hits.length
    ? Object.entries(byCat).map(([c, n]) => `<div class="count"><b>${n}</b><span>${esc(c)}</span></div>`).join("")
    : `<div class="count"><b>0</b><span>flags</span></div>`;

  $("snippets").innerHTML = hits.length
    ? hits.map((h, i) => `<div class="snip sev${h.sev}" data-i="${i}">
        <span class="tag">${esc(h.cat)} · severity ${h.sev}${h.count > 1 ? ` · ×${h.count}` : ""}</span>
        <div class="ctx">${snippet(text, h.index, h.phrase.length)}</div>
      </div>`).join("")
    : `<p class="muted">Nothing flagged. Remember: this is a simple word-pattern check, not a guarantee.</p>`;
  $("snippets").querySelectorAll(".snip").forEach((el) => el.onclick = () => el.classList.toggle("open"));

  $("idleView").classList.add("hidden");
  $("resultView").classList.remove("hidden");
}

$("scanBtn").onclick = scan;
$("rescanBtn").onclick = () => { $("resultView").classList.add("hidden"); $("idleView").classList.remove("hidden"); };
