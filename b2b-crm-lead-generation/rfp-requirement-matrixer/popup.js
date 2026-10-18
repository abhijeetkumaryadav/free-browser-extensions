// RFP Requirement Matrixer — popup logic. All on-device; storage only.
// Best-effort requirement extraction from pasted text: numbered items
// (1., 1), 1), lettered items (a.), and bullets (-, *, •, –, —).

const $ = (id) => document.getElementById(id);
let matrix = []; // [{id, text, verdict, notes}]

document.addEventListener("DOMContentLoaded", init);

async function init() {
  $("buildBtn").addEventListener("click", buildMatrix);
  $("resetBtn").addEventListener("click", reset);
  $("exportBtn").addEventListener("click", exportCsv);
  // restore an in-progress matrix across popup opens
  const { matrix: saved = [] } = await chrome.storage.local.get("matrix");
  if (saved.length) { matrix = saved; showMatrix(); }
}

function extractRequirements(text) {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 4);
  const out = [];
  const patterns = [
    /^(\d+)\s*[\.\)\):]\s+(.+)/,          // 1. / 1) / 1:
    /^([a-zA-Z])\s*[\.\)]\s+(.+)/,        // a. / b)
    /^[-*•–—]\s+(.+)/,                    // bullets
    /^R-?(\d+)\s*[:\-]?\s+(.+)/i,         // R-1 / REQ 1
  ];
  for (const line of lines) {
    for (const p of patterns) {
      const m = line.match(p);
      if (m) {
        const txt = (m[2] || m[1]).trim();
        if (txt.length > 4 && !out.some((o) => o.text === txt)) {
          out.push({ id: "R" + (out.length + 1), text: txt, verdict: "pending", notes: "" });
        }
        break;
      }
    }
    if (out.length >= 120) break;
  }
  return out;
}

async function buildMatrix() {
  const text = $("rfpText").value.trim();
  const reqs = extractRequirements(text);
  if (!reqs.length) {
    $("buildBtn").textContent = "No requirements found — try different text";
    setTimeout(() => { $("buildBtn").textContent = "Build matrix"; }, 2000);
    return;
  }
  matrix = reqs;
  await chrome.storage.local.set({ matrix });
  showMatrix();
}

function reset() {
  matrix = [];
  chrome.storage.local.remove("matrix");
  $("matrixCard").hidden = true;
  $("pasteCard").hidden = false;
  $("exportBtn").hidden = true;
  $("rfpText").value = "";
}

function showMatrix() {
  $("pasteCard").hidden = true;
  $("matrixCard").hidden = false;
  $("exportBtn").hidden = false;
  renderRows();
  renderStats();
}

function renderStats() {
  const yes = matrix.filter((r) => r.verdict === "yes").length;
  const partial = matrix.filter((r) => r.verdict === "partial").length;
  const no = matrix.filter((r) => r.verdict === "no").length;
  $("stTotal").textContent = matrix.length;
  $("stYes").textContent = yes;
  $("stPartial").textContent = partial;
  $("stNo").textContent = no;
  const decided = yes + partial + no;
  $("barFill").style.width = matrix.length ? Math.round((decided / matrix.length) * 100) + "%" : "0";
}

function renderRows() {
  const box = $("rows");
  box.innerHTML = "";
  const labels = { pending: "Not decided", yes: "Yes — we comply", partial: "Partially", no: "No" };
  for (const r of matrix) {
    const card = document.createElement("div");
    card.className = "req";
    const rid = document.createElement("div");
    rid.className = "rid";
    rid.textContent = r.id;
    const txt = document.createElement("div");
    txt.className = "txt";
    txt.textContent = r.text;
    const ctl = document.createElement("div");
    ctl.className = "ctl";
    const sel = document.createElement("select");
    for (const v of ["pending", "yes", "partial", "no"]) {
      const o = document.createElement("option");
      o.value = v; o.textContent = labels[v];
      if (r.verdict === v) o.selected = true;
      sel.appendChild(o);
    }
    sel.addEventListener("change", async () => {
      r.verdict = sel.value;
      await chrome.storage.local.set({ matrix });
      renderStats();
    });
    const notes = document.createElement("input");
    notes.placeholder = "Notes / evidence…";
    notes.value = r.notes || "";
    notes.maxLength = 300;
    notes.addEventListener("change", async () => {
      r.notes = notes.value;
      await chrome.storage.local.set({ matrix });
    });
    ctl.append(sel, notes);
    card.append(rid, txt, ctl);
    box.appendChild(card);
  }
}

function exportCsv() {
  const esc = (v) => `"${String(v).replace(/"/g, '""')}"`;
  const csv = [["id", "requirement", "compliance", "notes"],
    ...matrix.map((r) => [r.id, r.text, r.verdict, r.notes || ""])]
    .map((row) => row.map(esc).join(",")).join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  a.download = "rfp-compliance-matrix.csv";
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}
