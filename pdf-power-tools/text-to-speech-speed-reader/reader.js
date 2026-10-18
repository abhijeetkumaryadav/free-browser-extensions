/* ReadAloud — reader.js (injected into the active tab on demand).
 * Owns the speech queue in the page so reading continues after the popup
 * closes. Exposes window.__ttsReader = { start, pause, resume, stop,
 * setRate, setPitch, setVoice, setHighlight, getVoices, getState }.
 * Word highlighting wraps words of the *current* paragraph block only and
 * restores the exact original HTML when done. All on-device. */
'use strict';

(function () {
  if (window.__ttsReader) return; // already injected

  /* ---------------------------------------------------------------- */
  /* Settings                                                          */
  /* ---------------------------------------------------------------- */
  const settings = {
    rate: 1.0,
    pitch: 1.0,
    voiceURI: '',
    highlight: true,
  };

  /* ---------------------------------------------------------------- */
  /* State                                                             */
  /* ---------------------------------------------------------------- */
  const state = {
    status: 'idle', // idle | speaking | paused
    blocks: [],     // [{ el, text, words: [{el,start,end}], totalWords }]
    blockIndex: 0,
    wordsRead: 0,   // words completed before current block
    totalWords: 0,
    sourceLabel: '',
    wrappedEl: null,
    wrappedHTML: '',
  };

  const HIGHLIGHT_CSS = 'background:rgba(236,72,153,.35);border-radius:3px;';
  let currentWordEl = null;
  let currentUtterance = null;

  /* ---------------------------------------------------------------- */
  /* Article extraction                                                */
  /* ---------------------------------------------------------------- */

  // Heuristic: <article>, then [role=main], then the <div>/<section> with
  // the most paragraph text, else body.
  function findArticleContainer() {
    const article = document.querySelector('article');
    if (article && article.innerText.trim().length > 200) return article;
    const main = document.querySelector('[role="main"], main');
    if (main && main.innerText.trim().length > 200) return main;
    let best = null;
    let bestLen = 0;
    document.querySelectorAll('div, section').forEach((el) => {
      if (el.closest('nav, header, footer, aside, [role="navigation"]')) return;
      const len = Array.from(el.querySelectorAll('p'))
        .reduce((n, p) => n + p.innerText.trim().length, 0);
      if (len > bestLen && len > 200) {
        bestLen = len;
        best = el;
      }
    });
    return best || document.body;
  }

  // Split the container into readable block elements (paragraph-level).
  function collectBlocks(container) {
    const els = container.querySelectorAll('h1, h2, h3, h4, p, li, blockquote');
    const blocks = [];
    els.forEach((el) => {
      if (el.closest('nav, header, footer, aside, script, style, noscript')) return;
      const text = el.innerText.replace(/\s+/g, ' ').trim();
      if (text.length < 2) return;
      blocks.push({ el, text });
    });
    // Fallback: no block elements found — use the whole container text.
    if (blocks.length === 0) {
      const text = container.innerText.replace(/\s+/g, ' ').trim();
      if (text) blocks.push({ el: container, text });
    }
    return blocks.slice(0, 400); // sanity cap
  }

  /* ---------------------------------------------------------------- */
  /* Word wrapping / highlighting (best-effort, exactly reversible)    */
  /* ---------------------------------------------------------------- */

  function wrapWords(block) {
    unwrapWords();
    const el = block.el;
    state.wrappedEl = el;
    state.wrappedHTML = el.innerHTML;
    block.words = [];

    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    const textNodes = [];
    while (walker.nextNode()) textNodes.push(walker.currentNode);

    textNodes.forEach((node) => {
      const frag = document.createDocumentFragment();
      // Split keeping whitespace so document order is preserved.
      const parts = node.textContent.split(/(\s+)/);
      parts.forEach((part) => {
        if (!part) return;
        if (/^\s+$/.test(part)) {
          frag.appendChild(document.createTextNode(part));
        } else {
          const span = document.createElement('span');
          span.textContent = part;
          span.dataset.ttsWord = '1';
          frag.appendChild(span);
          block.words.push({ el: span, start: 0, end: 0 }); // offsets fixed below
        }
      });
      node.parentNode.replaceChild(frag, node);
    });

    // Align word offsets with the *spoken* text (block.text), which is
    // whitespace-collapsed. The spans were created in document order, so
    // they line up 1:1 with the collapsed words in the common case.
    const spokenWords = block.text.split(/\s+/).filter(Boolean);
    if (spokenWords.length === block.words.length) {
      let offset = 0;
      block.words.forEach((w, i) => {
        w.start = offset;
        w.end = offset + spokenWords[i].length;
        offset = w.end + 1; // single collapsed space between words
      });
    }
    // If counts mismatch (hidden elements etc.), offsets stay 0/0 and the
    // first word simply highlights — best-effort.
  }

  function unwrapWords() {
    if (state.wrappedEl && state.wrappedHTML !== '') {
      state.wrappedEl.innerHTML = state.wrappedHTML; // exact restore
    }
    state.wrappedEl = null;
    state.wrappedHTML = '';
    currentWordEl = null;
  }

  function highlightAt(charIndex) {
    if (!settings.highlight) return;
    const block = state.blocks[state.blockIndex];
    if (!block || !block.words) return;
    const word = block.words.find((w) => charIndex >= w.start && charIndex < w.end);
    if (currentWordEl === (word && word.el)) return;
    if (currentWordEl) currentWordEl.removeAttribute('style');
    currentWordEl = word ? word.el : null;
    if (currentWordEl) currentWordEl.setAttribute('style', HIGHLIGHT_CSS);
  }

  /* ---------------------------------------------------------------- */
  /* Speech engine                                                     */
  /* ---------------------------------------------------------------- */

  function pickVoice() {
    const voices = speechSynthesis.getVoices();
    if (settings.voiceURI) {
      const v = voices.find((x) => x.voiceURI === settings.voiceURI);
      if (v) return v;
    }
    // Prefer a voice matching the page language, else default.
    const lang = (document.documentElement.lang || 'en').slice(0, 2).toLowerCase();
    return (
      voices.find((x) => x.lang && x.lang.toLowerCase().startsWith(lang) && x.default) ||
      voices.find((x) => x.lang && x.lang.toLowerCase().startsWith(lang)) ||
      voices.find((x) => x.default) ||
      voices[0] ||
      null
    );
  }

  function speakBlock(index) {
    const block = state.blocks[index];
    if (!block) {
      finish();
      return;
    }
    state.blockIndex = index;
    if (settings.highlight && block.el.isConnected) {
      try {
        wrapWords(block);
      } catch {
        block.words = null; // highlighting failed: read on without it
      }
    }

    const utt = new SpeechSynthesisUtterance(block.text);
    utt.rate = settings.rate;
    utt.pitch = settings.pitch;
    const voice = pickVoice();
    if (voice) utt.voice = voice;

    utt.onboundary = (ev) => {
      if (typeof ev.charIndex === 'number') highlightAt(ev.charIndex);
    };
    utt.onend = () => {
      state.wordsRead += block.text.split(/\s+/).filter(Boolean).length;
      currentWordEl = null;
      speakBlock(index + 1);
    };
    utt.onerror = (ev) => {
      // "interrupted" / "canceled" happen on intentional stop — ignore.
      if (ev.error === 'interrupted' || ev.error === 'canceled') return;
      speakBlock(index + 1); // skip bad block, keep going
    };

    currentUtterance = utt;
    state.status = 'speaking';
    speechSynthesis.speak(utt);
  }

  function start(blocks, label) {
    stopInternal();
    state.blocks = blocks;
    state.blockIndex = 0;
    state.wordsRead = 0;
    state.totalWords = blocks.reduce(
      (n, b) => n + b.text.split(/\s+/).filter(Boolean).length, 0);
    state.sourceLabel = label;
    if (state.totalWords === 0) {
      state.status = 'idle';
      return { ok: false, reason: 'empty' };
    }
    speakBlock(0);
    return { ok: true, totalWords: state.totalWords };
  }

  function stopInternal() {
    speechSynthesis.cancel();
    unwrapWords();
    currentUtterance = null;
    state.blocks = [];
    state.status = 'idle';
  }

  function finish() {
    unwrapWords();
    currentUtterance = null;
    state.status = 'idle';
  }

  // Restart the current block (used when rate/pitch/voice changes mid-speech).
  function restartBlock() {
    if (state.status !== 'speaking' && state.status !== 'paused') return;
    const idx = state.blockIndex;
    speechSynthesis.cancel();
    unwrapWords();
    // Re-count wordsRead: blocks before idx are fully done.
    state.wordsRead = state.blocks.slice(0, idx).reduce(
      (n, b) => n + b.text.split(/\s+/).filter(Boolean).length, 0);
    speakBlock(idx);
  }

  /* ---------------------------------------------------------------- */
  /* Public API                                                        */
  /* ---------------------------------------------------------------- */

  window.__ttsReader = {
    // mode: 'article' | 'selection'
    start(mode) {
      if (mode === 'selection') {
        const text = window.getSelection().toString().replace(/\s+/g, ' ').trim();
        if (!text) return { ok: false, reason: 'no-selection' };
        // Selection: no DOM wrapping (can't safely map ranges) — read only.
        return start([{ el: document.body, text, words: null }], 'Selected text');
      }
      const container = findArticleContainer();
      const blocks = collectBlocks(container);
      if (blocks.length === 0) return { ok: false, reason: 'no-article' };
      const label = (document.title || 'Article').slice(0, 60);
      return start(blocks, label);
    },

    pause() {
      if (state.status === 'speaking') {
        speechSynthesis.pause();
        state.status = 'paused';
      }
      return { ok: true };
    },

    resume() {
      if (state.status === 'paused') {
        speechSynthesis.resume();
        state.status = 'speaking';
      }
      return { ok: true };
    },

    stop() {
      stopInternal();
      state.wordsRead = 0;
      state.totalWords = 0;
      return { ok: true };
    },

    setRate(rate) {
      settings.rate = Math.min(2.5, Math.max(0.5, rate));
      restartBlock();
      return { ok: true, rate: settings.rate };
    },

    setPitch(pitch) {
      settings.pitch = Math.min(2, Math.max(0.5, pitch));
      restartBlock();
      return { ok: true, pitch: settings.pitch };
    },

    setVoice(voiceURI) {
      settings.voiceURI = voiceURI || '';
      restartBlock();
      return { ok: true };
    },

    setHighlight(on) {
      settings.highlight = !!on;
      if (!on) unwrapWords();
      return { ok: true };
    },

    getVoices() {
      return speechSynthesis.getVoices().map((v) => ({
        voiceURI: v.voiceURI,
        name: v.name,
        lang: v.lang,
        isDefault: !!v.default,
      }));
    },

    getState() {
      const block = state.blocks[state.blockIndex];
      const blockWords = block ? block.text.split(/\s+/).filter(Boolean).length : 0;
      return {
        status: state.status,
        sourceLabel: state.sourceLabel,
        blockIndex: state.blockIndex,
        totalBlocks: state.blocks.length,
        wordsDone: Math.min(state.totalWords, state.wordsRead),
        totalWords: state.totalWords,
        blockWords,
        rate: settings.rate,
        pitch: settings.pitch,
        highlight: settings.highlight,
      };
    },
  };
})();
