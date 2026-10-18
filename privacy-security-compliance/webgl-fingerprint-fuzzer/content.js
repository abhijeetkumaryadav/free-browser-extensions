/* ==========================================================================
   WebGL Fingerprint Fuzzer — content script (isolated world)
   Runs at document_start. Reads the user's settings from on-device storage
   and, when protection is active for this origin, injects the fuzzing code
   into the page's MAIN world via a script tag (this technique works in
   Chromium and Firefox alike, unlike world:"MAIN" content scripts).
   The injected code is a static string shipped inside this extension —
   never remote code.
   ========================================================================== */

'use strict';

/**
 * MAIN-world fuzzing payload. Injected as a script tag so it runs before
 * page scripts and can wrap the real WebGL prototypes.
 * @param {string} token - per-page-load random token for renderer spoofing
 * @returns {string} self-contained script source
 */
function buildFuzzScript(token) {
  return '(' + function (TOKEN) {
    'use strict';

    /* Simple seeded PRNG so noise differs per page load. */
    let s = 0;
    for (let i = 0; i < TOKEN.length; i++) s = (s * 31 + TOKEN.charCodeAt(i)) >>> 0;
    function rand() {
      s = (s + 0x6D2B79F5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }

    function clamp(v) { return v < 0 ? 0 : v > 255 ? 255 : v; }

    const contexts = [];
    if (typeof WebGLRenderingContext !== 'undefined') contexts.push(WebGLRenderingContext);
    if (typeof WebGL2RenderingContext !== 'undefined') contexts.push(WebGL2RenderingContext);

    contexts.forEach(function (Ctx) {
      const proto = Ctx.prototype;

      /* ---- readPixels: sprinkle ±2 noise over RGB channels ---- */
      const origReadPixels = proto.readPixels;
      proto.readPixels = function (x, y, w, h, format, type, pixels) {
        const result = origReadPixels.apply(this, arguments);
        try {
          if (pixels && (pixels instanceof Uint8Array || pixels instanceof Uint8ClampedArray)) {
            // Touch a sparse subset — enough to poison hashes, invisible on screen.
            for (let i = 0; i < pixels.length; i += 16) {
              const delta = rand() < 0.5 ? -1 : 1;
              const amt = 1 + Math.floor(rand() * 2); // 1–2 LSB
              pixels[i] = clamp(pixels[i] + delta * amt);
            }
          }
        } catch (e) { /* never break the page */ }
        return result;
      };

      /* ---- getParameter: spoof GPU identification strings ---- */
      const origGetParameter = proto.getParameter;
      proto.getParameter = function (p) {
        try {
          let ext = null;
          try { ext = this.getExtension('WEBGL_debug_renderer_info'); } catch (e) { /* ignore */ }
          if (ext) {
            if (p === ext.UNMASKED_VENDOR_WEBGL) return 'WebKit';
            // Per-load random suffix => the fingerprint is unstable across loads.
            if (p === ext.UNMASKED_RENDERER_WEBGL) return 'WebKit WebGL (' + TOKEN + ')';
          }
        } catch (e) { /* fall through to original */ }
        return origGetParameter.apply(this, arguments);
      };
    });
  } + ')(' + JSON.stringify(token) + ');';
}

/** Random 8-char token, regenerated for every page load. */
function makeToken() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let t = '';
  const buf = new Uint8Array(8);
  crypto.getRandomValues(buf);
  for (let i = 0; i < 8; i++) t += chars[buf[i] % chars.length];
  return t;
}

(async function init() {
  try {
    const data = await chrome.storage.local.get({ settings: { enabled: true, allowlist: [] } });
    const settings = data.settings || { enabled: true, allowlist: [] };
    if (!settings.enabled) return;

    const host = location.hostname || '';
    if (Array.isArray(settings.allowlist) && settings.allowlist.includes(host)) return;

    // Inject into MAIN world before page scripts run.
    const script = document.createElement('script');
    script.textContent = buildFuzzScript(makeToken());
    const root = document.documentElement;
    if (root) {
      root.appendChild(script);
      script.remove(); // code already ran; leave no trace in the DOM
    }
  } catch (err) {
    // Fail closed: if anything goes wrong, the page loads unmodified.
  }
})();
