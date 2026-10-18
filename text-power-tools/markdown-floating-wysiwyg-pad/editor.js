/* MarkPad editor — WYSIWYG contenteditable editing with a live Markdown view.
 * All formatting is done with Range/DOM APIs (no deprecated execCommand).
 * Draft autosaves to chrome.storage.local; export produces .md / standalone .html. */

const STORAGE_KEY = "mwypad.doc";
const editor = document.getElementById("editor");
const mdview = document.getElementById("mdview");
const wordCountEl = document.getElementById("wordCount");
const saveStateEl = document.getElementById("saveState");

let view = "write";          // "write" | "markdown"
let saveTimer = null;
let isEmpty = true;

/* ------------------------------ persistence ------------------------------ */

async function loadDoc() {
  const { [STORAGE_KEY]: doc } = await chrome.storage.local.get(STORAGE_KEY);
  if (doc && doc.html) {
    editor.innerHTML = doc.html;
  } else {
    editor.innerHTML = "";
  }
  refreshEmpty();
  updateWordCount();
}

function scheduleSave() {
  saveStateEl.textContent = "Saving…";
  saveStateEl.classList.add("saving");
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    await chrome.storage.local.set({
      [STORAGE_KEY]: { html: editor.innerHTML, updatedAt: Date.now() },
    });
    const t = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    saveStateEl.textContent = "Saved " + t;
    saveStateEl.classList.remove("saving");
  }, 800);
}

/* --------------------------------- helpers -------------------------------- */

function refreshEmpty() {
  isEmpty = editor.textContent.trim() === "";
  editor.classList.toggle("empty", isEmpty);
}

function updateWordCount() {
  const t = editor.textContent.trim();
  wordCountEl.textContent = (t ? t.split(/\s+/).length : 0).toLocaleString() + " words";
}

function onEdit() {
  refreshEmpty();
  updateWordCount();
  scheduleSave();
}

/** Element node for a DOM node (text nodes -> parent). */
function elOf(node) {
  return node.nodeType === 3 ? node.parentElement : node;
}

/** Nearest block-level ancestor inside the editor. */
function blockOf(node) {
  let el = elOf(node);
  while (el && el !== editor && !/^(P|H1|H2|H3|LI|BLOCKQUOTE|PRE|DIV)$/.test(el.tagName)) {
    el = el.parentElement;
  }
  return el === editor ? null : el;
}

function ensureWriteView() {
  if (view !== "write") setView("write");
}

/* ------------------------------ formatting -------------------------------- */

/** Toggle an inline tag (strong/em/s) around the current selection. */
function toggleInline(tag) {
  editor.focus();
  const sel = window.getSelection();
  if (!sel.rangeCount || sel.isCollapsed) return;
  const range = sel.getRangeAt(0);
  const host = elOf(range.commonAncestorContainer).closest(tag.toLowerCase());

  if (host && editor.contains(host)) {
    // Unwrap: move children out, drop the tag.
    const parent = host.parentNode;
    while (host.firstChild) parent.insertBefore(host.firstChild, host);
    parent.removeChild(host);
  } else {
    const wrap = document.createElement(tag);
    try {
      range.surroundContents(wrap);
    } catch (e) {
      // Selection spans partial nodes — extract and re-insert inside the wrapper.
      wrap.appendChild(range.extractContents());
      range.insertNode(wrap);
    }
    // Reselect the wrapped content for a natural feel.
    sel.removeAllRanges();
    const r = document.createRange();
    r.selectNodeContents(wrap);
    sel.addRange(r);
  }
  onEdit();
}

/** Turn the current block into tag (h1/h2/p), toggling back to <p>. */
function formatBlock(tag) {
  editor.focus();
  const sel = window.getSelection();
  if (!sel.rangeCount) return;
  const block = blockOf(sel.anchorNode) || elOf(sel.anchorNode);
  if (!block || !editor.contains(block)) return;
  const next = block.tagName.toLowerCase() === tag ? "p" : tag;
  const fresh = document.createElement(next);
  while (block.firstChild) fresh.appendChild(block.firstChild);
  block.replaceWith(fresh);
  // Put caret inside the new block.
  const r = document.createRange();
  r.selectNodeContents(fresh);
  r.collapse(false);
  sel.removeAllRanges();
  sel.addRange(r);
  onEdit();
}

/** Wrap selected blocks in a list, or unwrap if already that list type. */
function toggleListSimple(listTag) {
  editor.focus();
  const sel = window.getSelection();
  if (!sel.rangeCount) return;
  const anchorBlock = blockOf(sel.anchorNode);
  const list = anchorBlock ? anchorBlock.closest("ul,ol") : null;

  if (list && editor.contains(list) && list.tagName.toLowerCase() === listTag) {
    [...list.children].forEach((li) => {
      const p = document.createElement("p");
      while (li.firstChild) p.appendChild(li.firstChild);
      list.parentNode.insertBefore(p, list);
    });
    list.remove();
    onEdit();
    return;
  }
  // Build from the current block (or a fresh paragraph).
  const src = anchorBlock || (() => {
    const p = document.createElement("p");
    p.innerHTML = "<br>";
    editor.appendChild(p);
    return p;
  })();
  const freshList = document.createElement(listTag);
  const li = document.createElement("li");
  while (src.firstChild) li.appendChild(src.firstChild);
  if (!li.textContent.trim()) li.innerHTML = "<br>";
  freshList.appendChild(li);
  src.replaceWith(freshList);
  onEdit();
}

function toggleQuote() {
  editor.focus();
  const sel = window.getSelection();
  if (!sel.rangeCount) return;
  const block = blockOf(sel.anchorNode);
  if (!block) return;
  const quote = block.closest("blockquote");
  if (quote && editor.contains(quote)) {
    const p = document.createElement("p");
    while (quote.firstChild) p.appendChild(quote.firstChild);
    quote.replaceWith(p);
  } else {
    const q = document.createElement("blockquote");
    const p = document.createElement("p");
    while (block.firstChild) p.appendChild(block.firstChild);
    q.appendChild(p);
    block.replaceWith(q);
  }
  onEdit();
}

function toggleCodeBlock() {
  editor.focus();
  const sel = window.getSelection();
  if (!sel.rangeCount) return;
  const block = blockOf(sel.anchorNode);
  if (!block) return;
  const pre = block.closest("pre");
  if (pre && editor.contains(pre)) {
    const p = document.createElement("p");
    p.textContent = pre.textContent;
    pre.replaceWith(p);
  } else {
    const fresh = document.createElement("pre");
    const code = document.createElement("code");
    code.textContent = block.textContent;
    fresh.appendChild(code);
    block.replaceWith(fresh);
  }
  onEdit();
}

function insertLink() {
  editor.focus();
  const sel = window.getSelection();
  if (!sel.rangeCount || sel.isCollapsed) {
    alert("Select some text first, then add a link.");
    return;
  }
  let url = prompt("Link URL (https://…):", "https://");
  if (!url) return;
  if (!/^https?:\/\//i.test(url)) url = "https://" + url;
  const range = sel.getRangeAt(0);
  const a = document.createElement("a");
  a.href = url;
  a.target = "_blank";
  a.rel = "noopener";
  try {
    range.surroundContents(a);
  } catch (e) {
    a.appendChild(range.extractContents());
    range.insertNode(a);
  }
  onEdit();
}

function clearFormatting() {
  editor.focus();
  const sel = window.getSelection();
  if (!sel.rangeCount || sel.isCollapsed) return;
  const range = sel.getRangeAt(0);
  const text = range.toString();
  range.deleteContents();
  range.insertNode(document.createTextNode(text));
  onEdit();
}

/* --------------------------- HTML <-> Markdown ---------------------------- */

function inlineMd(node) {
  let out = "";
  node.childNodes.forEach((child) => {
    if (child.nodeType === 3) {
      out += child.textContent;
    } else {
      const tag = child.tagName.toLowerCase();
      const inner = inlineMd(child);
      if (tag === "strong" || tag === "b") out += `**${inner}**`;
      else if (tag === "em" || tag === "i") out += `*${inner}*`;
      else if (tag === "s" || tag === "strike" || tag === "del") out += `~~${inner}~~`;
      else if (tag === "code") out += "`" + inner.replace(/`/g, "") + "`";
      else if (tag === "a") out += `[${inner}](${child.getAttribute("href") || ""})`;
      else if (tag === "br") out += "\n";
      else out += inner;
    }
  });
  return out;
}

function blockMd(node) {
  const tag = node.tagName.toLowerCase();
  if (tag === "h1") return "# " + inlineMd(node).trim() + "\n\n";
  if (tag === "h2") return "## " + inlineMd(node).trim() + "\n\n";
  if (tag === "h3") return "### " + inlineMd(node).trim() + "\n\n";
  if (tag === "blockquote") {
    const text = inlineMd(node).trim().split("\n").map((l) => "> " + l).join("\n");
    return text + "\n\n";
  }
  if (tag === "pre") return "```\n" + node.textContent.replace(/\n$/, "") + "\n```\n\n";
  if (tag === "ul") {
    return [...node.children].map((li) => "- " + inlineMd(li).trim()).join("\n") + "\n\n";
  }
  if (tag === "ol") {
    return [...node.children].map((li, i) => `${i + 1}. ${inlineMd(li).trim()}`).join("\n") + "\n\n";
  }
  if (tag === "hr") return "---\n\n";
  if (tag === "div" && node === editor) {
    return [...node.childNodes].map(blockMd).join("");
  }
  // p, li fallback, or anything else
  const text = inlineMd(node).trim();
  return text ? text + "\n\n" : "";
}

function htmlToMarkdown() {
  const tmp = document.createElement("div");
  tmp.innerHTML = editor.innerHTML;
  return blockMd(tmp).replace(/\n{3,}/g, "\n\n").trim() + "\n";
}

function inlineHtml(text) {
  // Escape HTML first, then apply inline markdown.
  let out = text
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  out = out.replace(/`([^`]+)`/g, "<code>$1</code>");
  out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  out = out.replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>");
  out = out.replace(/~~([^~]+)~~/g, "<s>$1</s>");
  out = out.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  return out;
}

/** Minimal Markdown -> HTML (headings, quotes, lists, code fences, paragraphs). */
function markdownToHtml(src) {
  const lines = src.replace(/\r\n?/g, "\n").split("\n");
  let html = "";
  let inCode = false;
  let codeBuf = [];
  let listTag = null;

  const closeList = () => {
    if (listTag) { html += `</${listTag}>`; listTag = null; }
  };

  for (const line of lines) {
    if (/^```/.test(line)) {
      if (inCode) {
        html += "<pre><code>" + codeBuf.join("\n")
          .replace(/&/g, "&amp;").replace(/</g, "&lt;") + "</code></pre>";
        codeBuf = [];
        inCode = false;
      } else {
        closeList();
        inCode = true;
      }
      continue;
    }
    if (inCode) { codeBuf.push(line); continue; }

    const h = line.match(/^(#{1,3})\s+(.*)$/);
    const q = line.match(/^>\s?(.*)$/);
    const ul = line.match(/^[-*]\s+(.*)$/);
    const ol = line.match(/^\d+\.\s+(.*)$/);

    if (h) {
      closeList();
      html += `<h${h[1].length}>${inlineHtml(h[2])}</h${h[1].length}>`;
    } else if (q) {
      closeList();
      html += `<blockquote><p>${inlineHtml(q[1])}</p></blockquote>`;
    } else if (ul || ol) {
      const tag = ul ? "ul" : "ol";
      const text = (ul ? ul[1] : ol[1]);
      if (listTag !== tag) { closeList(); html += `<${tag}>`; listTag = tag; }
      html += `<li>${inlineHtml(text)}</li>`;
    } else if (line.trim() === "") {
      closeList();
    } else {
      closeList();
      html += `<p>${inlineHtml(line)}</p>`;
    }
  }
  closeList();
  if (inCode) {
    html += "<pre><code>" + codeBuf.join("\n")
      .replace(/&/g, "&amp;").replace(/</g, "&lt;") + "</code></pre>";
  }
  return html || "<p><br></p>";
}

/* -------------------------------- view toggle ------------------------------ */

const viewBtns = document.querySelectorAll(".vt");

function setView(next) {
  if (next === view) return;
  if (next === "markdown") {
    mdview.value = htmlToMarkdown();
    mdview.hidden = false;
    editor.hidden = true;
  } else {
    // Convert edited markdown back to rich HTML.
    editor.innerHTML = markdownToHtml(mdview.value);
    editor.hidden = false;
    mdview.hidden = true;
    onEdit();
  }
  view = next;
  viewBtns.forEach((b) => b.classList.toggle("active", b.dataset.view === next));
  document.querySelectorAll(".tool").forEach((t) => (t.disabled = next !== "write"));
}

viewBtns.forEach((b) => b.addEventListener("click", () => setView(b.dataset.view)));

/* --------------------------------- exports --------------------------------- */

function download(filename, content, mime) {
  const blob = new Blob([content], { type: mime });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(a.href);
    a.remove();
  }, 500);
}

function stamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
}

document.getElementById("exportMd").addEventListener("click", () => {
  const md = view === "markdown" ? mdview.value : htmlToMarkdown();
  download(`markpad-${stamp()}.md`, md, "text/markdown");
});

document.getElementById("exportHtml").addEventListener("click", () => {
  const body = view === "markdown" ? markdownToHtml(mdview.value) : editor.innerHTML;
  const doc = `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8">
<title>MarkPad export</title>
<style>body{font-family:Georgia,serif;max-width:760px;margin:40px auto;padding:0 20px;line-height:1.75;color:#1a1a1a}
pre{background:#f4f4f6;padding:12px 14px;border-radius:8px;overflow-x:auto}
code{font-family:Consolas,monospace}blockquote{border-left:3px solid #8b5cf6;margin:1em 0;padding-left:1em;color:#555}</style>
</head><body>${body}</body></html>`;
  download(`markpad-${stamp()}.html`, doc, "text/html");
});

document.getElementById("newDoc").addEventListener("click", async () => {
  if (!confirm("Start a new document? Your current draft will be discarded.")) return;
  editor.innerHTML = "";
  if (view === "markdown") setView("write");
  onEdit();
  await chrome.storage.local.remove(STORAGE_KEY);
  saveStateEl.textContent = "New document";
  saveStateEl.classList.remove("saving");
});

/* --------------------------------- toolbar --------------------------------- */

const COMMANDS = {
  bold: () => toggleInline("strong"),
  italic: () => toggleInline("em"),
  strike: () => toggleInline("s"),
  h1: () => formatBlock("h1"),
  h2: () => formatBlock("h2"),
  quote: toggleQuote,
  ul: () => toggleListSimple("ul"),
  ol: () => toggleListSimple("ol"),
  code: toggleCodeBlock,
  link: insertLink,
  clear: clearFormatting,
};

document.querySelectorAll(".tool").forEach((btn) => {
  btn.addEventListener("click", (e) => {
    e.preventDefault();
    ensureWriteView();
    const fn = COMMANDS[btn.dataset.cmd];
    if (fn) fn();
  });
  // Keep editor selection alive while clicking toolbar buttons.
  btn.addEventListener("mousedown", (e) => e.preventDefault());
});

/* ---------------------------------- events --------------------------------- */

editor.addEventListener("input", onEdit);
// Formatting that doesn't fire "input" (e.g. list toggles) calls onEdit() directly.

mdview.addEventListener("input", () => {
  saveStateEl.textContent = "Editing markdown…";
  saveStateEl.classList.add("saving");
});

document.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "b" && view === "write") {
    e.preventDefault();
    toggleInline("strong");
  }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "i" && view === "write") {
    e.preventDefault();
    toggleInline("em");
  }
});

/* ----------------------------------- init ----------------------------------- */

loadDoc();
