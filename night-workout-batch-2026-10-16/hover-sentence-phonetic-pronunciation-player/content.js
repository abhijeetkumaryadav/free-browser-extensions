// content.js — click-to-pronounce mode for the current tab.
// Armed on explicit user click in the popup. Splits visible paragraph-like text
// into sentence spans, highlights hovered sentences, speaks the clicked one via
// the browser's own speechSynthesis. Esc or "Clear" removes every trace.
// Honest scope: plays pronunciation only — no phonetic transcription exists here.

(() => {
  if (window.__pronounceArmed) return; // boot-once guard
  window.__pronounceArmed = true;

  const HIGHLIGHT = "rgba(56,189,248,.28)";
  const OUTLINE = "2px solid #38bdf8";
  const spoken = window.speechSynthesis;
  let active = true;

  const SENTENCE_SPLIT = /([^.!?…]+[.!?…]+[""')\]]*\s*)/g;

  function sentenceNodes() {
    const blocks = document.querySelectorAll("p, li, h1, h2, h3, h4, blockquote, td, figcaption");
    const out = [];
    for (const b of blocks) {
      if (b.dataset.pronSplit) continue;
      // Skip blocks that already contain interactive children we shouldn't wrap.
      if (b.querySelector("input,textarea,select,button,audio,video")) continue;
      const text = b.textContent.trim();
      if (text.length < 20) continue;
      out.push(b);
    }
    return out;
  }

  function splitBlock(block) {
    block.dataset.pronSplit = "1";
    const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
    const texts = [];
    while (walker.nextNode()) texts.push(walker.currentNode);
    for (const t of texts) {
      const parts = t.nodeValue.match(SENTENCE_SPLIT);
      if (!parts || parts.length < 2) continue;
      const frag = document.createDocumentFragment();
      for (const p of parts) {
        const span = document.createElement("span");
        span.className = "__pron_sentence";
        span.textContent = p;
        frag.appendChild(span);
      }
      t.parentNode.replaceChild(frag, t);
    }
  }

  function onMove(e) {
    if (!active) return;
    const s = e.target.closest && e.target.closest(".__pron_sentence");
    document.querySelectorAll(".__pron_sentence.__pron_hover").forEach(x => {
      x.style.background = ""; x.style.outline = ""; x.classList.remove("__pron_hover");
    });
    if (s) {
      s.classList.add("__pron_hover");
      s.style.background = HIGHLIGHT;
      s.style.outline = OUTLINE;
      s.style.borderRadius = "4px";
      s.style.cursor = "pointer";
    }
  }

  function onClick(e) {
    if (!active) return;
    const s = e.target.closest && e.target.closest(".__pron_sentence");
    if (!s) return;
    e.preventDefault();
    e.stopPropagation();
    speak(s.textContent.trim());
  }

  function speak(text) {
    if (!text || !spoken) return;
    spoken.cancel();
    const u = new SpeechSynthesisUtterance(text.slice(0, 2000));
    u.rate = state.rate; u.pitch = state.pitch;
    if (state.voiceURI) {
      const v = spoken.getVoices().find(x => x.voiceURI === state.voiceURI);
      if (v) u.voice = v;
    }
    spoken.speak(u);
  }

  const state = { rate: 1, pitch: 1, voiceURI: "" };

  function teardown() {
    active = false;
    window.__pronounceArmed = false;
    spoken && spoken.cancel();
    document.removeEventListener("mousemove", onMove, true);
    document.removeEventListener("click", onClick, true);
    document.removeEventListener("keydown", onKey, true);
    document.querySelectorAll(".__pron_sentence").forEach(s => {
      const parent = s.parentNode;
      parent.replaceChild(document.createTextNode(s.textContent), s);
      parent.normalize();
    });
    document.querySelectorAll("[data-pron-split]").forEach(b => b.removeAttribute("data-pron-split"));
  }

  function onKey(e) {
    if (e.key === "Escape") teardown();
  }

  // Message API for the popup.
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === "pronounce-set") {
      Object.assign(state, msg.prefs || {});
    } else if (msg.type === "pronounce-clear") {
      teardown();
    }
  });

  sentenceNodes().forEach(splitBlock);
  document.addEventListener("mousemove", onMove, true);
  document.addEventListener("click", onClick, true);
  document.addEventListener("keydown", onKey, true);
})();
