/* Prompt Injection Scanner — popup logic. 100% local. */

const $ = (id) => document.getElementById(id);
const SEV_LABEL = { high: "HIGH", medium: "MED", low: "LOW" };

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

/* ---------- rule list ---------- */
(function renderRules() {
  const box = $("rules");
  $("ruleCount").textContent = "(" + INJECTION_RULES.length + " rules)";
  box.innerHTML = INJECTION_RULES.map((r) =>
    '<div class="rule"><span class="sev ' + r.severity + '">' + SEV_LABEL[r.severity] +
    '</span><div><div class="rule-id">' + esc(r.id) + '</div><div class="rule-note">' +
    esc(r.note) + "</div></div></div>"
  ).join("");
})();

/* ---------- scanning ---------- */
function showResults(hits) {
  const verdict = $("verdict");
  const hitsBox = $("hits");
  if (!hits.length) {
    verdict.className = "verdict clean";
    verdict.textContent = "No patterns matched. (This does not prove the text is safe.)";
    hitsBox.innerHTML = "";
    return;
  }
  const worst = hits.some((h) => h.rule.severity === "high") ? "high"
    : hits.some((h) => h.rule.severity === "medium") ? "medium" : "low";
  verdict.className = "verdict " + worst;
  verdict.textContent = hits.length + " pattern hit" + (hits.length > 1 ? "s" : "") +
    " — highest severity: " + SEV_LABEL[worst] + ". Review each below.";
  hitsBox.innerHTML = hits.map((h) =>
    '<div class="hit"><div class="hit-head"><span class="sev ' + h.rule.severity + '">' +
    SEV_LABEL[h.rule.severity] + '</span><span class="hit-id">' + esc(h.rule.id) +
    '</span><span class="hit-match">“' + esc(h.matched) + '”</span></div>' +
    '<div class="hit-note">' + esc(h.rule.note) + '</div>' +
    '<div class="hit-snippet">' + esc(h.snippet) + "</div></div>"
  ).join("");
}

$("scanBtn").addEventListener("click", () => {
  showResults(scanForInjection($("input").value));
});

$("clearBtn").addEventListener("click", () => {
  $("input").value = "";
  $("verdict").className = "verdict idle";
  $("verdict").textContent = "Not scanned yet.";
  $("hits").innerHTML = "";
  $("grabNote").hidden = true;
});

/* Scan the focused field / selection on the active tab (read-only, click-only). */
$("grabBtn").addEventListener("click", async () => {
  const note = $("grabNote");
  note.hidden = true;
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id || /^chrome/.test(tab.url || "")) {
      note.textContent = "Cannot read this page (browser pages are off-limits).";
      note.hidden = false;
      return;
    }
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        const el = document.activeElement;
        if (el && (el.tagName === "TEXTAREA" ||
            (el.tagName === "INPUT" && /text|search|url|email/i.test(el.type)) ||
            el.isContentEditable)) {
          return el.isContentEditable ? el.innerText : el.value;
        }
        const sel = window.getSelection();
        return sel ? sel.toString() : "";
      },
    });
    if (result && result.trim()) {
      $("input").value = result.slice(0, 20000);
      showResults(scanForInjection($("input").value));
    } else {
      note.textContent = "No text found — focus a text field or select text first.";
      note.hidden = false;
    }
  } catch (e) {
    note.textContent = "Could not read the active tab.";
    note.hidden = false;
  }
});
