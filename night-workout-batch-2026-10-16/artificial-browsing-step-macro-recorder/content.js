// Macro Recorder — content script. Records clicks and typing while active,
// replays steps on demand. All user-triggered. Password fields are never recorded.

(() => {
  "use strict";
  const MSG_START = "MACRO_START_RECORD";
  const MSG_STOP = "MACRO_STOP_RECORD";
  const MSG_PLAY = "MACRO_PLAY";
  const MSG_CLEAR = "MACRO_CLEAR";
  const REC_FLAG = "__macroRecorderActive";

  let steps = [];
  let active = window[REC_FLAG] === true;

  // Build a stable-ish selector for a clicked element
  function describe(el) {
    if (!(el instanceof Element)) return null;
    if (el.id) return "#" + el.id;
    const parts = [];
    let node = el;
    for (let i = 0; i < 3 && node && node.nodeType === 1; i++) {
      let seg = node.tagName.toLowerCase();
      const cls = (node.className && typeof node.className === "string")
        ? node.className.trim().split(/\s+/).slice(0, 2).join(".")
        : "";
      if (cls) seg += "." + cls;
      parts.unshift(seg);
      node = node.parentElement;
    }
    return parts.join(" > ");
  }

  function isSensitive(el) {
    if (el instanceof HTMLInputElement) {
      const t = (el.type || "text").toLowerCase();
      return ["password", "hidden", "file"].includes(t);
    }
    return false;
  }

  function onClick(e) {
    if (!active) return;
    const el = e.target;
    if (isSensitive(el)) return;
    const sel = describe(el);
    if (!sel) return;
    steps.push({ type: "click", sel, ts: Date.now() });
    chrome.runtime.sendMessage({ kind: "MACRO_STEP", count: steps.length }).catch(() => {});
  }

  function onInput(e) {
    if (!active) return;
    const el = e.target;
    if (!(el instanceof HTMLInputElement) && !(el instanceof HTMLTextAreaElement)) return;
    if (isSensitive(el)) return;
    const sel = describe(el);
    if (!sel) return;
    // coalesce: update the last step if it targeted the same field
    const last = steps[steps.length - 1];
    if (last && last.type === "input" && last.sel === sel) {
      last.value = el.value;
    } else {
      steps.push({ type: "input", sel, value: el.value, ts: Date.now() });
    }
  }

  function start() {
    active = true; window[REC_FLAG] = true; steps = [];
    document.addEventListener("click", onClick, true);
    document.addEventListener("input", onInput, true);
  }

  function stop() {
    active = false; window[REC_FLAG] = false;
    document.removeEventListener("click", onClick, true);
    document.removeEventListener("input", onInput, true);
    return steps;
  }

  function clickEl(sel) {
    const el = document.querySelector(sel);
    if (el) { el.click(); return true; }
    return false;
  }

  function fillEl(sel, value) {
    const el = document.querySelector(sel);
    if (!el) return false;
    el.focus();
    el.value = value;
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  }

  async function play(list) {
    let ok = 0;
    for (const s of list) {
      if (s.type === "click") ok += clickEl(s.sel) ? 1 : 0;
      else if (s.type === "input") ok += fillEl(s.sel, s.value) ? 1 : 0;
      await new Promise(r => setTimeout(r, 350));
    }
    return ok;
  }

  chrome.runtime.onMessage.addListener((msg, _s, sendResponse) => {
    (async () => {
      if (msg.kind === MSG_START) { start(); sendResponse({ ok: true }); }
      else if (msg.kind === MSG_STOP) { sendResponse({ ok: true, steps: stop() }); }
      else if (msg.kind === MSG_PLAY) { sendResponse({ ok: true, done: await play(msg.steps || []) }); }
      else if (msg.kind === MSG_CLEAR) { steps = []; sendResponse({ ok: true }); }
    })();
    return true;
  });

  // If recording was active before navigation, resume capture with empty buffer
  if (active) {
    steps = [];
    document.addEventListener("click", onClick, true);
    document.addEventListener("input", onInput, true);
  }
})();
