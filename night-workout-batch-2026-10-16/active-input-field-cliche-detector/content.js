/* content.js — extracts text from the currently focused editable element. */
(() => {
  if (window.__clicheDetectorLoaded) return;
  window.__clicheDetectorLoaded = true;

  /** Return the best text candidate: focused input/textarea, contenteditable, or selection. */
  function getActiveText(){
    const el = document.activeElement;
    if (el){
      const tag = (el.tagName || "").toLowerCase();
      if ((tag === "input" || tag === "textarea") && typeof el.value === "string" && el.value.trim()){
        return { ok: true, text: el.value, source: "field" };
      }
      if (el.isContentEditable && el.innerText && el.innerText.trim()){
        return { ok: true, text: el.innerText, source: "field" };
      }
    }
    const sel = window.getSelection && window.getSelection().toString();
    if (sel && sel.trim()){
      return { ok: true, text: sel, source: "selection" };
    }
    return { ok: false, reason: "Click inside a text field (or select text) and scan again." };
  }

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg && msg.type === "GET_ACTIVE_TEXT"){
      sendResponse(getActiveText());
    }
    return false;
  });
})();
