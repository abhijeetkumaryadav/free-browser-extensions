/* Tech Stack Detector — popup logic.
 * On click, injects a read-only fingerprint collector into the active tab,
 * then matches collected signals against a bundled pattern list. 100% local. */
"use strict";

/* Runs inside the page (isolated world). Collects fingerprints, returns them. */
function scanPage() {
  const out = { meta: {}, scripts: [], links: [], globals: [], htmlHas: {} };

  for (const m of document.querySelectorAll("meta[name], meta[property]")) {
    const name = (m.getAttribute("name") || m.getAttribute("property") || "").toLowerCase();
    const content = (m.getAttribute("content") || "").slice(0, 200);
    if (/generator|framework|version/.test(name) && content) out.meta[name] = content;
  }
  for (const s of document.scripts) {
    const src = s.getAttribute("src");
    if (src) out.scripts.push(src.slice(0, 300));
  }
  for (const l of document.querySelectorAll("link[href]")) {
    const rel = (l.getAttribute("rel") || "").toLowerCase();
    if (/stylesheet|preload/.test(rel)) out.links.push(l.getAttribute("href").slice(0, 300));
  }
  const candidates = ["React","ReactDOM","Vue","angular","jQuery","Backbone","Ember",
    "Next","Nuxt","Gatsby","__NEXT_DATA__","__NUXT__","Shopify","Drupal",
    "Alpine","htmx","Turbo","Livewire","dataLayer","gtag","fbq","Stripe",
    "Intercom","Segment","Hotjar","Three","d3","Chart","Sentry","ng","Preact"];
  for (const name of candidates) {
    try { if (typeof window[name] !== "undefined") out.globals.push(name); } catch (e) {}
  }
  const head5k = document.documentElement.outerHTML.slice(0, 5000);
  out.htmlHas["wp-content"] = head5k.includes("wp-content");
  out.htmlHas["drupal"] = head5k.includes("drupal");
  out.htmlHas["ng-app"] = !!document.querySelector("[ng-app],[data-ng-app]");
  out.htmlHas["next-data"] = !!document.getElementById("__NEXT_DATA__");
  out.htmlHas["nuxt-root"] = !!document.getElementById("__nuxt");
  out.htmlHas["shopify"] = head5k.includes("shopify");
  out.htmlHas["wix"] = head5k.includes("wix.com");
  out.htmlHas["squarespace"] = head5k.includes("squarespace");
  out.url = location.hostname;
  return out;
}

/* Bundled pattern list: fingerprint matchers -> detection entries.
 * Each rule: {name, cat, conf ("high"|"medium"|"low"), test(fp) -> evidence string|null} */
const RULES = [
  { name:"React", cat:"Frontend framework", conf:"high",
    test:fp => fp.globals.includes("React")||fp.globals.includes("__NEXT_DATA__") ? "window.React / __NEXT_DATA__ present" : null },
  { name:"Next.js", cat:"React framework", conf:"high",
    test:fp => fp.globals.includes("__NEXT_DATA__")||fp.scripts.some(s=>s.includes("_next/static")) ? "Found __NEXT_DATA__ / _next/static assets" : null },
  { name:"Vue.js", cat:"Frontend framework", conf:"high",
    test:fp => fp.globals.includes("Vue") ? "window.Vue present" : null },
  { name:"Nuxt", cat:"Vue framework", conf:"high",
    test:fp => fp.globals.includes("__NUXT__")||fp.htmlHas["nuxt-root"] ? "Found __NUXT__ / #__nuxt" : null },
  { name:"Angular", cat:"Frontend framework", conf:"high",
    test:fp => fp.globals.includes("angular")||fp.htmlHas["ng-app"] ? "window.angular / ng-app attribute present" : null },
  { name:"SvelteKit", cat:"Frontend framework", conf:"medium",
    test:fp => fp.scripts.some(s=>/svelte/.test(s)) ? "Svelte chunks in script URLs" : null },
  { name:"jQuery", cat:"JS library", conf:"high",
    test:fp => fp.globals.includes("jQuery") ? "window.jQuery present" : null },
  { name:"Alpine.js", cat:"JS library", conf:"high",
    test:fp => fp.globals.includes("Alpine") ? "window.Alpine present" : null },
  { name:"htmx", cat:"JS library", conf:"high",
    test:fp => fp.globals.includes("htmx") ? "window.htmx present" : null },
  { name:"Turbo / Hotwire", cat:"JS library", conf:"medium",
    test:fp => fp.globals.includes("Turbo") ? "window.Turbo present" : null },
  { name:"Tailwind CSS", cat:"CSS framework", conf:"medium",
    test:fp => fp.links.some(l=>/tailwind/.test(l)) ? "Tailwind stylesheet link found" : null },
  { name:"Bootstrap", cat:"CSS framework", conf:"medium",
    test:fp => fp.links.some(l=>/bootstrap/.test(l)) ? "Bootstrap stylesheet link found" : null },
  { name:"WordPress", cat:"CMS", conf:"high",
    test:fp => fp.htmlHas["wp-content"] ? "wp-content paths in markup" : null },
  { name:"Drupal", cat:"CMS", conf:"medium",
    test:fp => fp.htmlHas["drupal"] ? "Drupal strings in markup" : null },
  { name:"Shopify", cat:"E-commerce", conf:"high",
    test:fp => fp.htmlHas["shopify"]||fp.globals.includes("Shopify") ? "Shopify markers found" : null },
  { name:"Wix", cat:"Site builder", conf:"medium",
    test:fp => fp.htmlHas["wix"] ? "wix.com references found" : null },
  { name:"Squarespace", cat:"Site builder", conf:"medium",
    test:fp => fp.htmlHas["squarespace"] ? "Squarespace references found" : null },
  { name:"Google Analytics", cat:"Analytics", conf:"high",
    test:fp => fp.globals.includes("gtag")||fp.globals.includes("dataLayer") ? "gtag / dataLayer present" : null },
  { name:"Meta Pixel", cat:"Analytics", conf:"medium",
    test:fp => fp.globals.includes("fbq") ? "window.fbq present" : null },
  { name:"Stripe", cat:"Payments", conf:"medium",
    test:fp => fp.globals.includes("Stripe")||fp.scripts.some(s=>/js\.stripe\.com/.test(s)) ? "Stripe.js detected" : null },
  { name:"Intercom", cat:"Support/chat", conf:"medium",
    test:fp => fp.globals.includes("Intercom") ? "window.Intercom present" : null },
  { name:"Segment", cat:"Analytics", conf:"medium",
    test:fp => fp.globals.includes("Segment") ? "Segment analytics present" : null },
  { name:"Hotjar", cat:"Analytics", conf:"medium",
    test:fp => fp.globals.includes("Hotjar") ? "window.Hotjar present" : null },
  { name:"Three.js", cat:"3D/WebGL", conf:"medium",
    test:fp => fp.globals.includes("Three") ? "window.THREE present" : null },
  { name:"D3.js", cat:"Data viz", conf:"medium",
    test:fp => fp.globals.includes("d3") ? "window.d3 present" : null },
  { name:"Sentry", cat:"Error tracking", conf:"medium",
    test:fp => fp.globals.includes("Sentry") ? "window.Sentry present" : null }
];

const scanBtn = document.getElementById("scanBtn");
const clearBtn = document.getElementById("clearBtn");
const statusEl = document.getElementById("status");
const resultsEl = document.getElementById("results");

scanBtn.addEventListener("click", async () => {
  scanBtn.disabled = true;
  statusEl.textContent = "Scanning fingerprints…";
  resultsEl.innerHTML = "";
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id) throw new Error("No active tab.");
    if (/^(chrome|edge|about|chrome-extension):/.test(tab.url || "")) {
      throw new Error("Cannot scan browser-internal pages.");
    }
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: scanPage
    });
    const hits = [];
    for (const rule of RULES) {
      let ev = null;
      try { ev = rule.test(result); } catch (e) {}
      if (ev) hits.push({ name: rule.name, cat: rule.cat, conf: rule.conf, ev });
    }
    // Generator meta tag is a bonus signal.
    const gen = result.meta["generator"];
    if (gen) hits.push({ name: gen.split(" ")[0], cat: "Generator meta tag", conf: "medium", ev: "meta generator: " + gen });

    if (!hits.length) {
      statusEl.textContent = `No known fingerprints found on ${result.url || "this page"}.`;
      resultsEl.innerHTML = '<div class="empty">Nothing matched the bundled pattern list.</div>';
    } else {
      statusEl.textContent = `${hits.length} fingerprint${hits.length > 1 ? "s" : ""} matched on ${result.url || "this page"}.`;
      resultsEl.innerHTML = hits.map(h => `
        <div class="hit">
          <div class="top">
            <span class="name">${escapeHtml(h.name)}</span>
            <span class="badge ${h.conf}">${h.conf.toUpperCase()}</span>
          </div>
          <div class="cat">${escapeHtml(h.cat)}</div>
          <div class="ev">${escapeHtml(h.ev)}</div>
        </div>`).join("");
    }
  } catch (err) {
    statusEl.textContent = "Scan failed: " + (err.message || err);
  } finally {
    scanBtn.disabled = false;
  }
});

clearBtn.addEventListener("click", () => {
  resultsEl.innerHTML = "";
  statusEl.textContent = "Click “Scan this page”.";
});

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
