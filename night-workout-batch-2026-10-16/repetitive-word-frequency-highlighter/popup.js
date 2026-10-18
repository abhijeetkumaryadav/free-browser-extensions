/* Word Frequency Highlighter — frequency analysis + repeat highlighting, all local. */
"use strict";

/** Common stopwords excluded from "overused" flags (but still counted). */
const STOPWORDS = new Set(
  "a,an,the,and,or,but,if,then,else,for,of,to,in,on,at,by,with,from,as,is,are,was,were,be,been,being,it,its,this,that,these,those,i,you,he,she,we,they,them,his,her,our,your,their,my,me,him,us,not,no,do,does,did,have,has,had,will,would,can,could,should,so,than,too,very,just,also,there,here,when,where,what,which,who,how,all,any,each,more,most,other,some,such,only,own,same".split(",")
);

const input = document.getElementById("input");
const table = document.getElementById("table");
const preview = document.getElementById("preview");
let tokens = [];      // original-case words
let freq = new Map(); // lowercased word -> count
let selected = null;  // currently highlighted word (lowercased)

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

/** Split text into words (letters, numbers, apostrophes). */
function tokenize(text) {
  return text.match(/[A-Za-z0-9']+/g) || [];
}

function analyze() {
  const text = input.value.trim();
  tokens = tokenize(text);
  freq = new Map();
  for (const t of tokens) {
    const k = t.toLowerCase();
    freq.set(k, (freq.get(k) || 0) + 1);
  }
  const repeated = [...freq.values()].filter((c) => c > 1).length;
  document.getElementById("totalWords").textContent = tokens.length;
  document.getElementById("uniqueWords").textContent = freq.size;
  document.getElementById("repeatWords").textContent = repeated;
  for (const id of ["stats", "tableHead", "prevHead"]) document.getElementById(id).classList.remove("hidden");

  // Overused = repeated AND (not a stopword OR used >= 5 times).
  const rows = [...freq.entries()]
    .filter(([w, c]) => c > 1 && (!STOPWORDS.has(w) || c >= 5))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 30);
  const max = rows.length ? rows[0][1] : 1;
  table.innerHTML = "";
  if (!rows.length) {
    table.innerHTML = '<div class="trow"><span class="word">No repeated content words found. 🎉</span></div>';
  }
  for (const [w, c] of rows) {
    const row = document.createElement("div");
    row.className = "trow";
    row.innerHTML = `<span class="word">${escapeHtml(w)}</span><span class="bar"><i style="width:${Math.round((c / max) * 100)}%"></i></span><span class="cnt">×${c}</span>`;
    row.addEventListener("click", () => {
      selected = selected === w ? null : w;
      table.querySelectorAll(".trow").forEach((r) => r.classList.remove("sel"));
      if (selected) row.classList.add("sel");
      renderPreview();
    });
    table.appendChild(row);
  }
  selected = null;
  renderPreview();
}

/** Render preview with the selected word highlighted (case-insensitive). */
function renderPreview() {
  if (!selected) {
    preview.innerHTML = escapeHtml(input.value.trim()).slice(0, 4000) || '<span style="color:var(--mut)">Preview appears here.</span>';
    return;
  }
  const re = new RegExp("(" + selected.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ")", "gi");
  preview.innerHTML = escapeHtml(input.value.trim()).replace(re, "<mark>$1</mark>");
}

document.getElementById("analyzeBtn").addEventListener("click", analyze);

document.getElementById("grabBtn").addEventListener("click", async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.id || !/^https?:|^file:/.test(tab.url || "")) return;
  try {
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["content.js"] });
    const res = await chrome.tabs.sendMessage(tab.id, { cmd: "grab" });
    if (res && res.ok && res.text) {
      input.value = res.text;
      analyze();
    }
  } catch (e) { /* page unreachable */ }
});
