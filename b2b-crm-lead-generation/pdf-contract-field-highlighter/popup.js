// Contract Field Highlighter — popup logic.
// Pattern-based clause spotting (regex heuristics over pasted text).
// Everything on-device; checklist + last text persisted via chrome.storage.local.

const $ = (id) => document.getElementById(id);

// Clause definitions: id, display label, review tip, and regex patterns.
const CLAUSES = [
  { id: "termination", label: "Termination", tip: "Notice period, for-cause vs for-convenience, effects of termination.",
    patterns: [/termination for (convenience|cause)/i, /\bterminat\w*/i, /notice of termination/i] },
  { id: "liability", label: "Liability cap", tip: "Cap amount, excluded damages (consequential/indirect), indemnities.",
    patterns: [/limitation of liability/i, /liabilit\w*\s*cap/i, /cap on damages/i, /consequential damages/i, /indemnif\w*/i] },
  { id: "payment", label: "Payment terms", tip: "Net terms, invoicing cadence, late fees, currency.",
    patterns: [/payment terms/i, /net\s?(15|30|45|60|90)/i, /invoic\w*/i, /late (fee|payment|charges)/i] },
  { id: "renewal", label: "Renewal / auto-renew", tip: "Auto-renewal, renewal notice window, price uplift on renewal.",
    patterns: [/auto[\s-]?renew\w*/i, /automatic renewal/i, /\brenewal\b/i] },
  { id: "confidentiality", label: "Confidentiality", tip: "Definition of confidential info, obligations, survival period.",
    patterns: [/confidential\w*/i, /non[\s-]?disclosure/i, /\bNDA\b/] },
  { id: "governing", label: "Governing law", tip: "Governing law, jurisdiction/venue, arbitration clause.",
    patterns: [/governing law/i, /jurisdiction/i, /arbitrat\w*/i, /\bvenue\b/i] },
];

const CTX = 220; // characters of context shown around each match

document.addEventListener("DOMContentLoaded", init);

async function init() {
  $("scan").addEventListener("click", scan);
  $("clear").addEventListener("click", async () => {
    $("contract").value = "";
    $("results").innerHTML = "";
    $("progressCard").hidden = true;
    $("empty").style.display = "";
    await chrome.storage.local.set({ ch_state: { text: "", checked: {} } });
  });
  const { ch_state } = await chrome.storage.local.get("ch_state");
  if (ch_state && ch_state.text) {
    $("contract").value = ch_state.text;
    scan(ch_state.checked || {});
  }
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// Find all non-overlapping matches for a clause, merged across patterns.
function findMatches(text, clause) {
  const hits = [];
  for (const re of clause.patterns) {
    const g = new RegExp(re.source, re.flags.includes("g") ? re.flags : re.flags + "g");
    let m;
    while ((m = g.exec(text)) !== null) {
      hits.push({ start: m.index, end: m.index + m[0].length, term: m[0] });
      if (m[0].length === 0) g.lastIndex++;
    }
  }
  hits.sort((a, b) => a.start - b.start);
  const merged = [];
  for (const h of hits) {
    const last = merged[merged.length - 1];
    if (last && h.start <= last.end + 40) {
      last.end = Math.max(last.end, h.end);
    } else merged.push({ ...h });
  }
  return merged;
}

// Extract a context window snapped to word boundaries, with <mark> on the hit.
function contextHtml(text, hit) {
  let s = Math.max(0, hit.start - CTX);
  let e = Math.min(text.length, hit.end + CTX);
  if (s > 0) { const sp = text.indexOf(" ", s); if (sp > 0 && sp < s + 40) s = sp + 1; }
  if (e < text.length) { const sp = text.lastIndexOf(" ", e); if (sp > e - 40) e = sp; }
  const pre = (s > 0 ? "… " : "") + text.slice(s, hit.start);
  const post = text.slice(hit.end, e) + (e < text.length ? " …" : "");
  return esc(pre) + "<mark>" + esc(hit.term) + "</mark>" + esc(post);
}

async function scan(restoredChecked) {
  const text = $("contract").value;
  const box = $("results");
  box.innerHTML = "";
  if (!text.trim()) {
    $("progressCard").hidden = true;
    $("empty").style.display = "";
    return;
  }
  const { ch_state } = await chrome.storage.local.get("ch_state");
  const checked = restoredChecked || ((ch_state && ch_state.checked) || {});
  $("empty").style.display = "none";
  $("progressCard").hidden = false;

  let done = 0;
  for (const clause of CLAUSES) {
    const hits = findMatches(text, clause);
    const isDone = !!checked[clause.id];
    if (isDone) done++;

    const card = document.createElement("div");
    card.className = "clause";

    const top = document.createElement("div");
    top.className = "top";
    const dot = document.createElement("div");
    dot.className = "dot" + (hits.length ? "" : " miss");
    const label = document.createElement("b");
    label.textContent = clause.label;
    label.title = clause.tip;
    const n = document.createElement("span");
    n.className = "n";
    n.textContent = hits.length ? `${hits.length} found` : "not found";
    const lab = document.createElement("label");
    lab.className = "check";
    const cb = document.createElement("input");
    cb.type = "checkbox"; cb.checked = isDone;
    cb.addEventListener("change", async () => {
      checked[clause.id] = cb.checked;
      await chrome.storage.local.set({ ch_state: { text: $("contract").value, checked } });
      updateProgress();
    });
    const span = document.createElement("span");
    span.textContent = "Reviewed";
    lab.append(cb, span);
    top.append(dot, label, n, lab);
    card.appendChild(top);

    const shown = hits.slice(0, 3);
    for (const h of shown) {
      const ctx = document.createElement("div");
      ctx.className = "ctx";
      ctx.innerHTML = contextHtml(text, h);
      card.appendChild(ctx);
    }
    if (hits.length > 3) {
      const more = document.createElement("div");
      more.className = "more";
      more.textContent = `+ ${hits.length - 3} more occurrence${hits.length - 3 === 1 ? "" : "s"}`;
      card.appendChild(more);
    }
    box.appendChild(card);
  }

  await chrome.storage.local.set({ ch_state: { text, checked } });
  updateProgress();

  function updateProgress() {
    const total = CLAUSES.length;
    const n = CLAUSES.filter((c) => checked[c.id]).length;
    $("prog").textContent = `(${n}/${total})`;
    $("barFill").style.width = ((n / total) * 100).toFixed(0) + "%";
  }
  updateProgress();
}
