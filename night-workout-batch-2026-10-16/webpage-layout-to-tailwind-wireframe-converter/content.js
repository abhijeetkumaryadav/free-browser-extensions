/* Wireframe Converter — content script.
 * Walks the visible DOM and builds a Tailwind-style wireframe: real content is
 * replaced with labelled placeholder boxes, and layout is approximated with a
 * small fixed set of Tailwind-like utility classes (defined inline in the
 * exported HTML — no CDN, no remote code).
 *
 * HEURISTIC MAPPING (honest scope): tag + size + position drive the chosen
 * placeholders. It is a structural sketch, not a pixel-perfect replica.
 */
(function () {
  if (window.__wfInstalled) return;
  window.__wfInstalled = true;

  const MAX_NODES = 400; // keeps output small and generation fast
  const SKIP = new Set(["script", "style", "noscript", "svg", "path", "link", "meta", "title", "template"]);

  // Fixed utility palette emitted by the generator. The exported HTML ships an
  // inline <style> implementing exactly these (hand-written, no Tailwind CDN).
  const UTIL_CSS = `
.wf{font-family:system-ui,sans-serif;background:#0f172a;color:#cbd5e1;padding:24px;min-height:100vh}
.wf-legend{background:#1e293b;border:1px dashed #64748b;border-radius:.75rem;padding:1rem;margin-bottom:1.5rem;font-size:.85rem;line-height:1.6}
.mx-auto{margin-left:auto;margin-right:auto}.max-w-7xl{max-width:80rem}
.w-full{width:100%}.flex{display:flex}.flex-col{flex-direction:column}
.grid{display:grid}.grid-cols-2{grid-template-columns:repeat(2,1fr)}.grid-cols-3{grid-template-columns:repeat(3,1fr)}
.gap-4{gap:1rem}.gap-8{gap:2rem}.items-center{align-items:center}.justify-between{justify-content:space-between}
.p-4{padding:1rem}.p-8{padding:2rem}.px-4{padding-left:1rem;padding-right:1rem}
.py-4{padding-top:1rem;padding-bottom:1rem}.py-8{padding-top:2rem;padding-bottom:2rem}
.mt-4{margin-top:1rem}.mt-8{margin-top:2rem}.mb-4{margin-bottom:1rem}
.h-6{height:1.5rem}.h-10{height:2.5rem}.h-16{height:4rem}.h-24{height:6rem}.h-32{height:8rem}.h-48{height:12rem}
.rounded{border-radius:.5rem}.rounded-lg{border-radius:.75rem}
.bg-slate-800{background:#1e293b}.bg-slate-700{background:#334155}.bg-slate-600{background:#475569}
.bg-sky-500{background:#0ea5e9}.bg-amber-400{background:#fbbf24}.bg-emerald-400{background:#34d399}.bg-violet-400{background:#a78bfa}
.border{border:1px solid #475569}.border-dashed{border-style:dashed}
.text-center{text-align:center}.text-xs{font-size:.75rem}.text-slate-400{color:#94a3b8}`;

  let count = 0;

  function tagOf(el) { return el.tagName.toLowerCase(); }

  function visible(el) {
    const cs = getComputedStyle(el);
    if (cs.display === "none" || cs.visibility === "hidden" || cs.opacity === "0") return false;
    const r = el.getBoundingClientRect();
    return r.width > 4 && r.height > 4;
  }

  function textBars(n) {
    let h = "";
    for (let i = 0; i < n; i++) {
      const w = i === n - 1 ? 60 : 100;
      h += '<div class="bg-slate-700 rounded h-6 mt-4" style="width:' + w + '%"></div>';
    }
    return h;
  }

  function mediaBox(tag, el) {
    const r = el.getBoundingClientRect();
    const ar = r.width > 0 && r.height > 0
      ? "aspect-ratio:" + (r.width / r.height).toFixed(2) + ";"
      : "";
    count++;
    return '<div class="bg-sky-500 rounded-lg w-full mt-4" title="' + tag +
      ' placeholder" style="' + ar + 'min-height:4rem;position:relative">' +
      '<span class="text-xs" style="position:absolute;top:6px;left:8px;color:#082f49;font-weight:700">' +
      tag.toUpperCase() + "</span></div>";
  }

  function node(el, depth) {
    if (count > MAX_NODES || depth > 4) return "";
    const t = tagOf(el);
    if (SKIP.has(t) || !visible(el)) return "";

    const kids = Array.from(el.children).filter((c) => !SKIP.has(tagOf(c)));
    const txt = (el.innerText || "").trim();

    if (t === "img" || t === "video" || t === "picture" || t === "figure") return mediaBox(t, el);
    if (t === "iframe" || t === "canvas") return mediaBox(t, el);

    if (/^h[1-6]$/.test(t)) {
      count++;
      const w = t === "h1" ? 80 : t === "h2" ? 65 : 50;
      return '<div class="bg-slate-600 rounded h-10 mt-8" title="' + t + ' heading" style="width:' + w + '%"></div>';
    }
    if (t === "p" || t === "blockquote") {
      count++;
      const bars = Math.min(4, Math.max(2, Math.ceil(txt.length / 120)));
      return '<div class="mt-4" title="paragraph">' + textBars(bars) + "</div>";
    }
    if (t === "button" || (t === "a" && kids.length === 0 && txt.length < 40)) {
      count++;
      return '<div class="bg-amber-400 rounded h-10 mt-4" title="' + t + '" style="width:8rem"></div>';
    }
    if (t === "input" || t === "textarea" || t === "select") {
      count++;
      return '<div class="border border-dashed rounded h-10 mt-4 w-full" title="form field"></div>';
    }
    if (t === "header" || t === "nav") {
      count++;
      return '<div class="flex items-center justify-between py-4 px-4 bg-slate-800 rounded-lg mt-4" title="site header/nav">' +
        '<div class="bg-emerald-400 rounded h-10" style="width:6rem"></div>' +
        '<div class="flex gap-4">' +
        '<div class="bg-slate-600 rounded h-6" style="width:4rem"></div>'.repeat(3) +
        "</div></div>";
    }
    if (t === "footer") {
      count++;
      return '<div class="bg-slate-800 rounded-lg p-8 mt-8 text-center" title="footer">' +
        '<div class="bg-slate-600 rounded h-6 mx-auto" style="width:40%"></div></div>';
    }
    if (t === "ul" || t === "ol") {
      count++;
      return '<div class="mt-4" title="list">' +
        '<div class="bg-slate-700 rounded h-6 mt-4" style="width:90%"></div>'.repeat(Math.min(4, kids.length || 3)) +
        "</div>";
    }

    // Generic containers: recurse into children.
    if (kids.length && depth < 4) {
      const inner = kids.map((k) => node(k, depth + 1)).join("");
      if (inner) {
        count++;
        const grid = kids.length >= 3 && depth >= 1 ? " grid grid-cols-3 gap-4" : "";
        return '<div class="w-full mt-4' + grid + '" title="' + t + ' container">' + inner + "</div>";
      }
    }
    // Leaf with meaningful text -> text block.
    if (txt.length > 40) {
      count++;
      return '<div class="mt-4" title="text block">' + textBars(3) + "</div>";
    }
    return "";
  }

  function build() {
    count = 0;
    const body = Array.from(document.body.children).map((el) => node(el, 0)).join("");
    const title = (document.title || "Wireframe").replace(/</g, "&lt;");
    const html =
      "<!DOCTYPE html><html><head><meta charset='utf-8'><title>Wireframe — " + title +
      "</title><style>" + UTIL_CSS + "</style></head>" +
      '<body class="wf"><div class="wf-legend"><b>Layout wireframe</b> (heuristic sketch)<br>' +
      "Source: " + title + "<br>" +
      "Real content replaced by placeholders — <span class='text-slate-400'>blue = media, amber = buttons/links, grey = text, green = logo</span>. " +
      "Utility classes are defined inline (no Tailwind CDN); mapping is heuristic, not pixel-perfect.</div>" +
      '<div class="max-w-7xl mx-auto">' + body + "</div></body></html>";
    return { html, blocks: count, bytes: html.length };
  }

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg && msg.type === "WF_BUILD") {
      try {
        sendResponse(build());
      } catch (e) {
        sendResponse({ error: String(e && e.message || e) });
      }
    }
    return true;
  });
})();
