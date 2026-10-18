/* content.js — Form Vault page-side capture.
   Injected ONLY into sites the user explicitly enabled (via chrome.scripting
   from the background worker on navigation, or manually from the popup).
   Captures text values on form submit and on debounced change; NEVER captures
   password, email, tel, number, url, search-as-sensitive, hidden, file,
   checkbox, radio, color, date/time, or credit-card-like fields. */

(() => {
  if (window.__formVaultLoaded) return;
  window.__formVaultLoaded = true;

  // Field types that must NEVER be captured.
  const BLOCKED_TYPES = new Set([
    "password", "email", "tel", "number", "url", "search",
    "hidden", "file", "checkbox", "radio", "color",
    "date", "datetime-local", "month", "week", "time", "range"
  ]);
  // Name/id/autocomplete hints that look sensitive.
  const SENSITIVE_RE = /(pass|pwd|secret|token|ssn|social|cvv|cvc|card|ccnum|iban|account|pin|otp|2fa)/i;

  /** True if this element is eligible for capture. */
  function isEligible(el) {
    if (!el || el.disabled || el.readOnly) return false;
    const tag = el.tagName;
    if (tag !== "INPUT" && tag !== "TEXTAREA") return false;
    if (tag === "INPUT") {
      const type = (el.type || "text").toLowerCase();
      if (BLOCKED_TYPES.has(type)) return false;
    }
    const hay = `${el.name || ""} ${el.id || ""} ${el.autocomplete || ""} ${el.placeholder || ""}`;
    if (SENSITIVE_RE.test(hay)) return false;
    return true;
  }

  /** Identify a field by name/id/placeholder for re-fill matching. */
  function fieldLabel(el) {
    return (el.name || el.id || el.placeholder || el.getAttribute("aria-label") || "field").slice(0, 80);
  }

  /** Collect current eligible values from the document. */
  function collect() {
    const out = [];
    const seen = new Set();
    document.querySelectorAll("input, textarea").forEach((el) => {
      if (!isEligible(el)) return;
      const value = (el.value || "").trim();
      if (value.length < 2 || value.length > 2000) return; // skip empties + huge blobs
      const key = fieldLabel(el) + "\n" + value;
      if (seen.has(key)) return;
      seen.add(key);
      out.push({ field: fieldLabel(el), value });
    });
    return out;
  }

  /** Persist a batch of captures into chrome.storage.local. */
  async function persist(items) {
    if (!items.length) return;
    const host = location.hostname;
    const { entries = [] } = await chrome.storage.local.get("entries");
    const have = new Set(entries.map((e) => e.host + "\n" + e.field + "\n" + e.value));
    const now = Date.now();
    let added = 0;
    for (const it of items) {
      const key = host + "\n" + it.field + "\n" + it.value;
      if (have.has(key)) continue;
      have.add(key);
      entries.push({
        id: "fv" + now + Math.random().toString(36).slice(2, 8),
        host, field: it.field, value: it.value,
        url: location.href.slice(0, 300), ts: now
      });
      added++;
    }
    if (added) {
      // Keep the vault bounded: newest 2000 entries win.
      const trimmed = entries.slice(-2000);
      await chrome.storage.local.set({ entries: trimmed });
    }
  }

  // Capture on form submit (capture phase so we run before navigation).
  document.addEventListener("submit", () => { persist(collect()); }, true);
  // Also capture on debounced change, so values survive without a submit.
  let debounce = null;
  document.addEventListener("input", () => {
    clearTimeout(debounce);
    debounce = setTimeout(() => persist(collect()), 4000);
  }, true);

  /* ---------- re-fill: fill fields whose label matches, triggered from popup ---------- */
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg && msg.type === "FV_REFILL") {
      let filled = 0;
      document.querySelectorAll("input, textarea").forEach((el) => {
        if (!isEligible(el)) return;
        if (fieldLabel(el) === msg.field) {
          el.focus();
          el.value = msg.value;
          el.dispatchEvent(new Event("input", { bubbles: true }));
          el.dispatchEvent(new Event("change", { bubbles: true }));
          filled++;
        }
      });
      sendResponse({ filled });
    }
    return true;
  });
})();
