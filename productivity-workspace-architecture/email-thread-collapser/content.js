// Email Thread Collapser — content script (mail.google.com only).
// Finds quoted-history blocks (div.gmail_quote) inside message bodies,
// hides them behind a slim per-thread expander button, and keeps watching
// for newly loaded messages. Nothing is modified in the mailbox —
// quotes are only hidden on screen and can be re-expanded anytime.

const BTN_CLASS = "etc-expander";
let enabled = true;
let observer = null;
let debounceTimer = null;

init();

async function init() {
  const { etc_enabled = true } = await chrome.storage.local.get("etc_enabled");
  enabled = etc_enabled;
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes.etc_enabled) {
      setEnabled(changes.etc_enabled.newValue);
    }
  });
  chrome.runtime.onMessage.addListener((msg, _sender, respond) => {
    if (msg.cmd === "setEnabled") setEnabled(!!msg.enabled);
    if (msg.cmd === "count") respond({ collapsed: countCollapsed() });
    return false;
  });
  if (enabled) startWatching();
}

// --- enable / disable -------------------------------------------------------

function setEnabled(next) {
  enabled = next;
  if (enabled) {
    collapseAll();
    startWatching();
  } else {
    stopWatching();
    restoreAll();
  }
}

function startWatching() {
  collapseAll();
  if (observer) return;
  observer = new MutationObserver(() => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(collapseAll, 400);
  });
  observer.observe(document.body, { childList: true, subtree: true });
}

function stopWatching() {
  if (observer) { observer.disconnect(); observer = null; }
}

// --- collapsing -------------------------------------------------------------

// Quoted history in Gmail lives in div.gmail_quote inside the message body
// container .a3s. We tag processed quotes with data-etc so we never double-wrap.
function collapseAll() {
  if (!enabled) return;
  document.querySelectorAll(".a3s div.gmail_quote").forEach((quote) => {
    if (quote.dataset.etc) return;
    quote.dataset.etc = "1";
    hideQuote(quote);
  });
}

function hideQuote(quote) {
  const parent = quote.parentNode;
  if (!parent) return;
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = BTN_CLASS;
  btn.textContent = "··· show quoted history";
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    const hidden = quote.style.display === "none";
    quote.style.display = hidden ? "" : "none";
    btn.textContent = hidden ? "··· hide quoted history" : "··· show quoted history";
  });
  parent.insertBefore(btn, quote);
  quote.style.display = "none";
}

// Restore every quote we hid (used when the master toggle is switched off).
function restoreAll() {
  document.querySelectorAll(".a3s div.gmail_quote[data-etc]").forEach((quote) => {
    quote.style.display = "";
  });
  document.querySelectorAll("button." + BTN_CLASS).forEach((b) => b.remove());
}

function countCollapsed() {
  return Array.from(
    document.querySelectorAll(".a3s div.gmail_quote[data-etc]")
  ).filter((q) => q.style.display === "none").length;
}

// --- injected expander styling ----------------------------------------------

const style = document.createElement("style");
style.textContent = `
  button.${BTN_CLASS} {
    display: block; width: 100%; margin: 8px 0; padding: 8px 12px;
    background: rgba(56,189,248,.08); border: 1px dashed rgba(56,189,248,.45);
    border-radius: 8px; color: #38bdf8; font: 12px/1.4 -apple-system,"Segoe UI",Roboto,sans-serif;
    cursor: pointer; text-align: left;
  }
  button.${BTN_CLASS}:hover { background: rgba(56,189,248,.16); }
`;
(document.head || document.documentElement).appendChild(style);
