/* PhishGuard — local URL phishing-signal heuristics.
   Everything runs in this popup. No URL or data is ever sent anywhere
   by the extension; VirusTotal opens only when the user clicks. */
"use strict";

/* ---------- Config ---------- */

// TLDs disproportionately abused for phishing (heuristic hint, not proof)
const SUSPICIOUS_TLDS = new Set([
  "tk", "ml", "ga", "cf", "gq", "top", "xyz", "buzz", "click", "country",
  "stream", "download", "link", "work", "party", "review", "date", "loan",
  "racing", "win", "bid", "cricket", "men", "science", "webcam", "zip",
  "mov", "rest", "bar", "ooo", "icu"
]);

// Well-known brands frequently impersonated. If the hostname mentions one
// but is not that brand's real domain, that is a strong spoof signal.
const BRANDS = {
  "google":   ["google.com", "google.co"],
  "apple":    ["apple.com"],
  "microsoft":["microsoft.com", "live.com", "office.com", "outlook.com"],
  "amazon":   ["amazon.com", "amazon.co"],
  "paypal":   ["paypal.com"],
  "facebook": ["facebook.com", "fb.com"],
  "instagram":["instagram.com"],
  "netflix":  ["netflix.com"],
  "whatsapp": ["whatsapp.com"],
  "linkedin": ["linkedin.com"],
  "twitter":  ["twitter.com", "x.com"],
  "ebay":     ["ebay.com"],
  "bank":     []
};

const CONFUSABLES = /[а-яё]|[\u0430-\u044f]|[\u03b1-\u03c9]|[\u4e00-\u9fff]/i;

/* ---------- Analysis ---------- */

function getSignals(url) {
  const signals = [];
  const add = (severity, title, desc, points) =>
    signals.push({ severity, title, desc, points });

  let u;
  try {
    u = new URL(url);
  } catch {
    return { signals, score: 0, host: "" };
  }
  const host = u.hostname.toLowerCase();
  const full = url;

  // 1. Not HTTPS
  if (u.protocol !== "https:") {
    add("med", "Not using HTTPS",
      `This page loads over "${u.protocol.replace(":", "") || "unknown"}" — logins here are exposed.`, 15);
  }

  // 2. IP-literal host
  const isIPv4 = /^\d{1,3}(\.\d{1,3}){3}$/.test(host);
  const isIPv6 = host.includes(":");
  if (isIPv4 || isIPv6) {
    add("high", "IP address instead of a domain name",
      "Legitimate sites almost always use a domain name. Phishing pages often hide behind raw IPs.", 25);
  }

  // 3. Punycode / non-ASCII lookalikes
  if (host.includes("xn--") || CONFUSABLES.test(host)) {
    add("high", "Suspicious characters in domain (punycode/lookalikes)",
      "The domain uses encoded or foreign characters that can visually mimic a trusted brand.", 25);
  }

  // 4. Excessive subdomains
  const labels = host.split(".").filter(Boolean);
  if (!isIPv4 && !isIPv6 && labels.length > 4) {
    add("med", `Too many subdomains (${labels.length} levels)`,
      "Phishers stack subdomains to bury the real domain, e.g. secure.login.<brand>.evil.com.", 15);
  }

  // 5. Brand name inside a non-brand domain
  const brandHit = Object.keys(BRANDS).find(b => host.includes(b));
  if (brandHit) {
    const real = BRANDS[brandHit].some(d => host === d || host.endsWith("." + d));
    if (!real && !isIPv4) {
      add("high", `Mentions "${brandHit}" but isn't ${brandHit}'s site`,
        `The name appears in the URL, but the actual domain is "${host}". A classic impersonation trick.`, 30);
    }
  }

  // 6. Suspicious TLD
  const tld = labels[labels.length - 1] || "";
  if (SUSPICIOUS_TLDS.has(tld)) {
    add("med", `High-risk TLD (.${tld})`,
      "This top-level domain is disproportionately used in phishing campaigns.", 12);
  }

  // 7. Very long URL
  if (full.length > 100) {
    add("low", `Unusually long URL (${full.length} chars)`,
      "Long URLs can hide the real destination or carry injected payloads.", 8);
  }

  // 8. @ in the URL (credential-style trick)
  if (u.username || u.password || full.includes("@")) {
    add("med", '"@" trick in URL',
      "Everything before @ is ignored by browsers — attackers use it to fake a trusted prefix.", 15);
  }

  // 9. Hyphen-stuffed domain
  const registrable = labels.slice(-2).join(".");
  const hyphens = (registrable.match(/-/g) || []).length;
  if (hyphens >= 3) {
    add("low", "Hyphen-stuffed domain",
      `The domain contains ${hyphens} hyphens — often used to glue brand names onto lookalike domains.`, 8);
  }

  const score = Math.min(100, signals.reduce((s, x) => s + x.points, 0));
  return { signals, score, host };
}

function verdictFor(score) {
  if (score >= 50) return {
    title: "High risk", sub: "Multiple phishing signals. Do not enter credentials or download anything here.",
    color: "#ef4444"
  };
  if (score >= 20) return {
    title: "Suspicious", sub: "Some warning signs. Double-check this site before trusting it.",
    color: "#fbbf24"
  };
  if (score > 0) return {
    title: "Mostly clean", sub: "Minor quirks only. Still, never share passwords you didn't expect to.",
    color: "#34d399"
  };
  return {
    title: "Looks clean", sub: "No suspicious signals detected. Stay alert anyway.",
    color: "#34d399"
  };
}

/* ---------- Rendering ---------- */

const $ = id => document.getElementById(id);

function render(url) {
  $("urlValue").textContent = url || "(no page URL)";
  const { signals, score, host } = getSignals(url);
  const v = verdictFor(score);

  // Ring
  const circ = 188.5;
  const fg = $("ringFg");
  fg.style.stroke = v.color;
  fg.style.strokeDashoffset = String(circ - (circ * score) / 100);
  $("scoreNum").textContent = score;
  $("verdictTitle").textContent = v.title;
  $("verdictTitle").style.color = v.color;
  $("verdictSub").textContent = v.sub;

  // Signals
  const list = $("signalList");
  list.innerHTML = "";
  $("signalCount").textContent = signals.length;
  $("emptyState").style.display = signals.length ? "none" : "block";

  for (const s of signals) {
    const li = document.createElement("li");
    li.className = `signal ${s.severity}`;
    li.innerHTML =
      `<span class="dot"></span>` +
      `<div><div class="s-title"></div><div class="s-desc"></div></div>` +
      `<span class="s-pts">+${s.points}</span>`;
    li.querySelector(".s-title").textContent = s.title;
    li.querySelector(".s-desc").textContent = s.desc;
    list.appendChild(li);
  }

  // VirusTotal (user click only)
  $("vtBtn").onclick = () => {
    if (host) chrome.tabs.create({
      url: "https://www.virustotal.com/gui/domain/" + encodeURIComponent(host)
    });
  };
}

/* ---------- Boot ---------- */

$("recheckBtn").addEventListener("click", boot);

function boot() {
  chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
    const t = tabs && tabs[0];
    render(t ? t.url : "");
  });
}

boot();
