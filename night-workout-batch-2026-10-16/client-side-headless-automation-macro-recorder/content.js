// ============================================================================
// content.js — records & replays user-triggered macros in the current tab.
// Safety rules (hard limits, not suggestions):
//  - NEVER records <input type="password">, fields named like password/pin/otp,
//    or content inside them.
//  - NEVER submits forms by itself — recorded "submit" clicks replay as plain
//    clicks only; the user must click Replay explicitly each time.
//  - Recording & replay are injected only on the user's explicit button press.
// ============================================================================

(() => {
  'use strict';

  const S = {
    recording: false,
    events: [],
    name: '',
    replaying: false,
  };

  // ---------------------------------------------------------------- selectors
  // Build a stable CSS path for an element so we can re-target it at replay.
  function cssPath(el) {
    if (!(el instanceof Element)) return null;
    const parts = [];
    let node = el;
    while (node && node.nodeType === Node.ELEMENT_NODE && node !== document.documentElement) {
      let seg = node.tagName.toLowerCase();
      if (node.id) {
        seg += '#' + CSS.escape(node.id);
        parts.unshift(seg);
        break;
      }
      // nth-of-type for disambiguation among siblings of same type
      let sib = node, idx = 1;
      while ((sib = sib.previousElementSibling)) {
        if (sib.tagName === node.tagName) idx++;
      }
      if (idx > 1) seg += `:nth-of-type(${idx})`;
      parts.unshift(seg);
      node = node.parentElement;
    }
    return parts.length ? parts.join(' > ') : null;
  }

  // ----------------------------------------------------------- safety checks
  // Returns true if the element is a secret-bearing control we must skip.
  function isSecretField(el) {
    if (!(el instanceof HTMLElement)) return false;
    if (el.tagName === 'INPUT') {
      const t = (el.type || '').toLowerCase();
      if (t === 'password' || t === 'hidden') return true;
    }
    const name = ((el.name || '') + ' ' + (el.id || '') + ' ' + (el.getAttribute('aria-label') || '')).toLowerCase();
    return /(password|passwd|pwd|secret|pin|otp|passcode|authcode|cvv|cvc)/.test(name);
  }

  function safeTarget(el) {
    if (!el || el === document || el === document.body) return false;
    if (isSecretField(el)) return false;
    return true;
  }

  // ---------------------------------------------------------------- record
  function push(type, data) {
    S.events.push({ t: Date.now(), type, ...data });
    chrome.runtime.sendMessage({ kind: 'macro-progress', count: S.events.length }).catch(() => {});
  }

  function onClick(e) {
    const path = cssPath(e.target);
    if (!safeTarget(e.target) || !path) return;
    push('click', { path });
  }

  // Debounced typing: record the final value once the user pauses.
  const typingTimers = new WeakMap();
  function onInput(e) {
    const el = e.target;
    if (!safeTarget(el) || !el.matches || !el.matches('input, textarea, [contenteditable]')) return;
    if (isSecretField(el)) return;
    clearTimeout(typingTimers.get(el));
    typingTimers.set(el, setTimeout(() => {
      const path = cssPath(el);
      if (!path) return;
      let value = null;
      if (el.isContentEditable) value = el.textContent;
      else value = el.value;
      push('type', { path, value });
    }, 800));
  }

  let scrollTimer = null;
  function onScroll() {
    clearTimeout(scrollTimer);
    scrollTimer = setTimeout(() => {
      push('scroll', { x: window.scrollX, y: window.scrollY });
    }, 400);
  }

  function startRecording(name) {
    S.recording = true;
    S.events = [];
    S.name = name;
    document.addEventListener('click', onClick, true);
    document.addEventListener('input', onInput, true);
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  function stopRecording() {
    document.removeEventListener('click', onClick, true);
    document.removeEventListener('input', onInput, true);
    window.removeEventListener('scroll', onScroll);
    S.recording = false;
    const events = S.events;
    S.events = [];
    return events;
  }

  // ----------------------------------------------------------------- replay
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  function resolvePath(path) {
    try {
      return document.querySelector(path);
    } catch {
      return null;
    }
  }

  function dispatchClick(el) {
    // Replay as an ordinary synthetic click. We intentionally do NOT
    // auto-submit anything; forms only react as if a mouse clicked.
    const opts = { bubbles: true, cancelable: true, view: window };
    el.dispatchEvent(new MouseEvent('mousedown', opts));
    el.dispatchEvent(new MouseEvent('mouseup', opts));
    el.dispatchEvent(new MouseEvent('click', opts));
  }

  function setValue(el, value) {
    if (isSecretField(el)) return; // belt & braces: never fill secret fields
    el.focus();
    if (el.isContentEditable) {
      el.textContent = value;
      el.dispatchEvent(new InputEvent('input', { bubbles: true }));
    } else {
      // Use the native setter so framework bindings (React/Vue) pick it up.
      const setter = Object.getOwnPropertyDescriptor(
        el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype,
        'value'
      )?.set;
      const proto = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
      const fn = setter || proto;
      if (fn) fn.call(el, value);
      else el.value = value;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }

  async function replay(events, onProgress) {
    if (S.replaying) return { ok: false, reason: 'already-replaying' };
    S.replaying = true;
    let lastT = events.length ? events[0].t : 0;
    let done = 0;
    try {
      for (const ev of events) {
        const wait = Math.min(Math.max(ev.t - lastT, 0), 1500); // clamp pauses
        lastT = ev.t;
        await sleep(wait + 120);
        if (ev.type === 'click') {
          const el = resolvePath(ev.path);
          if (el && safeTarget(el)) dispatchClick(el);
        } else if (ev.type === 'type') {
          const el = resolvePath(ev.path);
          if (el && safeTarget(el)) setValue(el, ev.value);
        } else if (ev.type === 'scroll') {
          window.scrollTo(ev.x, ev.y);
        }
        done++;
        onProgress && onProgress(done, events.length);
      }
      return { ok: true };
    } finally {
      S.replaying = false;
    }
  }

  // ---------------------------------------------------------------- message
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.kind === 'macro-start') {
      startRecording(msg.name || 'Untitled macro');
      sendResponse({ ok: true });
    } else if (msg.kind === 'macro-stop') {
      const events = stopRecording();
      sendResponse({ ok: true, events, name: S.name });
    } else if (msg.kind === 'macro-replay') {
      replay(msg.events || [], (done, total) =>
        chrome.runtime.sendMessage({ kind: 'macro-replay-progress', done, total }).catch(() => {})
      ).then((res) => {
        chrome.runtime.sendMessage({ kind: 'macro-replay-done', result: res }).catch(() => {});
      });
      sendResponse({ ok: true });
    } else if (msg.kind === 'macro-state') {
      sendResponse({ recording: S.recording, count: S.events.length });
    }
    return true;
  });
})();
