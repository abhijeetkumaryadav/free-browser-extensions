/* content.js — Neutral Salutations field grabber.
   Injected ONLY when the user clicks "Grab field" (activeTab + scripting).
   Returns the value of the currently focused text input/textarea, or the
   current text selection. Read-only: the page is never modified. */

(() => {
  if (window.__neutralSalGrabber) return;
  window.__neutralSalGrabber = true;

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg && msg.type === "NS_GRAB") {
      let text = "";
      const el = document.activeElement;
      if (el && (el.tagName === "TEXTAREA" || (el.tagName === "INPUT" && /^(text|search|email)$/i.test(el.type || "text")))) {
        text = el.value || "";
      } else if (el && el.isContentEditable) {
        text = el.innerText || "";
      }
      if (!text) {
        const sel = window.getSelection();
        text = sel ? sel.toString() : "";
      }
      sendResponse({ text: (text || "").slice(0, 20000) });
    }
    return true;
  });
})();
