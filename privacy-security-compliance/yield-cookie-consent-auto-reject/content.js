/* =====================================================================
 * Yield — Cookie Consent Auto-Reject — content script
 *
 * Privacy-first banner handling: detects common consent banners and
 * clicks a "reject" button — never an "accept" button. Runs once after
 * a short delay, plus a bounded observer for late-injected banners.
 *
 * SAFETY CONTRACT:
 *  - A candidate is clicked ONLY if it matches a REJECT pattern AND does
 *    NOT match any ACCEPT guard pattern.
 *  - If no unambiguous reject button is found, nothing is clicked.
 * ===================================================================== */
(() => {
  'use strict';

  const STORE_KEY = 'yieldcc';
  const OBSERVE_MS = 15000; // watch for late banners this long, then stop

  const DEFAULTS = {
    master: true,
    mode: 'auto',       // 'auto' | 'manual'
    delayMs: 1200,      // wait before first scan
    disabledSites: [],  // origins where Yield does nothing
    log: [],            // [{ origin, time, result, detail }]
  };

  /* Known consent-management platform banner roots (scoped search first). */
  const CMP_ROOTS = [
    '#onetrust-banner-sdk', '#onetrust-consent-sdk', '.onetrust-pc-dark-filter',
    '#truste-consent-track', '.trustarc-banner', '.truste_box_overlay',
    '#cookie-law-info-bar', '.cky-consent-container', '.cky-modal', '.cky-overlay',
    '#didomi-host', '#didomi-popup', '.didomi-popup-view',
    '#qc-cmp2-ui', '.qc-cmp2-container',
    '[id^="sp_message_container"]', '.sp_message_container',
    '.fc-consent-root', '.fc-dialog-container',
    '[id*="cookie-banner"]', '[class*="cookie-banner"]',
    '[id*="cookieBanner"]', '[class*="cookieBanner"]',
    '[id*="consent-banner"]', '[class*="consent-banner"]',
  ];

  /* Unambiguous REJECT signals (multilingual). */
  const REJECT = [
    /reject\s+all/i, /^reject$/i, /decline/i, /\bdeny\b/i,
    /necessary\s+only/i, /essential(ly)?\s+only/i, /only\s+(necessary|essential)/i,
    /use\s+necessary/i, /technically\s+necessary/i,
    /nur\s+notwendige/i, /alle\s+ablehnen/i, /\bablehnen\b/i,
    /tout\s+refuser/i, /\brefuser\b/i, /uniquement\s+nécessaires/i,
    /rechazar\s+todo/i, /solo\s+necesarias?/i,
    /rifiuta/i, /solo\s+necessari/i,
    /alleen\s+noodzakelijk/i, /weigeren/i,
    /kun\s+nødvendige/i, /afvis/i,
    /odrzuć/i, /tylko\s+niezbędne/i,
    /recusar/i, /apenas\s+necessários?/i,
  ];

  /* ACCEPT guards — if a candidate matches any of these, NEVER click it. */
  const ACCEPT = [
    /accept\s+all/i, /allow\s+all/i, /^accept$/i, /agree\s+and\s+continue/i,
    /\ballow\b/i, /got\s+it/i, /^ok$/i, /continue/i,
    /alle\s+akzeptieren/i, /tout\s+accepter/i, /aceptar\s+todo/i,
    /accetta\s+tutto/i, /alles\s+accepteren/i, /aceitar\s+tudo/i,
    /zaakceptuj/i, /godkänn/i,
  ];

  async function loadSettings() {
    const data = await chrome.storage.local.get(STORE_KEY);
    return { ...DEFAULTS, ...(data[STORE_KEY] || {}) };
  }

  async function addLog(settings, result, detail) {
    const entry = {
      origin: location.origin,
      time: Date.now(),
      result,
      detail: String(detail || '').slice(0, 160),
    };
    const log = [...(settings.log || []), entry].slice(-100);
    await chrome.storage.local.set({ [STORE_KEY]: { ...settings, log } });
  }

  /** Visible, clickable elements that could be banner buttons. */
  function candidateButtons(root) {
    const els = root.querySelectorAll(
      'button, input[type="button"], input[type="submit"], [role="button"], a.btn, a.button'
    );
    return [...els].filter((el) => {
      if (el.disabled) return false;
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) return false;
      const style = getComputedStyle(el);
      if (style.visibility === 'hidden' || style.display === 'none') return false;
      return true;
    });
  }

  /** Human-readable label of a button. */
  function labelOf(el) {
    const t = (el.innerText || el.value || el.getAttribute('aria-label') || '').trim();
    return t.replace(/\s+/g, ' ');
  }

  const matchesAny = (text, list) => list.some((re) => re.test(text));

  /**
   * Find the best reject button. Returns { el, label } or null.
   * A button is eligible only if it matches REJECT and not ACCEPT.
   */
  function findRejectButton(scopeRoots) {
    const found = [];
    for (const root of scopeRoots) {
      for (const el of candidateButtons(root)) {
        const label = labelOf(el);
        if (!label || label.length > 60) continue;
        if (matchesAny(label, ACCEPT)) continue;      // guard: never accept
        if (matchesAny(label, REJECT)) {
          // Specificity score: longer, more explicit labels win.
          let score = label.length;
          if (/reject\s+all/i.test(label)) score += 50;
          if (/necessary|essential|notwendige|nécessaires/i.test(label)) score += 30;
          found.push({ el, label, score });
        }
      }
    }
    if (found.length === 0) return null;
    found.sort((a, b) => b.score - a.score);
    return found[0];
  }

  /** Locate banner roots; fall back to the whole document. */
  function bannerRoots() {
    const roots = [];
    for (const sel of CMP_ROOTS) {
      try {
        document.querySelectorAll(sel).forEach((el) => {
          if (el.getBoundingClientRect().width > 0) roots.push(el);
        });
      } catch (_) { /* bad selector — skip */ }
    }
    return roots.length > 0 ? roots : [document.body || document.documentElement];
  }

  /** Check whether any known banner root is still visible. */
  function bannerStillVisible() {
    return bannerRoots().some((root) => {
      if (root === document.body || root === document.documentElement) return false;
      const r = root.getBoundingClientRect();
      const style = getComputedStyle(root);
      return r.width > 0 && r.height > 0 &&
        style.display !== 'none' && style.visibility !== 'hidden';
    });
  }

  let handled = false;

  /** One detection + (safe) click attempt. Returns a result string. */
  async function scanAndHandle(settings, source) {
    if (handled) return 'already-handled';
    const roots = bannerRoots();
    const scoped = roots[0] !== document.body && roots[0] !== document.documentElement;
    const target = findRejectButton(roots);
    if (!target) {
      await addLog(settings, scoped ? 'no-safe-button' : 'no-banner',
        scoped ? 'Banner found, but no unambiguous reject button.' : 'No banner detected.');
      return scoped ? 'no-safe-button' : 'no-banner';
    }
    target.el.click();
    handled = true;
    // Verify the banner actually went away.
    await new Promise((r) => setTimeout(r, 900));
    const gone = !bannerStillVisible();
    await addLog(settings, gone ? 'rejected' : 'clicked-unverified',
      `Clicked "${target.label}" (${source}).` + (gone ? '' : ' Banner may still be visible.'));
    return gone ? 'rejected' : 'clicked-unverified';
  }

  /** Main entry: decide whether to act, then scan. */
  async function run(source) {
    try {
      const settings = await loadSettings();
      if (!settings.master) return;
      if (settings.disabledSites.includes(location.origin)) {
        if (source === 'manual') {
          await addLog(settings, 'disabled-site', 'Manual scan on a disabled site — skipped.');
        }
        return;
      }
      await scanAndHandle(settings, source);
    } catch (_) { /* storage unavailable — do nothing, never click blind */ }
  }

  // Manual "Scan now" from the popup.
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg && msg.kind === 'yield-scan-now') {
      handled = false; // allow a fresh manual attempt
      run('manual');
    }
  });

  // Boot: delayed auto-scan + bounded observer for late banners.
  (async () => {
    const settings = await loadSettings().catch(() => null);
    if (!settings || !settings.master) return;
    if (settings.disabledSites.includes(location.origin)) return;
    if (settings.mode !== 'auto') return;

    setTimeout(() => run('auto'), Math.max(0, settings.delayMs || 0));

    // Late-injected CMP banners: re-scan a few times, then stop.
    let checks = 0;
    const iv = setInterval(() => {
      checks += 1;
      if (handled || checks * 3000 >= OBSERVE_MS) {
        clearInterval(iv);
        return;
      }
      if (!handled) run('auto-late');
    }, 3000);
  })();
})();
