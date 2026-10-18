/* TOCsmith — table of contents builder. Read-only; all on-device. */
"use strict";

const $ = (id) => document.getElementById(id);
const tocList = $("tocList"), emptyState = $("emptyState"), countBadge = $("countBadge");

/* ---------- Page-injected functions (must be self-contained) ---------- */

/** Collect h1–h6 from the page. Read-only except assigning ids for scrolling. */
function collectHeadings() {
  const out = [];
  document.querySelectorAll("h1, h2, h3, h4, h5, h6").forEach((el, i) => {
    const text = (el.innerText || "").replace(/\s+/g, " ").trim();
    if (!text) return;
    if (!el.id) el.id = "tocsmith-" + i; // stable anchor for click-to-scroll
    out.push({ level: Number(el.tagName[1]), text: text.slice(0, 200), id: el.id });
  });
  return out;
}

/** Scroll the page to a heading id. */
function scrollToHeading(id) {
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
}

/* ---------- Shared TOC logic ---------- */

/** Escape HTML so page/markdown text can never inject markup. */
function esc(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;")
                  .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Parse ATX headings (# …) from Markdown text. Ignores fenced code blocks. */
function parseMarkdownHeadings(md) {
  const out = [];
  let inFence = false;
  for (const line of md.replace(/\r\n?/g, "\n").split("\n")) {
    if (/^\s*```/.test(line)) { inFence = !inFence; continue; }
    if (inFence) continue;
    const m = /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line);
    if (m) out.push({ level: m[1].length, text: m[2].trim().slice(0, 200), id: null });
  }
  return out;
}

/** Render entries as a nested clickable TOC. Entries with an id scroll the page. */
function renderToc(entries) {
  tocList.innerHTML = "";
  emptyState.style.display = entries.length ? "none" : "block";
  countBadge.textContent = entries.length ? `(${entries.length})` : "";
  if (!entries.length) return;

  const base = Math.min(...entries.map((e) => e.level)); // normalize indentation
  entries.forEach((e) => {
    const btn = document.createElement("button");
    btn.className = "toc-item";
    btn.style.paddingLeft = `${10 + (e.level - base) * 16}px`;
    btn.innerHTML = `<span class="lvl">H${e.level}</span>${esc(e.text)}`;
    btn.title = e.text;
    if (e.id) {
      btn.addEventListener("click", () => scrollToActiveTab(e.id));
    } else {
      btn.disabled = true; // markdown mode: no page target to scroll to
      btn.style.cursor = "default";
    }
    tocList.appendChild(btn);
  });
}

async function scrollToActiveTab(id) {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return;
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: scrollToHeading,
      args: [id],
    });
  } catch (err) {
    console.warn("TOCsmith: scroll failed", err);
  }
}

/** Build a nested Markdown list, e.g. "- [text](#anchor)" style (plain bullets). */
function toMarkdown(entries) {
  const base = Math.min(...entries.map((e) => e.level));
  return entries.map((e) => `${"  ".repeat(e.level - base)}- ${e.text}`).join("\n");
}

/** Build a nested HTML list. */
function toHtml(entries) {
  const base = Math.min(...entries.map((e) => e.level));
  let html = "";
  let depth = 0;
  for (const e of entries) {
    const want = e.level - base;
    while (depth < want) { html += "<ul>\n"; depth++; }
    while (depth > want) { html += "</ul>\n"; depth--; }
    html += `<li>${esc(e.text)}</li>\n`;
  }
  while (depth > 0) { html += "</ul>\n"; depth--; }
  return `<ul>\n${html}</ul>`;
}

let currentEntries = [];

async function copyText(text, label) {
  try {
    await navigator.clipboard.writeText(text);
    flashButton(label);
  } catch {
    // Fallback for clipboard permission denial: select via temp textarea.
    const ta = document.createElement("textarea");
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    ta.remove();
    flashButton(label);
  }
}

function flashButton(label) {
  const btn = label === "md" ? $("copyMdBtn") : $("copyHtmlBtn");
  const orig = btn.textContent;
  btn.textContent = "Copied!";
  setTimeout(() => { btn.textContent = orig; }, 1200);
}

/* ---------- Events ---------- */

$("scanBtn").addEventListener("click", async () => {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) throw new Error("no active tab");
    const [res] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: collectHeadings,
    });
    currentEntries = res?.result || [];
    renderToc(currentEntries);
    // Remember last page scan per tab for this session (cheap convenience).
    if (currentEntries.length) {
      await chrome.storage.local.set({ "tocsmith.last": { url: tab.url, entries: currentEntries } });
    }
  } catch (err) {
    console.warn("TOCsmith: scan failed", err);
    alert("Couldn't scan this page (unsupported page type, e.g. chrome://).");
  }
});

$("parseBtn").addEventListener("click", () => {
  currentEntries = parseMarkdownHeadings($("mdInput").value);
  renderToc(currentEntries);
});

$("copyMdBtn").addEventListener("click", () => {
  if (!currentEntries.length) return;
  copyText(toMarkdown(currentEntries), "md");
});

$("copyHtmlBtn").addEventListener("click", () => {
  if (!currentEntries.length) return;
  copyText(toHtml(currentEntries), "html");
});

// Tabs
$("tabPage").addEventListener("click", () => {
  $("tabPage").classList.add("active"); $("tabMd").classList.remove("active");
  $("pageMode").hidden = false; $("mdMode").hidden = true;
});
$("tabMd").addEventListener("click", () => {
  $("tabMd").classList.add("active"); $("tabPage").classList.remove("active");
  $("mdMode").hidden = false; $("pageMode").hidden = true;
});

/* ---------- Init: restore last scan if it's for the current tab ---------- */
(async () => {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const data = await chrome.storage.local.get("tocsmith.last");
    const last = data["tocsmith.last"];
    if (last && tab?.url && last.url === tab.url && last.entries?.length) {
      currentEntries = last.entries;
      renderToc(currentEntries);
    }
  } catch { /* storage unavailable — non-fatal */ }
})();
