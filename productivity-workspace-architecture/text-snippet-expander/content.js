// Text Snippet Expander — content script.
// Expands trigger → snippet when the user types a trigger followed by
// Tab, Space, or Enter inside editable fields.
//
// PRIVACY: this script only compares the word immediately before the caret
// against the user's trigger list. It never records, stores, or transmits
// keystrokes — matches happen in memory and nothing leaves the device.

// ---------------------------------------------------------------------------
// State (loaded from storage, kept in sync)
// ---------------------------------------------------------------------------
let snippets = {};                    // { trigger: snippet }
let enabled = true;
let expandOn = "tab";                 // "tab" | "space" | "both"

async function loadState() {
  const s = await chrome.storage.local.get({ snippets: {}, enabled: true, expandOn: "tab" });
  snippets = s.snippets || {};
  enabled = s.enabled !== false;
  expandOn = s.expandOn || "tab";
}
loadState();
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  if (changes.snippets) snippets = changes.snippets.newValue || {};
  if (changes.enabled) enabled = changes.enabled.newValue !== false;
  if (changes.expandOn) expandOn = changes.expandOn.newValue || "tab";
});

// ---------------------------------------------------------------------------
// Editable targets
// ---------------------------------------------------------------------------
function editableTarget(el) {
  if (!el) return null;
  if (el instanceof HTMLInputElement) {
    return (el.type === "text" || el.type === "search" || el.type === "url" ||
            el.type === "email" || el.type === "tel") ? el : null;
  }
  if (el instanceof HTMLTextAreaElement) return el;
  if (el.isContentEditable) return el;
  return null;
}

// ---------------------------------------------------------------------------
// Caret / text helpers (works for inputs, textareas, contenteditable)
// ---------------------------------------------------------------------------
function getTextBeforeCaret(el) {
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    return el.value.slice(0, el.selectionStart ?? el.value.length);
  }
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount) return "";
  const range = sel.getRangeAt(0).cloneRange();
  range.selectNodeContents(el);
  range.setEnd(sel.getRangeAt(0).endContainer, sel.getRangeAt(0).endOffset);
  return range.toString();
}

function replaceTrigger(el, triggerLen, snippet, dropTrailingChar) {
  const cursorMark = "{cursor}";
  const hasCursor = snippet.includes(cursorMark);
  const body = snippet.split(cursorMark).join("");

  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    const start = el.selectionStart ?? el.value.length;
    const cutFrom = start - triggerLen - (dropTrailingChar ? 1 : 0);
    const before = el.value.slice(0, Math.max(0, cutFrom));
    const after = el.value.slice(start);
    const newVal = before + body + after;
    el.value = newVal;
    el.dispatchEvent(new Event("input", { bubbles: true })); // notify frameworks
    const caretPos = before.length + (hasCursor ? snippet.indexOf(cursorMark) : body.length);
    el.setSelectionRange(caretPos, caretPos);
  } else {
    // contenteditable: operate on the current text node when possible
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return;
    const range = sel.getRangeAt(0);
    const node = range.endContainer;
    if (node.nodeType !== Node.TEXT_NODE) return;
    const offset = range.endOffset;
    const cutFrom = Math.max(0, offset - triggerLen - (dropTrailingChar ? 1 : 0));
    node.textContent = node.textContent.slice(0, cutFrom) + body + node.textContent.slice(offset);
    const caretPos = cutFrom + (hasCursor ? snippet.indexOf(cursorMark) : body.length);
    const newRange = document.createRange();
    newRange.setStart(node, Math.min(caretPos, node.textContent.length));
    newRange.collapse(true);
    sel.removeAllRanges();
    sel.addRange(newRange);
  }
}

// ---------------------------------------------------------------------------
// Trigger matching
// ---------------------------------------------------------------------------
// Returns the trigger if the word right before the caret is an exact match.
function matchTrigger(textBefore) {
  const m = textBefore.match(/(\S+)$/);
  if (!m) return null;
  return Object.prototype.hasOwnProperty.call(snippets, m[1]) ? m[1] : null;
}

function wantsTab() { return expandOn === "tab" || expandOn === "both"; }
function wantsSpace() { return expandOn === "space" || expandOn === "both"; }

// Tab: intercept keydown before focus moves.
document.addEventListener("keydown", (e) => {
  if (!enabled || e.key !== "Tab" || e.ctrlKey || e.metaKey || e.altKey) return;
  const el = editableTarget(e.target);
  if (!el) return;
  const trigger = matchTrigger(getTextBeforeCaret(el));
  if (!trigger) return;
  e.preventDefault();
  e.stopPropagation();
  replaceTrigger(el, trigger.length, snippets[trigger], false);
}, true);

// Space / Enter: check on keyup, after the character is inserted.
document.addEventListener("keyup", (e) => {
  if (!enabled) return;
  if (e.key !== " " && e.key !== "Enter") return;
  if (!wantsSpace() && !(e.key === "Enter" && wantsSpace())) return;
  const el = editableTarget(e.target);
  if (!el) return;
  const before = getTextBeforeCaret(el);
  // strip the just-typed separator, then match the word before it
  const text = before.slice(0, -1);
  const trigger = matchTrigger(text);
  if (!trigger) return;
  replaceTrigger(el, trigger.length, snippets[trigger], true);
}, true);
