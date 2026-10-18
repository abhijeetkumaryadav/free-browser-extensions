/* Dark Pattern Spotter — content script.
 * Runs ONLY when the user clicks "Scan this page". Read-only analysis:
 * highlights suspicious elements with amber outlines, never modifies the page.
 */
(() => {
  'use strict';

  const HIGHLIGHT_CLASS = 'dps-highlight';
  let findings = [];

  const PATTERNS = {
    // Pre-checked boxes: consent, marketing, add-ons, insurance, warranties
    prechecked: {
      sev: 'high', title: 'Pre-checked box',
      why: 'A checkbox is already ticked for you — typically marketing consent, add-ons, or insurance. This is an opt-out trap: you pay or consent unless you notice and untick it.'
    },
    // Fake urgency / scarcity pressure
    urgency: {
      sev: 'medium', title: 'Urgency / scarcity pressure',
      why: 'Countdown timers, "only X left", or expiring-offer language pressure you into deciding fast. Often the deadline is fake or resets.',
      re: /(offer ends|deal ends|expires in|only \d+ left|hurry|act now|last chance|selling fast|almost gone|ends (in|tonight|today)|limited[- ]time)/i
    },
    // Confirm-shaming: guilt-laden decline options
    shaming: {
      sev: 'medium', title: 'Confirm-shaming',
      why: 'The "no thanks" option shames you ("No, I hate saving money"). It manipulates the decline choice instead of presenting it neutrally.',
      re: /(no thanks,? i (don't|do not) (want|like|need)|no,? i('d| would) rather (pay|miss)|i hate (saving|deals|discounts)|maybe later,? (loser|sucker)|decline (this|my) (offer|discount|savings))/i
    },
    // Forced continuity: free trial that converts to paid
    continuity: {
      sev: 'medium', title: 'Free-trial → paid trap',
      why: 'A "free trial" that silently converts to a paid subscription. Check when billing starts, the price after trial, and how to cancel before you are charged.',
      re: /(free trial|try free|start free).{0,80}(then|after|billed|charged|\$|€|£|per month|\/mo)/i
    },
    // Hard-to-find cancel: cancel links styled to be missed
    cancel: {
      sev: 'low', title: 'Cancel path obscured',
      why: 'The cancel/unsubscribe option is styled to be hard to find — tiny text, low contrast, or buried. Legitimate services make cancellation as easy as signup.',
      re: /(cancel (subscription|membership|plan|account)|unsubscribe|manage subscription|turn off auto[- ]?renew)/i
    }
  };

  function visible(el) {
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    return r.width > 1 && r.height > 1 && s.visibility !== 'hidden' && s.display !== 'none';
  }

  function tiny(el) {
    const px = parseFloat(getComputedStyle(el).fontSize) || 16;
    return px <= 10;
  }

  function snippet(el) {
    const t = (el.innerText || el.textContent || '').trim().replace(/\s+/g, ' ');
    return t.length > 120 ? t.slice(0, 117) + '…' : t;
  }

  function mark(el, finding) {
    const idx = findings.length;
    findings.push({ ...finding, index: idx, snippet: snippet(el) });
    el.classList.add(HIGHLIGHT_CLASS);
    el.dataset.dpsIndex = idx;
    el.scrollIntoViewIfNeeded ? el.scrollIntoViewIfNeeded({ block: 'center' }) : null;
  }

  function clearMarks() {
    document.querySelectorAll('.' + HIGHLIGHT_CLASS).forEach(el => {
      el.classList.remove(HIGHLIGHT_CLASS);
      delete el.dataset.dpsIndex;
    });
    document.getElementById('dps-style')?.remove();
    findings = [];
  }

  function injectStyle() {
    if (document.getElementById('dps-style')) return;
    const st = document.createElement('style');
    st.id = 'dps-style';
    st.textContent = `.${HIGHLIGHT_CLASS}{outline:3px solid #f59e0b !important;outline-offset:2px !important;position:relative !important;}`;
    document.documentElement.appendChild(st);
  }

  function scan() {
    clearMarks();
    injectStyle();

    // 1. Pre-checked checkboxes
    document.querySelectorAll('input[type="checkbox"]').forEach(cb => {
      if (!cb.checked || !visible(cb)) return;
      const ctx = snippet(cb.closest('label') || cb.parentElement || cb);
      if (/consent|marketing|newsletter|partner|offer|addon|add-on|insurance|warranty|subscribe|promotional|third[- ]?party/i.test(ctx)) {
        mark(cb.closest('label') || cb, PATTERNS.prechecked);
      }
    });

    // 2–4. Text-based patterns on visible interactive/text elements
    const els = document.querySelectorAll('a, button, p, span, div, li, h1, h2, h3, h4, strong, em');
    const seen = new Set();
    els.forEach(el => {
      if (!visible(el) || el.children.length > 3) return; // leaf-ish nodes only
      const text = (el.innerText || '').trim().replace(/\s+/g, ' ');
      if (!text || text.length > 220 || seen.has(text)) return;

      if (PATTERNS.urgency.re.test(text)) { seen.add(text); mark(el, PATTERNS.urgency); }
      else if (PATTERNS.shaming.re.test(text)) { seen.add(text); mark(el, PATTERNS.shaming); }
      else if (PATTERNS.continuity.re.test(text)) { seen.add(text); mark(el, PATTERNS.continuity); }
      else if (PATTERNS.cancel.re.test(text) && tiny(el)) { seen.add(text); mark(el, PATTERNS.cancel); }
    });

    // 5. Hidden fees in fine print: tiny text mentioning fees/charges
    document.querySelectorAll('p, span, div, small, li, td').forEach(el => {
      if (!visible(el) || !tiny(el) || el.children.length > 0) return;
      const text = (el.textContent || '').trim();
      if (text.length > 12 && /(fee|fees|charged|charges|\$|€|£|per month|\/ ?mo(nth)?|billed|auto[- ]?renew|subscription)/i.test(text)) {
        mark(el, { sev: 'high', title: 'Possible hidden fee in fine print',
          why: 'Pricing or fee terms appear in tiny text. Important costs should be prominent — read this carefully before agreeing.' });
      }
    });

    // De-dupe overlapping nested hits: keep the outermost only
    const outer = [];
    findings.forEach(f => {
      const el = document.querySelector(`[data-dps-index="${f.index}"]`);
      if (!el) return;
      if (!outer.some(o => o.contains(el))) outer.push(el);
    });
    findings = outer.map((el, i) => ({ ...findings[+el.dataset.dpsIndex], index: i }));
    outer.forEach((el, i) => { el.dataset.dpsIndex = i; });

    return findings;
  }

  chrome.runtime.onMessage.addListener((msg, _sender, respond) => {
    if (msg?.type === 'dps-scan') respond({ findings: scan() });
    else if (msg?.type === 'dps-clear') { clearMarks(); respond({ ok: true }); }
    else if (msg?.type === 'dps-goto' && typeof msg.index === 'number') {
      const el = document.querySelector(`[data-dps-index="${msg.index}"]`);
      if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); respond({ ok: true }); }
      else respond({ ok: false });
    }
    return false;
  });
})();
