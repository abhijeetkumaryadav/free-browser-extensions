// ─────────────────────────────────────────────────────────────
// SpoilerBlur content script
// Blurs text blocks matching the user's keyword list. Runs in the
// page only (http/https), reads settings from chrome.storage, never
// modifies the DOM beyond wrapping matched text in a <span>.
// Clicking a blurred span reveals it. Fully reversible.
// ─────────────────────────────────────────────────────────────
"use strict";

const WRAP_CLASS = "sb-blur-wrap";
let settings = { master: false, keywords: [], sites: {} };
let blurredCount = 0;
let observer = null;

init();

async function init() {
  const stored = await chrome.storage.local.get({ master: false, keywords: [], sites: {} });
  settings = stored;
  apply();
  // Re-apply when settings change from the popup.
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    let changed = false;
    for (const [k, v] of Object.entries(changes)) { settings[k] = v.newValue; changed = true; }
    if (changed) { unblurAll(); apply(); }
  });
  // Popup commands.
  chrome.runtime.onMessage.addListener((msg, _sender, respond) => {
    if (msg?.type === "sb:getState") respond({ host: location.hostname, count: blurredCount });
    if (msg?.type === "sb:revealAll") { unblurAll(); respond({ ok: true }); }
  });
  observeMutations();
}

/** Is filtering active for this page? */
function isActive() {
  if (!settings.master) return false;
  const host = location.hostname;
  // Per-site override: false = disabled here, true/undefined = follow master.
  return settings.sites[host] !== false;
}

/** Apply blurring to the current document if active. */
function apply() {
  if (!isActive() || !settings.keywords.length) return;
  scanNode(document.body);
}

/** Escape keywords for regex use. */
function keywordRegex() {
  const parts = settings.keywords.map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  return new RegExp(`(${parts.join("|")})`, "gi");
}

/** Walk text nodes and wrap keyword matches in blur spans. */
function scanNode(root) {
  const re = keywordRegex();
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const p = node.parentElement;
      if (!p) return NodeFilter.FILTER_REJECT;
      if (p.closest(`.${WRAP_CLASS}, script, style, noscript, textarea, input, [contenteditable="true"]`)) {
        return NodeFilter.FILTER_REJECT;
      }
      return re.test(node.nodeValue) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
    },
  });
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  for (const node of nodes) wrapMatches(node, re);
}

/** Wrap every match in a single text node with a blur span. */
function wrapMatches(textNode, re) {
  const frag = document.createDocumentFragment();
  let last = 0, m;
  re.lastIndex = 0;
  const text = textNode.nodeValue;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) frag.appendChild(document.createTextNode(text.slice(last, m.index)));
    const span = document.createElement("span");
    span.className = WRAP_CLASS;
    span.textContent = m[0];
    span.title = "Spoiler hidden — click to reveal";
    span.addEventListener("click", (e) => { e.stopPropagation(); reveal(span); }, { once: true });
    frag.appendChild(span);
    blurredCount++;
    last = m.index + m[0].length;
    if (m[0].length === 0) re.lastIndex++; // guard against zero-length loops
  }
  frag.appendChild(document.createTextNode(text.slice(last)));
  textNode.replaceWith(frag);
}

/** Reveal one blurred span in place. */
function reveal(span) {
  span.replaceWith(document.createTextNode(span.textContent));
  blurredCount = Math.max(0, blurredCount - 1);
}

/** Remove all blur spans, restoring the page exactly. */
function unblurAll() {
  document.querySelectorAll(`.${WRAP_CLASS}`).forEach((span) => {
    span.replaceWith(document.createTextNode(span.textContent));
  });
  blurredCount = 0;
}

/** Keep up with dynamically added content (SPAs, infinite scroll). */
function observeMutations() {
  observer = new MutationObserver((mutations) => {
    if (!isActive() || !settings.keywords.length) return;
    for (const mut of mutations) {
      for (const node of mut.addedNodes) {
        if (node.nodeType === Node.ELEMENT_NODE) scanNode(node);
      }
    }
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
}
