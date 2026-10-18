// Markdown Universal Clipper — popup logic.
// extractPage() is injected into the active tab; it must stay fully
// self-contained (no references to popup scope).

/**
 * Runs inside the page. Returns a plain object describing the clip.
 * @param {Object} opts - { excerpt: boolean, images: boolean }
 */
function extractPage(opts) {
  const sel = (window.getSelection() || "").toString().trim();

  const title = (document.title || "").trim() || location.href;
  const url = location.href;
  const host = location.hostname.replace(/^www\./, "");

  // Best-effort article text: prefer <article>, else body.
  let excerpt = "";
  if (opts.excerpt) {
    const src = document.querySelector("article") || document.body;
    const raw = (src.innerText || "")
      .replace(/[ \t\u00a0]+/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
    excerpt = raw.slice(0, 4000);
  }

  // Image references (http/https only, capped).
  const images = [];
  if (opts.images) {
    const seen = new Set();
    document.querySelectorAll("img").forEach((img) => {
      if (images.length >= 15) return;
      const src = img.currentSrc || img.src || "";
      if (!src || seen.has(src)) return;
      if (!/^https?:\/\//i.test(src)) return; // skip data:/blob:
      seen.add(src);
      images.push({ alt: (img.alt || "").trim(), src });
    });
  }

  return { title, url, host, selection: sel, excerpt, images };
}

const $ = (id) => document.getElementById(id);
let lastMarkdown = "";
let lastTitle = "clip";

document.addEventListener("DOMContentLoaded", init);

async function init() {
  $("clipBtn").addEventListener("click", clip);
  $("copyBtn").addEventListener("click", copyMarkdown);
  $("dlBtn").addEventListener("click", downloadMarkdown);

  // Show the host of the active tab in the header.
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.url) {
      $("pageHost").textContent = new URL(tab.url).hostname.replace(/^www\./, "");
    }
  } catch (e) {
    $("pageHost").textContent = "No page detected";
  }
}

async function clip() {
  const btn = $("clipBtn");
  btn.disabled = true;
  btn.textContent = "Clipping…";
  $("status").textContent = "";
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id) throw new Error("no-tab");

    const opts = {
      excerpt: $("optExcerpt").checked,
      images: $("optImages").checked,
    };
    const [res] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: extractPage,
      args: [opts],
    });
    const data = res && res.result;
    if (!data) throw new Error("no-data");

    lastTitle = data.title;
    lastMarkdown = buildMarkdown(data, $("optSelection").checked);
    $("preview").textContent = lastMarkdown;
    $("previewCard").hidden = false;
    $("status").textContent = "";
  } catch (e) {
    $("status").textContent =
      "Couldn’t clip this page (try a regular web page, not a browser or store page).";
  } finally {
    btn.disabled = false;
    btn.textContent = "Clip this page";
  }
}

/** Escape characters that would break Markdown structure. */
function escMd(text) {
  return String(text).replace(/([\\`*_{}[\]()#+\-.!|])/g, "\\$1");
}

/** Turn a paragraph block into Markdown blockquote lines. */
function toQuote(text) {
  return String(text)
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => "> " + l)
    .join("\n");
}

function buildMarkdown(data, useSelection) {
  const stamp = new Date().toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
  const lines = [];
  lines.push("# " + data.title.replace(/^#+\s*/, ""));
  lines.push("");
  lines.push(`> Clipped from [${data.host}](${data.url}) · ${stamp}`);
  lines.push("");

  if (useSelection && data.selection) {
    lines.push("## Selected text");
    lines.push("");
    lines.push(toQuote(data.selection));
    lines.push("");
  }

  if (data.excerpt) {
    lines.push("## Page excerpt");
    lines.push("");
    lines.push(data.excerpt);
    lines.push("");
  }

  if (data.images.length) {
    lines.push("## Images");
    lines.push("");
    for (const img of data.images) {
      const alt = img.alt ? escMd(img.alt) : "image";
      lines.push(`![${alt}](${img.src})`);
    }
    lines.push("");
  }

  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim() + "\n";
}

async function copyMarkdown() {
  if (!lastMarkdown) return;
  try {
    await navigator.clipboard.writeText(lastMarkdown);
    $("status").textContent = "Copied to clipboard ✓";
  } catch (e) {
    // Fallback for older hosts: hidden textarea + execCommand.
    const ta = document.createElement("textarea");
    ta.value = lastMarkdown;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand("copy");
      $("status").textContent = "Copied to clipboard ✓";
    } catch (err) {
      $("status").textContent = "Copy failed — select the preview text manually.";
    }
    ta.remove();
  }
}

function slugify(text) {
  return (
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "clip"
  );
}

function downloadMarkdown() {
  if (!lastMarkdown) return;
  const blob = new Blob([lastMarkdown], { type: "text/markdown;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = slugify(lastTitle) + ".md";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  $("status").textContent = "Downloaded ✓";
}
