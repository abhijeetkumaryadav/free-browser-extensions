/*
  graph.js - DOM-free helpers for the Cookie Dependency Graph Mapper.
  Pure functions only, so layout/grouping logic can be unit-tested in Node.
*/

const MAX_DOMAINS = 10;   // domains drawn; the rest collapse into "other"
const MAX_COOKIES = 48;   // cookie nodes drawn; the rest are counted
const MAX_PER_DOMAIN = 8; // cookie nodes per domain before "+n more"

/** Strip leading dot, lowercase. */
function normalizeDomain(d) {
  return String(d || "").replace(/^\./, "").toLowerCase();
}

/**
 * Would this cookie be sent with requests to pageHost?
 * (cookie domain is pageHost or a parent domain of it)
 */
function cookieAppliesToHost(cookieDomain, pageHost) {
  const cd = normalizeDomain(cookieDomain);
  const ph = String(pageHost || "").toLowerCase();
  return ph === cd || ph.endsWith("." + cd);
}

/** First-party if the cookie's domain is within the page's own domain tree. */
function isFirstParty(cookieDomain, pageHost) {
  return cookieAppliesToHost(cookieDomain, pageHost);
}

/**
 * Filter the browser's full cookie jar down to cookies relevant to the page:
 *  - cookies that apply to the page host (first-party context), or
 *  - cookies whose domain appears among the page's subresource hosts
 *    (third-party cookies actually present on this page).
 * Enriches each with: domain (normalized), party, jsReadable.
 */
function relevantCookies(allCookies, pageHost, resourceHosts, jsCookieNames) {
  const hosts = new Set((resourceHosts || []).map(normalizeDomain));
  const jsNames = new Set(jsCookieNames || []);
  const out = [];
  for (const c of allCookies || []) {
    const dom = normalizeDomain(c.domain);
    const applies = cookieAppliesToHost(c.domain, pageHost);
    const presentThirdParty = hosts.has(dom) && !applies;
    if (!applies && !presentThirdParty) continue;
    out.push({
      name: c.name,
      domain: dom,
      rawDomain: c.domain,
      path: c.path,
      secure: !!c.secure,
      httpOnly: !!c.httpOnly,
      sameSite: c.sameSite || "unspecified",
      session: !!c.session,
      expiration: c.expirationDate || null,
      storeId: c.storeId,
      hostOnly: !!c.hostOnly,
      party: isFirstParty(c.domain, pageHost) ? "first" : "third",
      jsReadable: jsNames.has(c.name) && !c.httpOnly
    });
  }
  // deterministic order: third-party first (more interesting), then by domain, then name
  out.sort((a, b) =>
    (a.party === b.party ? 0 : a.party === "third" ? -1 : 1) ||
    a.domain.localeCompare(b.domain) ||
    a.name.localeCompare(b.name)
  );
  return out.slice(0, MAX_COOKIES * 2); // hard cap before grouping
}

/** Group cookies by domain, cap domains, collapse the tail into "other". */
function groupByDomain(cookies) {
  const map = new Map();
  for (const c of cookies) {
    if (!map.has(c.domain)) map.set(c.domain, []);
    map.get(c.domain).push(c);
  }
  const groups = [...map.entries()].map(([domain, items]) => ({ domain, items }));
  groups.sort((a, b) => b.items.length - a.items.length);
  const shown = groups.slice(0, MAX_DOMAINS);
  const hidden = groups.slice(MAX_DOMAINS);
  const hiddenCount = hidden.reduce((n, g) => n + g.items.length, 0);
  return { shown, hiddenCount, totalCookies: cookies.length };
}

/**
 * Radial layout: page node center, domains on inner ring, cookies fanned
 * around their domain on the outer ring.
 * Returns { nodes, links }. Coordinates fit a 340x300 viewBox.
 */
function layoutGraph(pageHost, groups) {
  const CX = 170, CY = 150, R_DOMAIN = 62, R_COOKIE = 128;
  const nodes = [{ id: "page", type: "page", label: pageHost, x: CX, y: CY }];
  const links = [];
  const n = groups.shown.length;
  groups.shown.forEach((g, i) => {
    const ang = (i / Math.max(n, 1)) * Math.PI * 2 - Math.PI / 2;
    const dx = CX + R_DOMAIN * Math.cos(ang);
    const dy = CY + R_DOMAIN * Math.sin(ang);
    const did = "d:" + g.domain;
    nodes.push({ id: did, type: "domain", label: g.domain, x: dx, y: dy,
                 party: g.items[0].party, count: g.items.length });
    links.push({ from: "page", to: did });

    const shown = g.items.slice(0, MAX_PER_DOMAIN);
    const extra = g.items.length - shown.length;
    const spread = Math.min(0.9, 0.28 * shown.length); // radians of fan
    shown.forEach((c, j) => {
      const off = shown.length === 1 ? 0 : (j / (shown.length - 1) - 0.5) * spread;
      const a = ang + off;
      const cid = "c:" + g.domain + "/" + c.name;
      nodes.push({ id: cid, type: "cookie", label: c.name, x: CX + R_COOKIE * Math.cos(a),
                   y: CY + R_COOKIE * Math.sin(a), cookie: c, domain: g.domain });
      links.push({ from: did, to: cid });
    });
    if (extra > 0) {
      const a = ang + spread / 2 + 0.12;
      nodes.push({ id: did + ":more", type: "more", label: "+" + extra + " more",
                   x: CX + R_COOKIE * Math.cos(a), y: CY + R_COOKIE * Math.sin(a) });
      links.push({ from: did, to: did + ":more" });
    }
  });
  if (groups.hiddenCount > 0) {
    nodes.push({ id: "d:other", type: "more",
                 label: "+" + groups.hiddenCount + " on other domains",
                 x: CX, y: CY + R_COOKIE + 8 });
    links.push({ from: "page", to: "d:other" });
  }
  return { nodes, links };
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { normalizeDomain, cookieAppliesToHost, isFirstParty,
                     relevantCookies, groupByDomain, layoutGraph };
}
