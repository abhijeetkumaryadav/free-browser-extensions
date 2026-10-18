/* Word Frequency Highlighter — grabs text from the focused field/selection. Boot-once. */
"use strict";
if (!window.__wfhLoaded) {
  window.__wfhLoaded = true;
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.cmd === "grab") {
      let text = "";
      const sel = window.getSelection();
      if (sel && sel.toString().trim()) {
        text = sel.toString();
      } else {
        const el = document.activeElement;
        if (el && (el.tagName === "TEXTAREA" || el.tagName === "INPUT")) text = el.value || "";
        else if (el && el.isContentEditable) text = el.innerText || "";
      }
      sendResponse({ ok: true, text: text.slice(0, 200000) });
    }
    return true;
  });
}
