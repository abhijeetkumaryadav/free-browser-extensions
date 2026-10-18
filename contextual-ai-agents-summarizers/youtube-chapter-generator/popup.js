// YouTube Chapter Generator — popup logic.
// Injected reader must stay self-contained (runs in the page).

function readVideoData() {
  try {
    const r = window.ytInitialPlayerResponse;
    const d = r && r.videoDetails;
    if (!d) return null;
    return { title: d.title || "", videoId: d.videoId || "", description: d.shortDescription || "" };
  } catch (e) { return null; }
}

const $ = (id) => document.getElementById(id);
let chapters = [];   // [{ secs, title }]
let videoId = null;

document.addEventListener("DOMContentLoaded", init);

async function init() {
  $("addBtn").addEventListener("click", () => { addChapter(suggestNextSecs(), ""); });
  $("copyBtn").addEventListener("click", copyPreview);
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const onWatch = tab && tab.url && /youtube\.com\/watch/.test(tab.url);
  if (!onWatch) {
    $("notYt").hidden = false;
    return;
  }
  $("notYt").hidden = true;
  $("editor").hidden = false;
  try { $("pageHost").textContent = new URL(tab.url).hostname.replace(/^www\./, ""); } catch (e) {}
  $("importBtn").hidden = false;
  $("importBtn").addEventListener("click", importFromPage);
  // restore draft for this video
  try {
    const [res] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: readVideoData });
    const v = res && res.result;
    if (v && v.videoId) {
      videoId = v.videoId;
      $("videoTitle").textContent = v.title || "Untitled video";
      $("videoTitle").title = v.title || "";
      const key = "draft:" + videoId;
      const saved = await chrome.storage.local.get(key);
      if (saved[key] && saved[key].length) chapters = saved[key];
    }
  } catch (e) { /* page not ready — user can still build manually */ }
  if (!chapters.length) {
    chapters = [
      { secs: 0, title: "Intro" },
      { secs: 60, title: "" },
      { secs: 180, title: "" },
    ];
  }
  render();
}

async function importFromPage() {
  const btn = $("importBtn");
  btn.disabled = true; btn.textContent = "…";
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const [res] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: readVideoData });
    const v = res && res.result;
    if (!v || !v.description) throw new Error("no-desc");
    const found = parseChapters(v.description);
    if (!found.length) throw new Error("no-chapters");
    chapters = found;
    if (v.videoId) videoId = v.videoId;
    render();
    persist();
  } catch (e) {
    showErrors(["No chapter-style timestamps found in this video's description."]);
  } finally {
    btn.disabled = false; btn.textContent = "Import";
  }
}

// Lines like "00:00 Intro" or "1:02:03 Deep dive"
function parseChapters(desc) {
  const out = [];
  for (const line of desc.split("\n")) {
    const m = line.match(/^\s*(?:(\d{1,3}):)?(\d{1,2}):(\d{2})\s*[–—\-:]*\s*(.+?)\s*$/);
    if (!m || !m[4]) continue;
    const secs = (m[1] ? parseInt(m[1], 10) * 3600 : 0) + parseInt(m[2], 10) * 60 + parseInt(m[3], 10);
    const title = m[4].trim();
    if (title.length > 120) continue;
    out.push({ secs, title });
  }
  out.sort((a, b) => a.secs - b.secs);
  return out;
}

function fmtTs(secs) {
  secs = Math.max(0, Math.floor(secs));
  const h = Math.floor(secs / 3600), m = Math.floor((secs % 3600) / 60), s = secs % 60;
  const mm = h > 0 ? String(m).padStart(2, "0") : String(m);
  return (h > 0 ? h + ":" : "") + mm + ":" + String(s).padStart(2, "0");
}

function parseTs(str) {
  const m = String(str).trim().match(/^(?:(\d{1,3}):)?(\d{1,3}):(\d{2})$/);
  if (!m) return null;
  if (parseInt(m[3], 10) > 59) return null;
  return (m[1] ? parseInt(m[1], 10) * 3600 : 0) + parseInt(m[2], 10) * 60 + parseInt(m[3], 10);
}

function suggestNextSecs() {
  if (!chapters.length) return 0;
  return chapters[chapters.length - 1].secs + 60;
}

function addChapter(secs, title) {
  chapters.push({ secs, title });
  chapters.sort((a, b) => a.secs - b.secs);
  render(); persist();
}

function render() {
  const box = $("chapters");
  box.innerHTML = "";
  chapters.forEach((c, i) => {
    const row = document.createElement("div");
    row.className = "ch-row";
    const ts = document.createElement("input");
    ts.type = "text"; ts.className = "ts"; ts.value = fmtTs(c.secs);
    ts.placeholder = "0:00"; ts.title = "Timestamp (m:ss or h:mm:ss)";
    ts.addEventListener("change", () => {
      const v = parseTs(ts.value);
      if (v == null) { ts.value = fmtTs(c.secs); return; }
      c.secs = v;
      chapters.sort((a, b) => a.secs - b.secs);
      render(); persist();
    });
    const ti = document.createElement("input");
    ti.type = "text"; ti.className = "title"; ti.value = c.title;
    ti.placeholder = "Chapter title"; ti.maxLength = 100;
    ti.addEventListener("input", () => { c.title = ti.value; renderPreview(); persistDebounced(); });
    const x = document.createElement("button");
    x.className = "x"; x.textContent = "×"; x.title = "Remove chapter";
    x.addEventListener("click", () => { chapters.splice(i, 1); render(); persist(); });
    row.append(ts, ti, x);
    box.appendChild(row);
  });
  renderPreview();
}

function validate() {
  const errs = [];
  if (chapters.length < 3) errs.push(`Add at least 3 chapters (you have ${chapters.length}).`);
  if (chapters.length && chapters[0].secs !== 0) errs.push("The first chapter must start at 00:00.");
  for (let i = 1; i < chapters.length; i++) {
    if (chapters[i].secs <= chapters[i - 1].secs) { errs.push("Timestamps must be in strictly increasing order."); break; }
  }
  chapters.forEach((c, i) => { if (!c.title.trim()) errs.push(`Chapter ${i + 1} needs a title.`); });
  return errs;
}

function renderPreview() {
  const sorted = [...chapters].sort((a, b) => a.secs - b.secs);
  $("preview").textContent = sorted.map((c) => `${fmtTs(c.secs)} ${c.title.trim() || "…"}`).join("\n");
  const errs = validate();
  showErrors(errs);
  $("copyBtn").disabled = errs.length > 0;
  $("copyBtn").style.opacity = errs.length ? 0.5 : 1;
}

function showErrors(errs) {
  const box = $("errors");
  box.innerHTML = "";
  box.hidden = errs.length === 0;
  errs.forEach((e) => {
    const d = document.createElement("div");
    d.textContent = "• " + e;
    box.appendChild(d);
  });
}

async function copyPreview() {
  const text = $("preview").textContent;
  try {
    await navigator.clipboard.writeText(text);
  } catch (e) {
    const ta = document.createElement("textarea");
    ta.value = text; document.body.appendChild(ta); ta.select();
    document.execCommand("copy"); ta.remove();
  }
  const btn = $("copyBtn");
  btn.textContent = "Copied ✓";
  setTimeout(() => { btn.textContent = "Copy chapter list"; }, 1500);
}

let persistTimer = null;
function persistDebounced() {
  clearTimeout(persistTimer);
  persistTimer = setTimeout(persist, 600);
}
async function persist() {
  if (!videoId) return;
  try { await chrome.storage.local.set({ ["draft:" + videoId]: chapters.slice(0, 100) }); } catch (e) {}
}
