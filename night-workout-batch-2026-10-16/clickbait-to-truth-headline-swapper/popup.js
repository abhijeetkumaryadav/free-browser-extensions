/* Headline Calmer — popup logic: pure local heuristics, no network. */

/* Sensationalist bait phrases -> neutral replacements.
 * Deliberately conservative: only strips language patterns, never facts. */
const BAIT_REPLACEMENTS = [
  [/you won't believe/i, "here's"],
  [/you will not believe/i, "here's"],
  [/won't believe/i, ""],
  [/shocking/i, "notable"],
  [/shocked/i, "surprised"],
  [/jaw[- ]dropping/i, "significant"],
  [/mind[- ]blowing/i, "notable"],
  [/unbelievable/i, "surprising"],
  [/insane/i, "notable"],
  [/crazy/i, "notable"],
  [/epic/i, "large"],
  [/exposed/i, "revealed"],
  [/leaked/i, "reported"],
  [/breaking/i, "new"],
  [/just happened/i, "recently announced"],
  [/doctors hate (him|her|them|it)/i, ""],
  [/what happened next/i, "what happened"],
  [/number \d+ will/i, "several points may"],
  [/what doctors don't want you to know/i, "medical context"],
  [/secret/i, "detail"],
  [/miracle/i, "result"],
  [/destroyed/i, "criticized"],
  [/obliterated/i, "criticized"],
  [/slammed/i, "criticized"],
  [/stuns/i, "surprises"],
  [/horrifying/i, "serious"],
  [/terrifying/i, "serious"],
  [/amazing/i, "notable"],
  [/incredible/i, "notable"],
];

/* Whole-sentence bait patterns removed entirely. */
const SENTENCE_PATTERNS = [
  /click here to (find out|learn|see more)[^.]*\.?/gi,
  /share this (with|before)[^.]*\.?/gi,
  /tag a friend[^.]*\.?/gi,
];

/**
 * Calm a headline down.
 * @returns {{text: string, changes: string[]}} reworded headline + human-readable change notes.
 */
function calmHeadline(raw) {
  const changes = [];
  let text = (raw || "").trim();
  if (!text) return { text: "", changes: [] };

  // 1. Collapse ALL-CAPS shouting -> sentence case (if mostly caps).
  const letters = text.replace(/[^a-zA-Z]/g, "");
  const caps = (letters.match(/[A-Z]/g) || []).length;
  if (letters.length > 10 && caps / letters.length > 0.6) {
    text = text.toLowerCase().replace(/(^|[.!?]\s+|\n)([a-z])/g, (m) => m.toUpperCase());
    changes.push("Normalized ALL-CAPS shouting to sentence case.");
  }

  // 2. Trim excessive punctuation (!!!, ???, !!!?!!).
  if (/[!?]{2,}/.test(text)) {
    text = text.replace(/([!?]){2,}/g, "$1");
    changes.push("Reduced repeated punctuation (!!! → !).");
  }

  // 3. Remove bait sentences.
  for (const rx of SENTENCE_PATTERNS) {
    if (rx.test(text)) { text = text.replace(rx, " ").trim(); changes.push("Removed engagement-bait sentence."); rx.lastIndex = 0; }
  }

  // 4. Swap sensationalist phrases.
  for (const [rx, replacement] of BAIT_REPLACEMENTS) {
    if (rx.test(text)) {
      text = text.replace(rx, replacement);
      changes.push(`Softened "${rx.source.replace(/\\/g, "")}" → "${replacement || "removed"}".`);
    }
  }

  // 5. Tidy whitespace / trailing punctuation.
  text = text.replace(/\s{2,}/g, " ").replace(/\s+([,.;:!?])/g, "$1").trim();
  text = text.replace(/[.:;,-]+$/, "");
  if (text && !/[.!?]$/.test(text)) text += ".";

  return { text, changes };
}

/* ---- UI wiring ---- */
const $ = (id) => document.getElementById(id);

function render(result) {
  $("output").value = result.text;
  const list = $("changes");
  list.innerHTML = "";
  if (!result.changes.length) {
    list.innerHTML = '<li class="empty">No sensational patterns detected — headline already calm.</li>';
    return;
  }
  for (const c of result.changes) {
    const li = document.createElement("li");
    const b = document.createElement("b");
    b.textContent = "● ";
    li.appendChild(b);
    li.appendChild(document.createTextNode(c));
    list.appendChild(li);
  }
}

$("calm").addEventListener("click", () => {
  render(calmHeadline($("input").value));
});

$("grab").addEventListener("click", async () => {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return;
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        const h1 = document.querySelector("h1");
        if (h1 && h1.innerText.trim()) return h1.innerText.trim();
        const og = document.querySelector('meta[property="og:title"]');
        if (og && og.content.trim()) return og.content.trim();
        return document.title.trim() || "";
      },
    });
    $("input").value = result || "";
    if (result) render(calmHeadline(result));
  } catch (e) {
    $("input").placeholder = "Couldn't read this page — paste the headline instead.";
  }
});

$("copy").addEventListener("click", async () => {
  const t = $("output").value;
  if (t) await navigator.clipboard.writeText(t);
});

$("clear").addEventListener("click", () => {
  $("input").value = "";
  $("output").value = "";
  $("changes").innerHTML = '<li class="empty">No changes yet.</li>';
});
