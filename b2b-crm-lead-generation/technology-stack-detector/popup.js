// Technology Stack Detector — popup logic.
// analyzePage() runs INSIDE the page, so it must stay fully self-contained.

function analyzePage() {
  // --- gather page signals ---
  const scripts = [...document.scripts].map((s) => s.src || "").filter(Boolean);
  const links = [...document.querySelectorAll("link[href]")].map((l) => l.href || "");
  const metas = [...document.querySelectorAll("meta")].map((m) => ({
    name: (m.getAttribute("name") || m.getAttribute("property") || "").toLowerCase(),
    content: (m.getAttribute("content") || "").slice(0, 200),
  }));
  const headHtml = (document.head && document.head.innerHTML || "").slice(0, 60000);
  const urls = scripts.concat(links).join("\n").toLowerCase();
  const gen = (metas.find((m) => m.name === "generator") || {}).content || "";

  const has = (re) => re.test(urls);
  const found = [];
  const add = (name, cat, conf, evidence) => found.push({ name, category: cat, confidence: conf, evidence });

  // --- JS libraries (High = exact filename match, Medium = vendor substring) ---
  const lib = (name, re, hi) => {
    for (const s of scripts) {
      const file = (s.split("/").pop() || "").toLowerCase();
      if (hi.test(file)) { add(name, "JS Libraries", "high", s); return; }
    }
    if (re.test(urls)) add(name, "JS Libraries", "medium", "script URL pattern");
  };
  lib("jQuery", /jquery/, /jquery[-.]?(\d+\.)?\d+(\.min|\.slim)?\.js$/);
  lib("Lodash", /lodash/, /lodash(\.min)?\.js$/);
  lib("Underscore.js", /underscore/, /underscore(\.min)?\.js$/);
  lib("Moment.js", /moment/, /moment(\.min)?\.js$/);
  lib("GSAP", /gsap|greensock/, /gsap(\.min)?\.js$/);
  lib("Three.js", /three/, /three(\.min)?\.js$/);
  lib("D3.js", /\/d3(\.min)?\.js|d3js/, /d3(\.min)?\.js$/);
  lib("Chart.js", /chart\.js/, /chart(\.min|\.umd\.min)?\.js$/);
  lib("Axios", /axios/, /axios(\.min)?\.js$/);
  lib("Slick Carousel", /slick/, /slick(\.min)?\.js$/);
  lib("Swiper", /swiper/, /swiper(\.min|\.bundle)?\.js$/);
  lib("Alpine.js", /alpinejs/, /alpine(\.min)?\.js$/);
  lib("Font Awesome", /font-?awesome/, /all(\.min)?\.css$/);
  lib("Bootstrap", /bootstrap/, /bootstrap(\.min)?\.(js|css)$/);
  lib("Tailwind CSS", /tailwind/, /tailwind/);

  // --- frameworks: DOM + URL fingerprints ---
  const dom = (sel) => !!document.querySelector(sel);
  if (has(/react|react-dom/) || dom("[data-reactroot]")) add("React", "Frameworks", has(/react-dom/) || dom("[data-reactroot]") ? "high" : "medium", "React markers in scripts/DOM");
  if (dom("script#__NEXT_DATA__") || has(/\/_next\//)) add("Next.js", "Frameworks", "high", "_next payload or bundle path");
  if (has(/\/_nuxt\//) || dom("#__nuxt")) add("Nuxt.js", "Frameworks", "high", "_nuxt bundle path");
  if (has(/vue(\.global|\.runtime)?(\.min)?\.js/) || dom("[data-v-app]") || has(/\/vue\//)) add("Vue.js", "Frameworks", dom("[data-v-app]") ? "high" : "medium", "Vue markers in scripts/DOM");
  if (has(/angular(\.min)?\.js/) || dom("[ng-version],[ng-app]")) add("Angular", "Frameworks", dom("[ng-version]") ? "high" : "medium", "Angular markers in scripts/DOM");
  if (has(/svelte/) || /svelte/i.test(headHtml)) add("Svelte", "Frameworks", "medium", "Svelte bundle signature");
  if (dom("script#___gatsby") || has(/page-data\.json|\/component---/)) add("Gatsby", "Frameworks", "high", "Gatsby data markers");
  if (has(/ember(\.min)?\.js/)) add("Ember.js", "Frameworks", "medium", "script URL pattern");

  // --- CMS & platforms ---
  if (/wordpress/i.test(gen) || has(/wp-content|wp-includes/)) add("WordPress", "CMS & Platforms", /wordpress/i.test(gen) ? "high" : "medium", "generator meta / wp-content paths");
  if (has(/cdn\.shopify\.com/) || /shopify/i.test(gen)) add("Shopify", "CMS & Platforms", "high", "Shopify CDN / generator");
  if (/wix\.com/i.test(gen)) add("Wix", "CMS & Platforms", "high", "generator: " + gen.slice(0, 60));
  if (has(/squarespace/)) add("Squarespace", "CMS & Platforms", "medium", "Squarespace asset URLs");
  if (/ghost/i.test(gen)) add("Ghost", "CMS & Platforms", "high", "generator: " + gen.slice(0, 60));
  if (has(/drupal/)) add("Drupal", "CMS & Platforms", "medium", "Drupal asset paths");
  if (has(/hs-scripts\.com|js\.hsforms\.net/)) add("HubSpot", "CMS & Platforms", "high", "HubSpot script host");
  if (has(/webflow/)) add("Webflow", "CMS & Platforms", "medium", "Webflow asset URLs");
  if (has(/cdn\.bigcommerce\.com/)) add("BigCommerce", "CMS & Platforms", "high", "BigCommerce CDN");

  // --- analytics & tracking ---
  const ana = (name, re, conf) => { if (has(re)) add(name, "Analytics & Tracking", conf || "high", "tracking script host"); };
  ana("Google Tag Manager", /googletagmanager\.com\/gtm\.js/);
  ana("Google Analytics (gtag.js)", /googletagmanager\.com\/gtag\/js/);
  ana("Google Analytics (analytics.js)", /google-analytics\.com\/analytics\.js/);
  ana("Google Ads", /googleadservices\.com|googlesyndication\.com/);
  ana("Meta Pixel", /connect\.facebook\.net|fbevents\.js/);
  ana("TikTok Pixel", /analytics\.tiktok\.com/);
  ana("LinkedIn Insight Tag", /snap\.licdn\.com/);
  ana("Mixpanel", /cdn\.mxpnl\.com/);
  ana("Segment", /cdn\.segment\.com/);
  ana("Amplitude", /cdn\.amplitude\.com/);
  ana("Hotjar", /static\.hotjar\.com/);
  ana("Intercom", /widget\.intercom\.io/);
  ana("FullStory", /fullstory\.com\/s\/fs\.js/);
  ana("Clarity (Microsoft)", /clarity\.ms/);

  // --- infrastructure ---
  if (has(/cdnjs\.cloudflare\.com/)) add("cdnjs (Cloudflare)", "Infrastructure & CDN", "high", "cdnjs.cloudflare.com");
  if (has(/fonts\.googleapis\.com|fonts\.gstatic\.com/)) add("Google Fonts", "Infrastructure & CDN", "high", "Google Fonts host");
  if (has(/google\.com\/recaptcha/)) add("reCAPTCHA", "Infrastructure & CDN", "high", "reCAPTCHA script");
  if (has(/cdn\.jsdelivr\.net/)) add("jsDelivr CDN", "Infrastructure & CDN", "medium", "cdn.jsdelivr.net");
  if (has(/unpkg\.com/)) add("unpkg CDN", "Infrastructure & CDN", "medium", "unpkg.com");

  // dedupe by name
  const seen = new Set();
  return found.filter((f) => !seen.has(f.name) && (seen.add(f.name), true)).slice(0, 60);
}

const $ = (id) => document.getElementById(id);
const ORDER = ["Frameworks", "JS Libraries", "CMS & Platforms", "Analytics & Tracking", "Infrastructure & CDN"];
const CHIP = { high: "high", medium: "med", low: "low" };

document.addEventListener("DOMContentLoaded", init);

async function init() {
  $("analyze").addEventListener("click", doAnalyze);
  $("copyBtn").addEventListener("click", copyReport);
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab && tab.url) {
    try { $("pageHost").textContent = new URL(tab.url).hostname.replace(/^www\./, ""); } catch (e) {}
  }
}

let lastReport = null;

async function doAnalyze() {
  const btn = $("analyze");
  btn.disabled = true; btn.textContent = "Analyzing…";
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id) throw new Error("no-tab");
    const [res] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: analyzePage });
    lastReport = (res && res.result) || [];
    render(lastReport);
    toast(lastReport.length ? `${lastReport.length} technologies found` : "No known technologies detected");
  } catch (e) {
    toast("Couldn’t analyze this page (try a normal web page)");
  } finally {
    btn.disabled = false; btn.textContent = "Analyze";
  }
}

function render(items) {
  const box = $("groups");
  box.innerHTML = "";
  $("empty").style.display = items.length ? "none" : "";
  $("stats").hidden = items.length === 0;
  $("actions").hidden = items.length === 0;
  if (!items.length) return;

  $("stCount").textContent = items.length;
  $("stHigh").textContent = items.filter((i) => i.confidence === "high").length;
  const cats = ORDER.filter((c) => items.some((i) => i.category === c));
  $("stCats").textContent = cats.length;

  for (const cat of cats) {
    const group = document.createElement("div");
    group.className = "group glass";
    const h = document.createElement("h2");
    h.innerHTML = `<span>${cat}</span><span class="n">${items.filter((i) => i.category === cat).length}</span>`;
    group.appendChild(h);
    for (const t of items.filter((i) => i.category === cat)) {
      const row = document.createElement("div");
      row.className = "tech";
      const nm = document.createElement("div");
      nm.className = "nm";
      const b = document.createElement("b"); b.textContent = t.name;
      const s = document.createElement("span"); s.textContent = t.evidence; s.title = t.evidence;
      nm.append(b, s);
      const chip = document.createElement("span");
      chip.className = "chip " + CHIP[t.confidence];
      chip.textContent = t.confidence;
      row.append(nm, chip);
      group.appendChild(row);
    }
    box.appendChild(group);
  }
}

async function copyReport() {
  if (!lastReport) return;
  const lines = ["# Stack report — " + ($("pageHost").textContent || "page"), ""];
  for (const cat of ORDER) {
    const inCat = lastReport.filter((i) => i.category === cat);
    if (!inCat.length) continue;
    lines.push("## " + cat);
    inCat.forEach((t) => lines.push(`- ${t.name} (${t.confidence} confidence)`));
    lines.push("");
  }
  await navigator.clipboard.writeText(lines.join("\n"));
  toast("Report copied");
}

function toast(msg) {
  const t = document.createElement("div");
  t.className = "toast"; t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2200);
}
