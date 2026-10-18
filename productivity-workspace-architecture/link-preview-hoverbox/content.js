/* Link Preview Hoverbox — content script.
 * Hover a link for the configured delay and a small card appears near the
 * cursor showing the domain, full URL, and heuristic safety badges.
 * The link target is NEVER fetched or contacted. All analysis is local. */
(() => {
  "use strict";

  const DL_EXT = /\.(pdf|zip|rar|7z|tar|gz|exe|msi|dmg|pkg|apk|doc|docx|xls|xlsx|ppt|pptx|csv|mp3|wav|mp4|mov|avi|mkv|iso|torrent)$/i;
  const SUS_TLDS = ["zip", "mov", "click", "xyz", "top", "gq", "tk", "ml", "cf", "buzz", "country", "stream", "download", "racing", "review"];
  const IPV4 = /^\d{1,3}(\.\d{1,3}){3}$/;

  let enabled = true;
  let delay = 600;
  let timer = null;
  let card = null;
  let mouseX = 0, mouseY = 0;

  /* ---------- settings ---------- */
  async function loadSettings() {
    try {
      const s = await chrome.storage.local.get({ lphEnabled: true, lphDelay: 600 });
      enabled = s.lphEnabled !== false;
      delay = Math.max(200, Math.min(1500, parseInt(s.lphDelay, 10) || 600));
    } catch (e) { /* defaults */ }
  }
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    if (changes.lphEnabled) { enabled = changes.lphEnabled.newValue !== false; if (!enabled) hideCard(); }
    if (changes.lphDelay) delay = Math.max(200, Math.min(1500, parseInt(changes.lphDelay.newValue, 10) || 600));
  });

  /* ---------- URL analysis (pure string heuristics, no network) ---------- */
  function analyze(href) {
    let url;
    try { url = new URL(href, location.href); }
    catch (e) { return { ok: false }; }
    const host = url.hostname.toLowerCase();
    const badges = [];

    if (!/^https?:$/.test(url.protocol)) {
      badges.push({ cls: "web", label: url.protocol.replace(":", "") || "non-web" });
    } else {
      if (host !== location.hostname.toLowerCase()) badges.push({ cls: "ext", label: "External" });
      if (DL_EXT.test(url.pathname)) badges.push({ cls: "dl", label: "Download" });

      // Suspicious-shape heuristics
      const reasons = [];
      if (IPV4.test(host)) reasons.push("IP address host");
      if (host.includes("xn--")) reasons.push("look-alike (punycode) domain");
      if (url.username) reasons.push("embedded credentials");
      if (host.split(".").length > 4) reasons.push("excessive subdomains");
      const tld = host.split(".").pop();
      if (SUS_TLDS.includes(tld)) reasons.push("unusual TLD");
      if (href.length > 200) reasons.push("very long URL");
      if (reasons.length) badges.push({ cls: "sus", label: "Suspicious", reasons });
    }
    return { ok: true, url, host, href: url.href, badges };
  }

  /* ---------- preview card ---------- */
  function esc(s) {
    return String(s).replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  function buildCard() {
    const el = document.createElement("div");
    el.id = "__lph_card__";
    const css = document.createElement("style");
    css.textContent = `
      #__lph_card__{position:fixed;z-index:2147483647;max-width:340px;pointer-events:none;
        background:rgba(18,18,26,.94);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);
        border:1px solid rgba(56,189,248,.35);border-radius:12px;padding:12px 14px;
        color:#f4f6fb;font:12px/1.5 -apple-system,"Segoe UI",Roboto,sans-serif;
        box-shadow:0 16px 48px rgba(0,0,0,.55);word-break:break-all;}
      #__lph_card__ .__lph_host__{font-weight:700;font-size:14px;color:#7dd3fc;margin-bottom:2px;word-break:break-all;}
      #__lph_card__ .__lph_url__{color:#9aa3b5;font-size:11px;max-height:52px;overflow:hidden;
        display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;}
      #__lph_card__ .__lph_badges__{margin-top:8px;display:flex;flex-wrap:wrap;gap:6px;}
      #__lph_card__ .__lph_b{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;
        border-radius:6px;padding:3px 8px;border:1px solid;}
      #__lph_card__ .__lph_b.ext{color:#38bdf8;border-color:rgba(56,189,248,.45);background:rgba(56,189,248,.12);}
      #__lph_card__ .__lph_b.dl{color:#f5a623;border-color:rgba(245,166,35,.45);background:rgba(245,166,35,.12);}
      #__lph_card__ .__lph_b.sus{color:#f06666;border-color:rgba(240,102,102,.45);background:rgba(240,102,102,.12);}
      #__lph_card__ .__lph_b.web{color:#9aa3b5;border-color:rgba(154,163,181,.45);background:rgba(154,163,181,.12);}
      #__lph_card__ .__lph_reasons__{margin-top:6px;font-size:11px;color:#f0a0a0;}`;
    document.documentElement.appendChild(css);
    return el;
  }

  function showCard(anchor, info) {
    if (!card) card = buildCard();
    const badgeHtml = info.badges.map((b) =>
      `<span class="__lph_b ${b.cls}">${esc(b.label)}</span>`).join("");
    const reasonHtml = info.badges
      .filter((b) => b.reasons && b.reasons.length)
      .map((b) => `<div class="__lph_reasons__">⚠ ${esc(b.reasons.join("; "))}</div>`).join("");
    card.innerHTML =
      `<div class="__lph_host__">${esc(info.host || info.href)}</div>` +
      `<div class="__lph_url__">${esc(info.href)}</div>` +
      (badgeHtml ? `<div class="__lph_badges__">${badgeHtml}</div>` : "") + reasonHtml;
    document.documentElement.appendChild(card);

    // Position near the cursor, clamped to the viewport.
    const pad = 14;
    const r = card.getBoundingClientRect();
    let x = mouseX + 16, y = mouseY + 18;
    if (x + r.width > window.innerWidth - pad) x = mouseX - r.width - 12;
    if (y + r.height > window.innerHeight - pad) y = mouseY - r.height - 12;
    card.style.left = Math.max(pad, x) + "px";
    card.style.top = Math.max(pad, y) + "px";
  }

  function hideCard() {
    if (timer) { clearTimeout(timer); timer = null; }
    if (card && card.parentNode) card.parentNode.removeChild(card);
  }

  /* ---------- hover tracking ---------- */
  function anchorOf(node) {
    return node && node.nodeType === 1 ? node.closest("a[href]") : null;
  }

  document.addEventListener("mousemove", (e) => {
    mouseX = e.clientX; mouseY = e.clientY;
  }, { passive: true });

  document.addEventListener("mouseover", (e) => {
    if (!enabled) return;
    const a = anchorOf(e.target);
    if (!a) { hideCard(); return; }
    if (timer) clearTimeout(timer);
    const href = a.href; // resolved absolute URL
    timer = setTimeout(() => {
      timer = null;
      // Only show if the pointer is still over the same link.
      if (!a.isConnected || !a.matches(":hover")) return;
      const info = analyze(href);
      if (info.ok) showCard(a, info);
    }, delay);
  }, { passive: true });

  document.addEventListener("mouseout", (e) => {
    if (anchorOf(e.target) && !anchorOf(e.relatedTarget)) hideCard();
  }, { passive: true });

  document.addEventListener("scroll", hideCard, { passive: true, capture: true });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") hideCard(); });

  loadSettings();
})();
