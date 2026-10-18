// Return Policy Analyzer — popup logic.
// scanPolicy() runs inside the page; it only reads visible text and links.

function scanPolicy() {
  const text = ((document.body && document.body.innerText) || "").slice(0, 250000);
  const signals = [];
  const clean = (s) => (s || "").replace(/\s+/g, " ").trim().slice(0, 160);

  // --- return window (days) ---
  let days = null, daysPhrase = null;
  const patterns = [
    /(?:within|up to|for)\s+(\d{1,3})\s*days?[^.\n]{0,50}returns?/gi,
    /returns?[^.\n]{0,60}(?:within|up to|for)\s+(\d{1,3})\s*days?/gi,
    /(\d{1,3})\s*[-–]?\s*day\s+returns?/gi,
  ];
  for (const re of patterns) {
    let m;
    while ((m = re.exec(text)) !== null) {
      const n = parseInt(m[1], 10);
      if (n >= 1 && n <= 365 && (days === null || n > days)) {
        days = n; daysPhrase = clean(m[0]);
      }
    }
  }
  signals.push({ key: "window", label: "Return window", found: days !== null, phrase: daysPhrase, good: days !== null && days >= 30 });

  // --- free returns ---
  let m = text.match(/free\s+returns?/i);
  signals.push({ key: "free", label: "Free returns", found: !!m, phrase: m ? clean(m[0]) : null, good: !!m });

  // --- return shipping terms (often paid) ---
  m = text.match(/[^.\n]{0,40}return\s+shipping[^.\n]{0,40}/i);
  signals.push({ key: "shipping", label: "Return shipping terms", found: !!m, phrase: m ? clean(m[0]) : null, good: false, neutral: true });

  // --- restocking fee ---
  m = text.match(/[^.\n]{0,40}restocking\s+fees?[^.\n]{0,40}/i);
  signals.push({ key: "restocking", label: "Restocking fee", found: !!m, phrase: m ? clean(m[0]) : null, good: false });

  // --- final sale / non-returnable ---
  m = text.match(/final\s+sale|non[-– ]returnable|\bno\s+returns?\b/i);
  signals.push({ key: "final", label: "Final-sale / non-returnable", found: !!m, phrase: m ? clean(m[0]) : null, good: false });

  // --- exchange only ---
  m = text.match(/exchange\s+only/i);
  signals.push({ key: "exchange", label: "Exchange only", found: !!m, phrase: m ? clean(m[0]) : null, good: false });

  // --- link to a return-policy page ---
  let policyUrl = null;
  try {
    const a = [...document.querySelectorAll("a")].find((x) =>
      /return/i.test(x.textContent || "") || /return/i.test(x.getAttribute("href") || ""));
    if (a && a.href) policyUrl = a.href;
  } catch (e) {}

  // --- generosity score (null when nothing detected) ---
  const anyFound = signals.some((s) => s.found);
  let score = null;
  if (anyFound) {
    score = 100;
    if (days === null) score -= 25;
    else if (days < 7) score -= 35;
    else if (days < 14) score -= 20;
    else if (days < 30) score -= 10;
    if (!signals.find((s) => s.key === "free").found) score -= 15;
    if (signals.find((s) => s.key === "restocking").found) score -= 20;
    if (signals.find((s) => s.key === "final").found) score = Math.min(score, 20);
    if (signals.find((s) => s.key === "exchange").found) score -= 15;
    score = Math.max(0, Math.min(100, Math.round(score)));
  }
  return { signals, score, policyUrl, host: location.hostname.replace(/^www\./, "") };
}

const $ = (id) => document.getElementById(id);

document.addEventListener("DOMContentLoaded", async () => {
  $("scan").addEventListener("click", scan);
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab && tab.url) {
    try { $("pageHost").textContent = new URL(tab.url).hostname.replace(/^www\./, ""); } catch (e) {}
  }
});

async function scan() {
  const btn = $("scan");
  btn.disabled = true; btn.textContent = "Scanning…";
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id) throw new Error("no-tab");
    const [res] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: scanPolicy });
    render(res && res.result);
  } catch (e) {
    $("empty").style.display = "";
    $("empty").innerHTML = "Couldn't scan this page — try a regular store or product page.";
    $("resultCard").hidden = true;
  } finally {
    btn.disabled = false; btn.textContent = "Analyze";
  }
}

function scoreColor(s) {
  if (s === null) return "#9aa3b5";
  if (s >= 80) return "#22c55e";
  if (s >= 60) return "#f59e0b";
  return "#f43f5e";
}

function verdict(s) {
  if (s === null) return "No policy detected";
  if (s >= 80) return "Generous";
  if (s >= 60) return "Fair";
  if (s >= 40) return "Strict";
  return "Harsh";
}

function render(data) {
  if (!data) return;
  $("empty").style.display = "none";
  $("resultCard").hidden = false;
  const C = 226.2; // 2π·36
  const bar = $("ringBar");
  const s = data.score;
  bar.style.stroke = scoreColor(s);
  bar.style.strokeDashoffset = s === null ? C : (C * (1 - s / 100)).toFixed(1);
  $("scoreNum").textContent = s === null ? "?" : s;
  $("verdict").textContent = verdict(s);

  const box = $("signals");
  box.innerHTML = "";
  for (const sig of data.signals) {
    const row = document.createElement("div");
    row.className = "sig";
    const dot = document.createElement("div");
    dot.className = "dot " + (sig.found ? (sig.good ? "good" : (sig.neutral ? "neut" : "bad")) : "none");
    dot.textContent = sig.found ? (sig.good ? "✓" : (sig.neutral ? "•" : "✕")) : "–";
    const tx = document.createElement("div");
    tx.className = "tx";
    const b = document.createElement("b");
    b.textContent = sig.label;
    tx.appendChild(b);
    const span = document.createElement("span");
    span.textContent = sig.phrase ? `“${sig.phrase}”` : "Not mentioned on this page";
    tx.appendChild(span);
    row.append(dot, tx);
    box.appendChild(row);
  }

  const link = $("policyLink");
  if (data.policyUrl) {
    link.hidden = false;
    link.href = data.policyUrl;
  } else link.hidden = true;
}
