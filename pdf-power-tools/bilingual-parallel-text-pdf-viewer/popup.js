/* Parallelo — parallel text reader logic. All on-device; no network calls. */
"use strict";

/* ---------- DOM ---------- */
const $ = (id) => document.getElementById(id);
const editorView = $("editorView"), readerView = $("readerView");
const textA = $("textA"), textB = $("textB");
const langA = $("langA"), langB = $("langB");
const pairName = $("pairName"), savedSelect = $("savedSelect");

/* ---------- Helpers ---------- */

/**
 * Split raw text into paragraphs. Double newlines are hard breaks; if none
 * exist, fall back to single newlines so pasted one-line-per-paragraph
 * texts still align.
 */
function splitParagraphs(raw) {
  const t = (raw || "").replace(/\r\n?/g, "\n").trim();
  if (!t) return [];
  let parts = t.split(/\n\s*\n/).map((p) => p.replace(/\s+/g, " ").trim()).filter(Boolean);
  if (parts.length < 2) {
    parts = t.split("\n").map((p) => p.replace(/\s+/g, " ").trim()).filter(Boolean);
  }
  return parts;
}

/** Escape HTML so pasted text can never inject markup. */
function esc(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;")
          .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/* ---------- Saved pairs (chrome.storage.local) ---------- */
const STORE_KEY = "parallelo.pairs";

async function loadPairs() {
  const data = await chrome.storage.local.get(STORE_KEY);
  return data[STORE_KEY] || {};
}

async function persistPairs(pairs) {
  await chrome.storage.local.set({ [STORE_KEY]: pairs });
}

async function refreshSavedList(selectValue) {
  const pairs = await loadPairs();
  const names = Object.keys(pairs).sort();
  savedSelect.innerHTML = '<option value="">Saved pairs…</option>' +
    names.map((n) => `<option value="${esc(n)}">${esc(n)}</option>`).join("");
  if (selectValue && pairs[selectValue]) savedSelect.value = selectValue;
}

/* ---------- Reader rendering ---------- */
let syncing = false; // re-entrancy guard for synced scrolling

function renderReader() {
  const a = splitParagraphs(textA.value);
  const b = splitParagraphs(textB.value);
  if (!a.length || !b.length) {
    alert("Paste text into both Text A and Text B first.");
    return;
  }
  const n = Math.max(a.length, b.length);

  $("titleA").textContent = langA.value.trim() || "A";
  $("titleB").textContent = langB.value.trim() || "B";
  $("pairCount").textContent = `${n} paragraph${n === 1 ? "" : "s"}`;

  const bodyA = $("bodyA"), bodyB = $("bodyB");
  bodyA.innerHTML = ""; bodyB.innerHTML = "";
  for (let i = 0; i < n; i++) {
    const pa = document.createElement("div");
    pa.className = "para"; pa.dataset.idx = i;
    pa.innerHTML = `<span class="idx">#${i + 1}</span>${esc(a[i] || "—")}`;
    const pb = document.createElement("div");
    pb.className = "para"; pb.dataset.idx = i;
    pb.innerHTML = `<span class="idx">#${i + 1}</span>${esc(b[i] || "—")}`;
    bodyA.appendChild(pa); bodyB.appendChild(pb);
  }

  // Click a paragraph to highlight its pair on both sides (listeners attached once at init).
  // Synced scrolling (proportional, since pane heights differ).
  bodyA.onscroll = () => syncScroll(bodyA, bodyB);
  bodyB.onscroll = () => syncScroll(bodyB, bodyA);

  applySplit(); applyFont();
  editorView.hidden = true;
  readerView.hidden = false;
}

function onParaClick(e) {
  const para = e.target.closest(".para");
  if (!para) return;
  document.querySelectorAll(".para.active").forEach((el) => el.classList.remove("active"));
  const idx = para.dataset.idx;
  document.querySelectorAll(`.para[data-idx="${idx}"]`).forEach((el) => {
    el.classList.add("active");
    el.scrollIntoView({ block: "nearest", behavior: "smooth" });
  });
}

function syncScroll(src, dst) {
  if (!$("syncScroll").checked || syncing) return;
  const max = src.scrollHeight - src.clientHeight;
  if (max <= 0) return;
  syncing = true;
  dst.scrollTop = (src.scrollTop / max) * (dst.scrollHeight - dst.clientHeight);
  // Release the guard on the next frame so the mirrored scroll doesn't echo back.
  requestAnimationFrame(() => { syncing = false; });
}

function applySplit() {
  const v = Number($("splitRange").value);
  $("paneA").style.flex = `1 1 ${v}%`;
  $("paneB").style.flex = `1 1 ${100 - v}%`;
}

function applyFont() {
  const px = Number($("fontRange").value);
  $("bodyA").style.fontSize = px + "px";
  $("bodyB").style.fontSize = px + "px";
}

/* ---------- Events ---------- */
$("readBtn").addEventListener("click", renderReader);
$("backBtn").addEventListener("click", () => {
  readerView.hidden = true;
  editorView.hidden = false;
});
$("splitRange").addEventListener("input", applySplit);
$("fontRange").addEventListener("input", applyFont);

$("savePairBtn").addEventListener("click", async () => {
  const name = pairName.value.trim();
  if (!name) { alert("Give the pair a name first."); return; }
  if (!textA.value.trim() || !textB.value.trim()) {
    alert("Both texts must have content before saving.");
    return;
  }
  const pairs = await loadPairs();
  pairs[name] = { a: textA.value, b: textB.value, langA: langA.value, langB: langB.value };
  await persistPairs(pairs);
  pairName.value = "";
  await refreshSavedList(name);
});

savedSelect.addEventListener("change", async () => {
  const name = savedSelect.value;
  if (!name) return;
  const pairs = await loadPairs();
  const p = pairs[name];
  if (!p) return;
  textA.value = p.a; textB.value = p.b;
  langA.value = p.langA || ""; langB.value = p.langB || "";
});

$("deletePairBtn").addEventListener("click", async () => {
  const name = savedSelect.value;
  if (!name) return;
  if (!confirm(`Delete saved pair "${name}"?`)) return;
  const pairs = await loadPairs();
  delete pairs[name];
  await persistPairs(pairs);
  await refreshSavedList();
});

/* ---------- Init ---------- */
$("bodyA").addEventListener("click", onParaClick);
$("bodyB").addEventListener("click", onParaClick);
refreshSavedList();
