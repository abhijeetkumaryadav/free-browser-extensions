/**
 * Ghost Markdown Composer — Markdown post composer with live preview
 * and Ghost-compatible frontmatter.
 *
 * Pure client-side tool. No page access, no network. Draft auto-saves
 * to chrome.storage.local. Frontmatter follows common Ghost/YAML
 * conventions so it pastes cleanly into Ghost's editor or imports.
 */

"use strict";

const $ = (id) => document.getElementById(id);
const DEBOUNCE_MS = 400;
let saveTimer = null;

/* ------------------------------------------------------------------ */
/* Tiny Markdown renderer (no external libs — fully offline)           */
/* ------------------------------------------------------------------ */

/** Escape HTML so raw tags in the draft can't inject markup. */
function escapeHtml(s) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Inline formatting: code, bold, italic, links, images. */
function inline(md) {
  let out = escapeHtml(md);
  out = out.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, '<img alt="$1" src="$2" />');
  out = out.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  out = out.replace(/`([^`]+)`/g, "<code>$1</code>");
  out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  out = out.replace(/(^|\W)\*([^*\n]+)\*/g, "$1<em>$2</em>");
  out = out.replace(/(^|\W)_([^_\n]+)_/g, "$1<em>$2</em>");
  return out;
}

/** Block-level rendering: headings, lists, quotes, code fences, hr. */
function renderMarkdown(src) {
  const lines = src.split("\n");
  let html = "";
  let inCode = false;
  let listStack = []; // "ul" | "ol"

  const closeLists = () => {
    while (listStack.length) html += `</${listStack.pop()}>`;
  };

  for (const raw of lines) {
    const line = raw;

    // Fenced code blocks
    if (/^```/.test(line)) {
      if (inCode) { html += "</code></pre>"; inCode = false; }
      else { closeLists(); html += "<pre><code>"; inCode = true; }
      continue;
    }
    if (inCode) { html += escapeHtml(line) + "\n"; continue; }

    // Headings
    let m = line.match(/^(#{1,6})\s+(.*)/);
    if (m) {
      closeLists();
      const level = m[1].length;
      html += `<h${level}>${inline(m[2])}</h${level}>`;
      continue;
    }

    // Horizontal rule
    if (/^(\*{3,}|-{3,}|_{3,})\s*$/.test(line)) {
      closeLists();
      html += "<hr>";
      continue;
    }

    // Blockquote
    m = line.match(/^>\s?(.*)/);
    if (m) {
      closeLists();
      html += `<blockquote>${inline(m[1])}</blockquote>`;
      continue;
    }

    // Lists
    m = line.match(/^(\s*)([-*+]|\d+\.)\s+(.*)/);
    if (m) {
      const type = /^\d/.test(m[2]) ? "ol" : "ul";
      if (listStack[listStack.length - 1] !== type) {
        closeLists();
        html += `<${type}>`;
        listStack.push(type);
      }
      html += `<li>${inline(m[3])}</li>`;
      continue;
    }

    // Blank line ends lists / paragraphs
    if (/^\s*$/.test(line)) {
      closeLists();
      continue;
    }

    // Paragraph
    closeLists();
    html += `<p>${inline(line)}</p>`;
  }
  closeLists();
  if (inCode) html += "</code></pre>";
  return html;
}

/* ------------------------------------------------------------------ */
/* Frontmatter + document assembly                                     */
/* ------------------------------------------------------------------ */

/** Quote a YAML scalar when it needs it. */
function yamlScalar(s) {
  if (/[:#\[\]{},&*!|>'"%@`]/.test(s) || /^\s|\s$/.test(s) || s === "") {
    return JSON.stringify(s);
  }
  return s;
}

function buildFrontmatter() {
  const tags = $("tagsInput").value
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
  const lines = ["---"];
  lines.push(`title: ${yamlScalar($("titleInput").value.trim())}`);
  const slug = $("slugInput").value.trim();
  if (slug) lines.push(`slug: ${yamlScalar(slug)}`);
  if (tags.length) lines.push(`tags: [${tags.map(yamlScalar).join(", ")}]`);
  const excerpt = $("excerptInput").value.trim();
  if (excerpt) lines.push(`excerpt: ${yamlScalar(excerpt)}`);
  lines.push(`featured: ${$("featuredToggle").getAttribute("aria-checked") === "true"}`);
  lines.push(`date: ${new Date().toISOString().slice(0, 10)}`);
  lines.push("---");
  return lines.join("\n");
}

function buildDocument(frontmatterOnly = false) {
  const fm = buildFrontmatter();
  if (frontmatterOnly) return fm + "\n";
  const body = $("mdInput").value.replace(/\s+$/, "");
  return fm + "\n\n" + body + "\n";
}

/* ------------------------------------------------------------------ */
/* Slug auto-generation                                                */
/* ------------------------------------------------------------------ */

let slugTouched = false;

function slugify(s) {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/* ------------------------------------------------------------------ */
/* Stats                                                               */
/* ------------------------------------------------------------------ */

function updateStats() {
  const text = $("mdInput").value.trim();
  const words = text ? text.split(/\s+/).length : 0;
  $("wordCount").textContent = words;
  $("readTime").textContent = Math.max(1, Math.ceil(words / 200));
  $("mdPreview").innerHTML = text ? renderMarkdown(text) : '<p style="color:#55555f">Nothing to preview yet.</p>';
}

/* ------------------------------------------------------------------ */
/* Persistence                                                         */
/* ------------------------------------------------------------------ */

function collectDraft() {
  return {
    title: $("titleInput").value,
    slug: $("slugInput").value,
    slugTouched,
    tags: $("tagsInput").value,
    excerpt: $("excerptInput").value,
    featured: $("featuredToggle").getAttribute("aria-checked") === "true",
    body: $("mdInput").value,
  };
}

function applyDraft(d) {
  if (!d) return;
  $("titleInput").value = d.title || "";
  $("slugInput").value = d.slug || "";
  slugTouched = !!d.slugTouched;
  $("tagsInput").value = d.tags || "";
  $("excerptInput").value = d.excerpt || "";
  $("featuredToggle").setAttribute("aria-checked", d.featured ? "true" : "false");
  $("mdInput").value = d.body || "";
}

function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    chrome.storage.local.set({ gms: collectDraft() });
  }, DEBOUNCE_MS);
}

/* ------------------------------------------------------------------ */
/* Actions                                                             */
/* ------------------------------------------------------------------ */

async function copyText(text, btn, label) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    // Fallback for environments where the async clipboard API is blocked
    const ta = document.createElement("textarea");
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    ta.remove();
  }
  const original = btn.textContent;
  btn.textContent = "Copied ✓";
  setTimeout(() => (btn.textContent = original || label), 1500);
}

function downloadMd() {
  const title = $("titleInput").value.trim();
  const filename = (slugify(title) || "ghost-post") + ".md";
  const blob = new Blob([buildDocument()], { type: "text/markdown" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* ------------------------------------------------------------------ */
/* Init                                                                */
/* ------------------------------------------------------------------ */

document.addEventListener("DOMContentLoaded", async () => {
  const saved = await chrome.storage.local.get("gms");
  applyDraft(saved.gms);
  updateStats();

  // Live preview + stats + autosave
  ["titleInput", "slugInput", "tagsInput", "excerptInput", "mdInput"].forEach((id) => {
    $(id).addEventListener("input", () => {
      if (id === "slugInput") slugTouched = true;
      updateStats();
      scheduleSave();
    });
  });

  // Auto-slug from title until the user edits it manually
  $("titleInput").addEventListener("input", () => {
    if (!slugTouched) $("slugInput").value = slugify($("titleInput").value);
  });

  // Featured toggle
  $("featuredToggle").addEventListener("click", () => {
    const el = $("featuredToggle");
    el.setAttribute(
      "aria-checked",
      el.getAttribute("aria-checked") === "true" ? "false" : "true"
    );
    scheduleSave();
  });

  // Tabs
  document.querySelectorAll(".tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      const preview = tab.dataset.tab === "preview";
      $("mdInput").classList.toggle("hidden", preview);
      $("mdPreview").classList.toggle("hidden", !preview);
    });
  });

  // Actions
  $("copyBtn").addEventListener("click", (e) =>
    copyText(buildDocument(), e.currentTarget, "Copy Markdown + frontmatter")
  );
  $("copyFmBtn").addEventListener("click", (e) =>
    copyText(buildDocument(true), e.currentTarget, "Copy frontmatter only")
  );
  $("downloadBtn").addEventListener("click", downloadMd);

  $("clearBtn").addEventListener("click", async () => {
    if ($("clearBtn").dataset.armed) {
      ["titleInput", "slugInput", "tagsInput", "excerptInput", "mdInput"].forEach(
        (id) => ($(id).value = "")
      );
      slugTouched = false;
      $("featuredToggle").setAttribute("aria-checked", "false");
      await chrome.storage.local.remove("gms");
      updateStats();
      delete $("clearBtn").dataset.armed;
      $("clearBtn").textContent = "Clear";
    } else {
      $("clearBtn").dataset.armed = "1";
      $("clearBtn").textContent = "Sure?";
      setTimeout(() => {
        delete $("clearBtn").dataset.armed;
        $("clearBtn").textContent = "Clear";
      }, 3000);
    }
  });
});
