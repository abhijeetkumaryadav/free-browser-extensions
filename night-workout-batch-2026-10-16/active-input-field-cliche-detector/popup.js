/* popup.js — scans active-field text or pasted text against the bundled cliché list. */
const $ = (id) => document.getElementById(id);
const statusEl = $("status"), resultsEl = $("results"),
      matchList = $("matchList"), matchCount = $("matchCount");

/** Escape RegExp special chars in a phrase. */
function esc(s){ return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

/** Count non-overlapping occurrences of phrase (word-boundary aware) in text. */
function countMatches(text, phrase){
  const re = new RegExp("\\b" + esc(phrase) + "\\b", "gi");
  return (text.match(re) || []).length;
}

/** Scan text, return sorted list of {phrase, times}. */
function scanText(text){
  if (!text) return [];
  const hits = [];
  for (const phrase of CLICHES){
    const times = countMatches(text, phrase);
    if (times > 0) hits.push({ phrase, times });
  }
  hits.sort((a,b) => b.times - a.times || b.phrase.length - a.phrase.length);
  return hits;
}

/** Render the results list. */
function render(hits, sourceLabel){
  resultsEl.classList.remove("hidden");
  const total = hits.reduce((n,h) => n + h.times, 0);
  matchCount.textContent = String(total);
  matchList.innerHTML = "";
  if (hits.length === 0){
    matchList.innerHTML = `<li>No clichés found in ${sourceLabel}. Nice writing.</li>`;
  } else {
    for (const h of hits){
      const li = document.createElement("li");
      const times = h.times > 1 ? ` <span class="times">×${h.times}</span>` : "";
      li.innerHTML = `<strong>“${h.phrase}”</strong>${times}`;
      matchList.appendChild(li);
    }
  }
  const wordCount = hits.length;
  statusEl.textContent = `${total} match${total===1?"":"es"} in ${sourceLabel} (${wordCount} unique phrase${wordCount===1?"":"s"}).`;
}

/** Ask the content script for the active field's text. */
function getActiveFieldText(){
  return new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs[0];
      if (!tab || !tab.id){ resolve({ ok:false, reason:"No active tab." }); return; }
      if (/^(chrome|chrome-extension|edge|about):/.test(tab.url || "")){
        resolve({ ok:false, reason:"Cannot scan browser internal pages." }); return;
      }
      chrome.scripting.executeScript(
        { target: { tabId: tab.id }, files: ["content.js"] },
        () => {
          if (chrome.runtime.lastError){
            resolve({ ok:false, reason: chrome.runtime.lastError.message }); return;
          }
          chrome.tabs.sendMessage(tab.id, { type: "GET_ACTIVE_TEXT" }, (resp) => {
            if (chrome.runtime.lastError) resolve({ ok:false, reason:"No text found in the active field." });
            else resolve(resp || { ok:false, reason:"No text found." });
          });
        }
      );
    });
  });
}

$("scanActive").addEventListener("click", async () => {
  statusEl.textContent = "Scanning active field…";
  const resp = await getActiveFieldText();
  if (!resp.ok){ statusEl.textContent = resp.reason || "Nothing to scan."; return; }
  render(scanText(resp.text), "the active field");
});

$("scanPaste").addEventListener("click", () => {
  const text = $("pasteText").value;
  if (!text.trim()){ statusEl.textContent = "Paste some text first."; return; }
  render(scanText(text), "pasted text");
});

$("clearMarks").addEventListener("click", () => {
  resultsEl.classList.add("hidden");
  matchList.innerHTML = "";
  $("pasteText").value = "";
  statusEl.textContent = "Cleared.";
});
