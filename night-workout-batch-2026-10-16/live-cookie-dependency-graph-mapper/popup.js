/* popup.js — Cookie Dependency Graph Mapper
 * Flow: click "Scan this page" -> collect page data via chrome.scripting
 * (DOM only, cookie VALUES never read) -> filter chrome.cookies jar ->
 * render radial SVG graph -> click nodes for details. 100% local.
 */
(function () {
  "use strict";

  const NS = "http://www.w3.org/2000/svg";
  const scanBtn = document.getElementById("scan-btn");
  const pageHostEl = document.getElementById("page-host");
  const graphSvg = document.getElementById("graph");
  const graphWrap = document.getElementById("graph-wrap");
  const statsEl = document.getElementById("stats");
  const detailEl = document.getElementById("detail");
  const scriptsCard = document.getElementById("scripts-card");
  const scriptListEl = document.getElementById("script-list");

  /** Runs in the tab's isolated world. Returns page data (no cookie values). */
  function collectPageData() {
    const hosts = new Set();
    const add = (url) => {
      try {
        const u = new URL(url, location.href);
        if (u.protocol.startsWith("http")) hosts.add(u.hostname.toLowerCase());
      } catch (e) { /* skip */ }
    };
    document.querySelectorAll("script[src], iframe[src], img[src], link[href]").forEach((el) => {
      add(el.src || el.href);
    });
    let jsCookieNames = [];
    try {
      jsCookieNames = document.cookie.split(";").map((p) => p.split("=")[0].trim()).filter(Boolean);
    } catch (e) { /* noop */ }
    return {
      pageHost: location.hostname.toLowerCase(),
      jsCookieNames,
      resourceHosts: [...hosts].slice(0, 120)
    };
  }

  function el(tag, attrs, text) {
    const n = document.createElementNS(NS, tag);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    if (text != null) n.textContent = text;
    return n;
  }

  function clearSvg() {
    while (graphSvg.firstChild) graphSvg.removeChild(graphSvg.firstChild);
  }

  function showEmpty(msg) {
    clearSvg();
    graphWrap.innerHTML = '<div class="empty">' + msg + "</div>";
    graphWrap.appendChild(graphSvg); // keep svg node alive for later scans
  }

  function renderStats(cookies) {
    const first = cookies.filter((c) => c.party === "first").length;
    const third = cookies.filter((c) => c.party === "third").length;
    const httpOnly = cookies.filter((c) => c.httpOnly).length;
    statsEl.classList.remove("hidden");
    statsEl.innerHTML = "";
    const tiles = [
      [cookies.length, "cookies"],
      [third, "third-party"],
      [httpOnly, "httpOnly"]
    ];
    for (const [num, label] of tiles) {
      const d = document.createElement("div");
      d.className = "stat";
      const b = document.createElement("b");
      b.textContent = num;
      if (label === "third-party" && num > 0) b.style.color = "#f87171";
      const s = document.createElement("span");
      s.textContent = label;
      d.appendChild(b); d.appendChild(s);
      statsEl.appendChild(d);
    }
  }

  function renderGraph(pageHost, layout) {
    clearSvg();
    const nodeById = {};
    for (const l of layout.links) {
      const a = layout.nodes.find((n) => n.id === l.from);
      const b = layout.nodes.find((n) => n.id === l.to);
      if (a && b) graphSvg.appendChild(el("line", { x1: a.x, y1: a.y, x2: b.x, y2: b.y, class: "link" }));
    }
    for (const n of layout.nodes) {
      nodeById[n.id] = n;
      const g = el("g", { class: "node", "data-id": n.id });
      let r = 5, fill = "#9a9aa5";
      if (n.type === "page")      { r = 11; fill = "#a78bfa"; }
      else if (n.type === "domain"){ r = 8;  fill = n.party === "third" ? "#f87171" : "#34d399"; }
      else if (n.type === "cookie"){ r = 5;  fill = n.cookie.httpOnly ? "#fbbf24" : (n.cookie.party === "third" ? "#f87171" : "#34d399"); }
      else                        { r = 6;  fill = "#9a9aa5"; }
      g.appendChild(el("circle", { cx: n.x, cy: n.y, r, fill, stroke: "rgba(255,255,255,0.35)", "stroke-width": 1 }));
      const short = n.label.length > 16 ? n.label.slice(0, 15) + "…" : n.label;
      const t = el("text", { x: n.x, y: n.y + r + 10 }, short);
      g.appendChild(t);
      if (n.type === "cookie" || n.type === "domain") {
        g.addEventListener("click", () => showDetail(n));
      }
      graphSvg.appendChild(g);
    }
  }

  function kv(k, v) {
    return '<div class="kv"><span class="k">' + k + '</span><span class="v">' + v + "</span></div>";
  }

  function esc(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function showDetail(n) {
    detailEl.classList.remove("hidden");
    if (n.type === "cookie") {
      const c = n.cookie;
      const exp = c.session ? "Session (deleted on browser close)"
        : c.expiration ? new Date(c.expiration * 1000).toLocaleString() : "Unknown";
      detailEl.innerHTML =
        '<span class="pill ' + c.party + '">' + (c.party === "third" ? "Third-party" : "First-party") + "</span>" +
        "<h2>" + esc(c.name) + "</h2>" +
        kv("Domain", esc(c.domain)) +
        kv("Path", esc(c.path)) +
        kv("httpOnly", c.httpOnly ? "Yes — hidden from JavaScript" : "No — readable by page JS") +
        kv("Secure", c.secure ? "Yes" : "No") +
        kv("SameSite", esc(c.sameSite)) +
        kv("Expires", esc(exp)) +
        kv("JS-readable now", c.jsReadable ? "Yes" : "No");
    } else if (n.type === "domain") {
      detailEl.innerHTML =
        '<span class="pill ' + n.party + '">' + (n.party === "third" ? "Third-party domain" : "First-party domain") + "</span>" +
        "<h2>" + esc(n.label) + "</h2>" +
        kv("Cookies shown", n.count) +
        '<p style="color:var(--muted);font-size:11.5px;margin-top:6px;line-height:1.5">' +
        "Which script set each cookie can't be determined reliably by an extension — " +
        "scripts present on the page are listed below for context.</p>";
    }
  }

  function renderScripts(hosts) {
    if (!hosts || !hosts.length) { scriptsCard.classList.add("hidden"); return; }
    scriptsCard.classList.remove("hidden");
    scriptListEl.innerHTML = "";
    for (const h of hosts.slice(0, 40)) {
      const chip = document.createElement("span");
      chip.className = "chip";
      chip.textContent = h;
      chip.title = h;
      scriptListEl.appendChild(chip);
    }
  }

  async function scan() {
    scanBtn.disabled = true;
    scanBtn.textContent = "Scanning…";
    detailEl.classList.add("hidden");
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab || !tab.id || !/^https?:/.test(tab.url || "")) {
        showEmpty("Open a regular http(s) page first —<br>browser pages can't be scanned.");
        return;
      }
      pageHostEl.textContent = new URL(tab.url).hostname;

      const injected = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: collectPageData
      });
      const page = injected[0].result;

      const all = await chrome.cookies.getAll({});
      const cookies = relevantCookies(all, page.pageHost, page.resourceHosts, page.jsCookieNames);
      const groups = groupByDomain(cookies);
      const layout = layoutGraph(page.pageHost, groups);

      renderStats(cookies);
      renderGraph(page.pageHost, layout);
      renderScripts(page.resourceHosts);

      try {
        await chrome.storage.local.set({ cdgm_last: { pageHost: page.pageHost, at: Date.now() } });
      } catch (e) { /* noop */ }

      if (!cookies.length) {
        showEmpty("No cookies found for this page.<br>It may use none, or they may be partitioned.");
      }
    } catch (err) {
      showEmpty("Scan failed: " + esc(err && err.message ? err.message : err));
    } finally {
      scanBtn.disabled = false;
      scanBtn.textContent = "Scan this page";
    }
  }

  scanBtn.addEventListener("click", scan);

  // Restore last-scanned host label for context.
  try {
    chrome.storage.local.get(["cdgm_last"], (res) => {
      if (res && res.cdgm_last && res.cdgm_last.pageHost) {
        pageHostEl.textContent = "Last scanned: " + res.cdgm_last.pageHost;
      }
    });
  } catch (e) { /* noop */ }
})();
