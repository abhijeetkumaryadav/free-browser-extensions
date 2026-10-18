// LLM Privacy Shield — PII detection and redaction, 100% on-device.
// Detection is heuristic; the UI reminds users to review before sending.

const $ = (id) => document.getElementById(id);

const PATTERNS = [
  {
    type: "EMAIL", label: "Emails",
    re: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
  },
  {
    type: "ID", label: "ID / card-like numbers",
    // SSN-style or 12–16 digit card-style groups.
    re: /\b(?:\d{3}-\d{2}-\d{4}|\d{4}[\s-]?\d{4}[\s-]?\d{4}(?:[\s-]?\d{4})?)\b/g,
  },
  {
    type: "PHONE", label: "Phone numbers",
    re: /\+?\d[\d\s().-]{6,}\d/g,
    // Must contain 7–15 digits to count as a phone number.
    validate: (v) => {
      const d = v.replace(/\D/g, "");
      return d.length >= 7 && d.length <= 15;
    },
  },
  {
    type: "ADDRESS", label: "Street addresses",
    re: /\b\d{1,5}\s+[A-Za-z]+(?:\s+[A-Za-z]+){0,3}\s+(?:Street|St|Avenue|Ave|Road|Rd|Lane|Ln|Drive|Dr|Boulevard|Blvd|Way|Court|Ct|Place|Pl|Terrace|Ter)\b/gi,
  },
  {
    type: "NAME", label: "Possible names (heuristic)",
    // Two consecutive capitalized words — catches most "First Last" forms.
    re: /\b([A-Z][a-z]{2,})\s+([A-Z][a-z]{2,})\b/g,
  },
];

const CHECKLIST = [
  "No passwords, API keys, or tokens",
  "No bank, card, or government ID numbers",
  "No one else's personal data without consent",
  "Check your company / school data policy first",
  "Prefer a fresh chat over one tied to your identity",
];

let redactedText = "";

document.addEventListener("DOMContentLoaded", init);

function init() {
  $("scan").addEventListener("click", scan);
  $("redact").addEventListener("click", redactAll);
  $("copy").addEventListener("click", copyRedacted);
  renderChecklist();
}

function esc(s) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function renderChecklist() {
  const box = $("checklist");
  box.innerHTML = "";
  for (const label of CHECKLIST) {
    const l = document.createElement("label");
    l.className = "check";
    const input = document.createElement("input");
    input.type = "checkbox";
    const span = document.createElement("span");
    span.textContent = label;
    l.append(input, span);
    box.appendChild(l);
  }
}

function findPII(text) {
  const found = [];
  PATTERNS.forEach((p, pri) => {
    p.re.lastIndex = 0;
    let m;
    while ((m = p.re.exec(text)) !== null) {
      const val = m[0];
      if (p.validate && !p.validate(val)) continue;
      found.push({ type: p.type, label: p.label, value: val, index: m.index, len: val.length, pri });
    }
  });
  // Sort by position; drop anything overlapping an earlier (higher-priority) match.
  found.sort((a, b) => a.index - b.index || a.pri - b.pri);
  const kept = [];
  let end = -1;
  for (const f of found) {
    if (f.index >= end) {
      kept.push(f);
      end = f.index + f.len;
    }
  }
  return kept;
}

function scan() {
  const text = $("src").value;
  if (!text.trim()) return;
  const kept = findPII(text);
  const res = $("res");
  res.hidden = false;
  const chips = $("chips");
  chips.innerHTML = "";

  if (!kept.length) {
    $("total").textContent = "— none found";
    const ok = document.createElement("div");
    ok.className = "chip";
    ok.textContent = "✓ No PII patterns detected";
    chips.appendChild(ok);
    $("preview").innerHTML = esc(text);
    redactedText = text;
    $("redact").disabled = true;
    $("copy").disabled = false;
    return;
  }

  $("total").textContent = `— ${kept.length} found`;
  const counts = {};
  for (const k of kept) counts[k.type] = (counts[k.type] || 0) + 1;
  for (const p of PATTERNS) {
    if (!counts[p.type]) continue;
    const c = document.createElement("span");
    c.className = "chip";
    c.innerHTML = `${esc(p.label)} <b>${counts[p.type]}</b>`;
    chips.appendChild(c);
  }

  // Highlighted preview (escaped HTML + <mark> wraps).
  let html = "";
  let pos = 0;
  for (const k of kept) {
    html += esc(text.slice(pos, k.index));
    html += `<mark title="${k.type}">${esc(k.value)}</mark>`;
    pos = k.index + k.len;
  }
  html += esc(text.slice(pos));
  $("preview").innerHTML = html;

  redactedText = applyRedaction(text, kept);
  $("redact").disabled = false;
  $("copy").disabled = false;
}

function applyRedaction(text, kept) {
  let out = "";
  let pos = 0;
  for (const k of kept) {
    out += text.slice(pos, k.index);
    out += `[${k.type}]`;
    pos = k.index + k.len;
  }
  return out + text.slice(pos);
}

function redactAll() {
  const text = $("src").value;
  const kept = findPII(text);
  // Redacted preview with placeholder marks.
  let html = "";
  let pos = 0;
  for (const k of kept) {
    html += esc(text.slice(pos, k.index));
    html += `<mark>[${k.type}]</mark>`;
    pos = k.index + k.len;
  }
  html += esc(text.slice(pos));
  $("preview").innerHTML = html;
  $("redact").disabled = true;
}

async function copyRedacted() {
  try {
    await navigator.clipboard.writeText(redactedText);
    $("copy").textContent = "Copied ✓";
    setTimeout(() => { $("copy").textContent = "Copy redacted"; }, 1500);
  } catch (e) {
    // Clipboard unavailable — select the preview so the user can copy manually.
    const r = document.createRange();
    r.selectNodeContents($("preview"));
    const sel = getSelection();
    sel.removeAllRanges();
    sel.addRange(r);
  }
}
