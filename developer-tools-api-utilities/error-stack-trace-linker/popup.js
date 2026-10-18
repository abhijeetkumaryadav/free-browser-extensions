// Error Stack Trace Linker — popup logic.
// Best-effort parser for Chrome/V8, Firefox, and Node stack formats.

const $ = (id) => document.getElementById(id);

// Matches: at fn (file:line:col) | at file:line:col | at async fn (file:line)
// The location group is lazy so ":line:col" binds to the LAST colon pair.
const CHROME_RE = /^\s*at\s+(?:async\s+)?(?:(.*?)\s*\()?(.+?):(\d+)(?::(\d+))?\)?\s*$/;
// Matches: fn@file:line:col | @file:line (Firefox)
const FIREFOX_RE = /^([^@\s][^@]*)?@(.+?):(\d+)(?::(\d+))?\s*$/;

function parseTrace(text) {
  const frames = [];
  let title = "";
  for (const rawLine of text.split("\n")) {
    const line = rawLine.trimEnd();
    if (!line.trim()) continue;
    let m = line.match(CHROME_RE);
    if (m) {
      frames.push({
        fn: (m[1] || "").trim() || "(anonymous)",
        file: m[2], line: m[3], col: m[4] || "",
        raw: line.trim(),
      });
      continue;
    }
    if (/@/.test(line) && !/^\s*at\s/.test(line)) {
      m = line.match(FIREFOX_RE);
      if (m) {
        frames.push({
          fn: (m[1] || "").trim() || "(anonymous)",
          file: m[2], line: m[3], col: m[4] || "",
          raw: line.trim(),
        });
        continue;
      }
    }
    // First non-frame line is treated as the error title.
    if (!frames.length && !title) title = line.trim();
  }
  return { title, frames };
}

function isLocalPath(file) {
  return /^(?:[a-zA-Z]:[\\/]|\\\\|\/[^/]|file:\/\/)/.test(file);
}

function vscodeUrl(frame) {
  let p = frame.file.replace(/^file:\/\//, "");
  try { p = decodeURIComponent(p); } catch (e) { /* keep raw */ }
  return `vscode://file/${p}:${frame.line}${frame.col ? ":" + frame.col : ""}`;
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

let lastResult = null;

document.addEventListener("DOMContentLoaded", init);

async function init() {
  $("parseBtn").addEventListener("click", parse);
  $("clearBtn").addEventListener("click", async () => {
    $("traceInput").value = "";
    await chrome.storage.local.remove("lastTrace");
    renderEmpty();
  });
  $("copyShare").addEventListener("click", copyShare);
  const { lastTrace = "" } = await chrome.storage.local.get("lastTrace");
  if (lastTrace) {
    $("traceInput").value = lastTrace;
    parse();
  }
}

async function parse() {
  const text = $("traceInput").value;
  await chrome.storage.local.set({ lastTrace: text });
  lastResult = parseTrace(text);
  if (!lastResult.frames.length) {
    renderEmpty("No stack frames found — paste a trace with lines like `at fn (file:12:3)` or `fn@file:12:3`.");
    return;
  }
  renderFrames();
  renderShare();
}

function renderEmpty(msg) {
  $("framesCard").hidden = true;
  $("shareCard").hidden = true;
  lastResult = null;
  if (msg) {
    // Reuse the note area briefly by injecting a temporary state row.
    const card = $("framesCard");
    card.hidden = false;
    $("frameCount").textContent = "";
    $("frames").innerHTML = `<div class="empty-state">${esc(msg)}</div>`;
  }
}

function renderFrames() {
  const { frames } = lastResult;
  $("framesCard").hidden = false;
  $("frameCount").textContent = `${frames.length} frame${frames.length === 1 ? "" : "s"}`;
  const box = $("frames");
  box.innerHTML = "";
  frames.forEach((f) => {
    const div = document.createElement("div");
    div.className = "frame";
    const local = isLocalPath(f.file);
    const openHref = local ? vscodeUrl(f) : f.file;
    const openLabel = local ? "VS Code" : "Open file";
    div.innerHTML =
      `<div class="fn">${esc(f.fn)}</div>` +
      `<div class="loc">${esc(f.file)}:<b>${esc(f.line)}${f.col ? ":" + esc(f.col) : ""}</b></div>` +
      `<div class="acts"><button data-act="copy">Copy frame</button>` +
      `<a data-act="open" href="${esc(openHref)}" target="_blank" rel="noopener">${openLabel}</a></div>`;
    div.querySelector('[data-act="copy"]').addEventListener("click", (e) => {
      navigator.clipboard.writeText(f.raw).then(() => {
        e.target.textContent = "Copied ✓";
        setTimeout(() => { e.target.textContent = "Copy frame"; }, 1200);
      });
    });
    box.appendChild(div);
  });
}

function shareableText() {
  if (!lastResult) return "";
  const { title, frames } = lastResult;
  const lines = ["```", title || "Stack trace"];
  for (const f of frames) {
    lines.push(`  at ${f.fn} (${f.file}:${f.line}${f.col ? ":" + f.col : ""})`);
  }
  lines.push("```");
  return lines.join("\n");
}

function renderShare() {
  $("shareCard").hidden = false;
  $("sharePre").textContent = shareableText();
}

function copyShare() {
  navigator.clipboard.writeText(shareableText()).then(() => {
    $("copyShare").textContent = "Copied ✓";
    setTimeout(() => { $("copyShare").textContent = "Copy shareable version"; }, 1200);
  });
}
