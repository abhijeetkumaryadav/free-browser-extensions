// Executive Summary — extractive summarizer, all on-device.
// The summarizer picks top-scoring sentences by keyword frequency and
// returns them in original order. Heuristic, not AI: fast and private.

// Compact English stopword set.
const STOPWORDS = new Set(("a,an,the,and,or,but,if,then,else,when,while,of,at,by,for,with,about,into,through,during,before,after,above,below,to,from,up,down,in,out,on,off,over,under,again,further,once,here,there,all,any,both,each,few,more,most,other,some,such,no,nor,not,only,own,same,so,than,too,very,can,will,just,should,now,is,are,was,were,be,been,being,have,has,had,having,do,does,did,doing,would,could,ought,i,you,he,she,it,we,they,them,his,her,its,our,their,this,that,these,those,as,also,may,might,must,shall,within,between,among,per").split(","));

// extractArticle() runs in the page: finds the main text container and
// returns concatenated paragraph text. Kept self-contained for injection.
function extractArticle() {
  const candidates = [
    document.querySelector("article"),
    document.querySelector("main"),
    document.querySelector('[role="main"]'),
  ].filter(Boolean);
  let root = candidates[0] || null;
  if (!root) {
    // Fallback: the div/section holding the most paragraph text.
    let best = null, bestLen = 0;
    for (const el of document.querySelectorAll("div,section")) {
      let len = 0;
      for (const p of el.querySelectorAll("p")) len += (p.innerText || "").length;
      if (len > bestLen && el.querySelectorAll("p").length >= 3) { bestLen = len; best = el; }
    }
    root = best || document.body;
  }
  const texts = [];
  for (const p of root.querySelectorAll("p,li,h1,h2")) {
    const t = (p.innerText || "").trim();
    if (t.length > 40) texts.push(t);
  }
  return texts.join("\n\n").slice(0, 60000);
}

const $ = (id) => document.getElementById(id);

document.addEventListener("DOMContentLoaded", () => {
  $("grab").addEventListener("click", grabPage);
  $("length").addEventListener("input", () => {
    $("lengthVal").textContent = $("length").value + " sentences";
  });
  $("summarize").addEventListener("click", () => summarize($("input").value));
});

async function grabPage() {
  const btn = $("grab");
  btn.disabled = true; btn.textContent = "Reading…";
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id) throw new Error("no-tab");
    const [res] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: extractArticle });
    const text = (res && res.result || "").trim();
    if (text.length < 200) {
      $("input").placeholder = "Couldn’t find article text on this page — paste text instead.";
    } else {
      $("input").value = text;
      summarize(text);
    }
  } catch (e) {
    $("input").placeholder = "Page read blocked (e.g. chrome:// pages) — paste text instead.";
  } finally {
    btn.disabled = false; btn.textContent = "Grab page";
  }
}

function splitSentences(text) {
  const out = text.replace(/\s+/g, " ").match(/[^.!?]+[.!?]+["”']?|\S[^.!?]*$/g) || [];
  return out.map((s) => s.trim()).filter((s) => s.split(/\s+/).length >= 5 && s.length <= 400);
}

function wordFreq(text) {
  const freq = new Map();
  for (const w of text.toLowerCase().match(/[a-z][a-z'-]{2,}/g) || []) {
    if (STOPWORDS.has(w)) continue;
    freq.set(w, (freq.get(w) || 0) + 1);
  }
  return freq;
}

function summarize(text) {
  text = (text || "").trim();
  if (text.length < 200) {
    $("resultCard").hidden = true;
    return;
  }
  const sentences = splitSentences(text);
  if (!sentences.length) { $("resultCard").hidden = true; return; }
  const freq = wordFreq(text);
  const scored = sentences.map((s, i) => {
    const words = s.toLowerCase().match(/[a-z][a-z'-]{2,}/g) || [];
    let score = 0;
    for (const w of words) if (!STOPWORDS.has(w)) score += freq.get(w) || 0;
    score = words.length ? score / Math.sqrt(words.length) : 0; // mild length normalization
    if (i < 2) score *= 1.15; // slight lead bias
    return { s, i, score };
  });
  const n = Math.min(parseInt($("length").value, 10) || 5, sentences.length);
  const top = scored.sort((a, b) => b.score - a.score).slice(0, n).sort((a, b) => a.i - b.i);
  $("summary").textContent = top.map((t) => t.s).join(" ");
  const words = text.split(/\s+/).length;
  $("stSent").textContent = top.length + " / " + sentences.length;
  $("stWords").textContent = words.toLocaleString();
  $("stRead").textContent = "≈ " + Math.max(1, Math.round(top.join(" ").split(/\s+/).length / 200)) + " min";
  // Key terms: top non-stopwords by frequency.
  const terms = [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  const box = $("terms");
  box.innerHTML = "";
  for (const [w] of terms) {
    const chip = document.createElement("span");
    chip.textContent = w;
    box.appendChild(chip);
  }
  $("resultCard").hidden = false;
}
