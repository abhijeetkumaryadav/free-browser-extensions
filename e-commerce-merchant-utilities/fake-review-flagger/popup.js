/* Fake Review Flagger — popup logic.
   The page scan runs inside the active tab via chrome.scripting, so the
   injected scanner must be fully self-contained (no closures). Raw review
   data comes back, and all scoring happens here. */

"use strict";

/* ------------------------------------------------------------------ */
/* Tuning constants                                                    */
/* ------------------------------------------------------------------ */
const HISTORY_KEY = "frf_history";
const HISTORY_LIMIT = 5;
const MAX_CANDIDATES = 200;
const MIN_REVIEWS_FOR_VERDICT = 3;

const SEVERITY = {
  RATING_SKEW: "high",
  INCENTIVIZED: "high",
  DATE_SPIKE: "medium",
  UNVERIFIED: "medium",
  DUPLICATES: "medium",
  SHORT_REVIEWS: "low",
  GENERIC_AUTHORS: "low",
};

const DEDUCTIONS = { high: 18, medium: 10, low: 5 };

const INCENTIVIZED_RE = /in exchange for|free product|honest review|was provided to me|received this (item|product)|compensation|discount in exchange|in return for (my|an? honest)|sample (provided|sent)|promotional (review|product)/i;
const GENERIC_AUTHOR_RE = /^(amazon customer|kindle customer|vine voice|[a-z]\.?|[a-z]\s[a-z]\.?)$/i;
const DATE_RE = /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{2,4}/i;
const RATING_RE = /(\d(?:\.\d)?)\s*(?:out of|\/)\s*5/;

/* ------------------------------------------------------------------ */
/* Injected scanner — must not reference anything outside itself       */
/* ------------------------------------------------------------------ */
function scanPage() {
  var candidates = [];
  var seen = {};
  var nodes = document.querySelectorAll(
    '[class*="review" i], [id*="review" i], [data-hook*="review" i], [itemprop="review"]'
  );
  for (var i = 0; i < nodes.length && candidates.length < 200; i++) {
    var el = nodes[i];
    var text = (el.innerText || "").trim();
    if (text.length < 40 || text.length > 6000) continue;
    // Prefer the outermost container: skip if an ancestor is also a candidate.
    var dup = false;
    for (var j = 0; j < candidates.length; j++) {
      if (candidates[j].el.contains(el)) { dup = true; break; }
      if (el.contains(candidates[j].el)) { candidates.splice(j, 1); j--; }
    }
    if (dup) continue;
    var key = text.slice(0, 120);
    if (seen[key]) continue;
    seen[key] = true;
    candidates.push({ el: el, text: text });
  }

  var ratings = [];
  var verifiedCount = 0;
  var incentivizedCount = 0;
  var genericAuthorCount = 0;
  var bodyLengths = [];
  var titles = [];
  var dateCounts = {};

  function findRating(el) {
    var labeled = el.querySelectorAll("[aria-label]");
    for (var i = 0; i < labeled.length; i++) {
      var m = /(\d(?:\.\d)?)\s*(?:out of|\/)\s*5/.exec(labeled[i].getAttribute("aria-label") || "");
      if (m) return parseFloat(m[1]);
    }
    var m2 = /(\d(?:\.\d)?)\s*(?:out of|\/)\s*5/i.exec((el.innerText || "").slice(0, 300));
    return m2 ? parseFloat(m2[1]) : null;
  }

  candidates.forEach(function (c) {
    var r = findRating(c.el);
    if (r !== null) ratings.push(r);
    if (/verified purchase/i.test(c.text)) verifiedCount++;
    if (/in exchange for|free product|honest review|was provided to me|received this (item|product)|compensation|discount in exchange|in return for (my|an? honest)|sample (provided|sent)|promotional (review|product)/i.test(c.text)) incentivizedCount++;
    bodyLengths.push(c.text.length);

    var titleEl = c.el.querySelector('[data-hook="review-title"], [class*="review-title" i]');
    var title = titleEl ? (titleEl.innerText || "").trim() : (c.text.split("\n")[0] || "").trim();
    if (title && title.length > 3 && title.length < 140) titles.push(title.toLowerCase());

    var dateM = /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{2,4}/i.exec(c.text);
    if (dateM) {
      var d = dateM[0].replace(/,/g, "").toLowerCase();
      dateCounts[d] = (dateCounts[d] || 0) + 1;
    }

    var authorEl = c.el.querySelector('[class*="author" i], [class*="customer" i], [class*="reviewer" i]');
    if (authorEl) {
      var author = (authorEl.innerText || "").trim();
      if (/^(amazon customer|kindle customer|vine voice|[a-z]\.?|[a-z]\s[a-z]\.?)$/i.test(author)) genericAuthorCount++;
    }
  });

  // Rating histogram shown on the page, e.g. "82% of reviews have 5 stars".
  var histogram = {};
  var bodyText = document.body ? document.body.innerText || "" : "";
  var histRe = /(\d{1,3})\s*%\s*(?:of reviews have|with|of ratings are)\s*([1-5])\s*stars?/gi;
  var hm;
  while ((hm = histRe.exec(bodyText)) !== null) {
    histogram[hm[2]] = Math.min(100, parseInt(hm[1], 10));
  }

  return {
    reviewCount: candidates.length,
    ratings: ratings,
    verifiedCount: verifiedCount,
    incentivizedCount: incentivizedCount,
    genericAuthorCount: genericAuthorCount,
    bodyLengths: bodyLengths,
    titles: titles,
    dateCounts: dateCounts,
    histogram: histogram,
    host: window.location.hostname,
  };
}

/* ------------------------------------------------------------------ */
/* Scoring                                                             */
/* ------------------------------------------------------------------ */
function computeFlags(data) {
  var flags = [];
  var n = data.reviewCount;

  // 1. Five-star skew (page histogram preferred, else extracted ratings).
  var fiveShare = null;
  if (data.histogram["5"] !== undefined) {
    fiveShare = data.histogram["5"] / 100;
  } else if (data.ratings.length >= 5) {
    fiveShare = data.ratings.filter(function (r) { return r >= 4.5; }).length / data.ratings.length;
  }
  if (fiveShare !== null && fiveShare >= 0.8 && (data.ratings.length >= 5 || data.histogram["5"] !== undefined)) {
    flags.push({
      severity: SEVERITY.RATING_SKEW,
      title: "Heavy 5-star skew",
      detail: Math.round(fiveShare * 100) + "% of ratings are 5 stars — real products rarely skew this hard.",
    });
  }

  // 2. Incentivized language.
  if (data.incentivizedCount >= 2) {
    flags.push({
      severity: SEVERITY.INCENTIVIZED,
      title: "Incentivized-review language",
      detail: data.incentivizedCount + " reviews use phrases like “in exchange for” or “free product”.",
    });
  } else if (data.incentivizedCount === 1) {
    flags.push({
      severity: "low",
      title: "Possible incentivized review",
      detail: "1 review mentions receiving the product for free or at a discount.",
    });
  }

  // 3. Review-velocity spike (many reviews on one date).
  var dateVals = Object.values(data.dateCounts);
  var datedTotal = dateVals.reduce(function (a, b) { return a + b; }, 0);
  var maxDate = dateVals.length ? Math.max.apply(null, dateVals) : 0;
  if (datedTotal >= 5 && maxDate / datedTotal >= 0.4) {
    flags.push({
      severity: SEVERITY.DATE_SPIKE,
      title: "Review-velocity spike",
      detail: maxDate + " of " + datedTotal + " dated reviews landed on a single day — typical of paid bursts.",
    });
  }

  // 4. Unverified purchase ratio.
  if (n >= 5 && data.verifiedCount / n < 0.5) {
    flags.push({
      severity: SEVERITY.UNVERIFIED,
      title: "Mostly unverified reviews",
      detail: "Only " + data.verifiedCount + " of " + n + " sampled reviews are marked verified purchase.",
    });
  }

  // 5. Duplicate titles (template reviews).
  var titleCounts = {};
  data.titles.forEach(function (t) { titleCounts[t] = (titleCounts[t] || 0) + 1; });
  var dupTitles = Object.keys(titleCounts).filter(function (t) { return titleCounts[t] >= 3; });
  if (dupTitles.length) {
    flags.push({
      severity: SEVERITY.DUPLICATES,
      title: "Repeated review titles",
      detail: dupTitles.length + " title(s) appear 3+ times — a sign of templated fake reviews.",
    });
  }

  // 6. Suspiciously short reviews.
  if (data.bodyLengths.length >= 10) {
    var avg = data.bodyLengths.reduce(function (a, b) { return a + b; }, 0) / data.bodyLengths.length;
    if (avg < 120) {
      flags.push({
        severity: SEVERITY.SHORT_REVIEWS,
        title: "Unusually short reviews",
        detail: "Average review body is only " + Math.round(avg) + " characters — thin for genuine feedback.",
      });
    }
  }

  // 7. Generic reviewer names.
  if (data.genericAuthorCount >= 3) {
    flags.push({
      severity: SEVERITY.GENERIC_AUTHORS,
      title: "Generic reviewer names",
      detail: data.genericAuthorCount + " reviews come from placeholder-style names (e.g. “Amazon Customer”).",
    });
  }

  return flags;
}

function scoreFromFlags(flags) {
  var score = 100;
  flags.forEach(function (f) { score -= DEDUCTIONS[f.severity] || 0; });
  return Math.max(0, Math.min(100, score));
}

function verdictFor(score) {
  if (score >= 75) return { key: "trusted", label: "Likely trustworthy" };
  if (score >= 45) return { key: "caution", label: "Some red flags" };
  return { key: "suspicious", label: "Looks suspicious" };
}

/* ------------------------------------------------------------------ */
/* Rendering                                                           */
/* ------------------------------------------------------------------ */
function el(tag, cls, text) {
  var node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
}

function renderResult(data, flags, score, verdict) {
  var verdictCard = document.getElementById("verdictCard");
  var emptyState = document.getElementById("emptyState");
  verdictCard.classList.remove("hidden");
  emptyState.classList.add("hidden");

  document.getElementById("scoreNum").textContent = score;
  var ring = document.getElementById("scoreRing");
  ring.style.borderColor = verdict.key === "trusted" ? "#7ee2a8"
    : verdict.key === "caution" ? "#ffb020" : "#ff5a36";

  var label = document.getElementById("verdictLabel");
  label.textContent = verdict.label;
  label.className = "verdict-label " + verdict.key;
  document.getElementById("verdictHost").textContent =
    data.host + " · " + data.reviewCount + " review samples";

  var list = document.getElementById("flagList");
  list.innerHTML = "";
  if (!flags.length && data.reviewCount >= MIN_REVIEWS_FOR_VERDICT) {
    var ok = el("li", "flag ok");
    ok.appendChild(el("span", "dot"));
    var wrap = el("div");
    wrap.appendChild(el("p", "flag-title", "No red flags found"));
    wrap.appendChild(el("p", "flag-detail", "This page's review patterns look natural."));
    ok.appendChild(wrap);
    list.appendChild(ok);
  }
  flags.forEach(function (f) {
    var li = el("li", "flag " + f.severity);
    li.appendChild(el("span", "dot"));
    var wrap = el("div");
    wrap.appendChild(el("p", "flag-title", f.title));
    wrap.appendChild(el("p", "flag-detail", f.detail));
    li.appendChild(wrap);
    list.appendChild(li);
  });
}

function renderHistory(entries) {
  var list = document.getElementById("historyList");
  var empty = document.getElementById("historyEmpty");
  list.innerHTML = "";
  if (!entries.length) { empty.style.display = ""; return; }
  empty.style.display = "none";
  entries.forEach(function (e) {
    var li = el("li");
    var host = el("span", "host", e.host);
    host.title = e.host;
    var score = el("span", "score " + e.verdict, String(e.score));
    li.appendChild(host);
    li.appendChild(score);
    list.appendChild(li);
  });
}

/* ------------------------------------------------------------------ */
/* Storage                                                             */
/* ------------------------------------------------------------------ */
function loadHistory() {
  return chrome.storage.local.get(HISTORY_KEY).then(function (res) {
    return Array.isArray(res[HISTORY_KEY]) ? res[HISTORY_KEY] : [];
  });
}

function saveHistoryEntry(entry) {
  return loadHistory().then(function (entries) {
    entries.unshift(entry);
    entries = entries.slice(0, HISTORY_LIMIT);
    return chrome.storage.local.set({ [HISTORY_KEY]: entries }).then(function () {
      return entries;
    });
  });
}

/* ------------------------------------------------------------------ */
/* Wiring                                                              */
/* ------------------------------------------------------------------ */
function scanCurrentTab() {
  var btn = document.getElementById("scanBtn");
  btn.disabled = true;
  chrome.tabs.query({ active: true, currentWindow: true })
    .then(function (tabs) {
      var tab = tabs[0];
      if (!tab || !tab.id || !/^https?:/.test(tab.url || "")) {
        throw new Error("Open a regular web page first (chrome:// and store pages can't be scanned).");
      }
      return chrome.scripting.executeScript({ target: { tabId: tab.id }, func: scanPage });
    })
    .then(function (results) {
      var data = results && results[0] && results[0].result;
      if (!data || data.reviewCount < MIN_REVIEWS_FOR_VERDICT) {
        document.getElementById("verdictCard").classList.add("hidden");
        document.getElementById("emptyState").classList.remove("hidden");
        document.querySelector("#emptyState p").innerHTML =
          "No product reviews detected on this page. Try a page with visible customer reviews.";
        return;
      }
      var flags = computeFlags(data);
      var score = scoreFromFlags(flags);
      var verdict = verdictFor(score);
      renderResult(data, flags, score, verdict);
      return saveHistoryEntry({
        host: data.host,
        score: score,
        verdict: verdict.key,
        at: Date.now(),
      }).then(renderHistory);
    })
    .catch(function (err) {
      document.getElementById("emptyState").classList.remove("hidden");
      document.querySelector("#emptyState p").textContent =
        "Scan failed: " + (err && err.message ? err.message : "unknown error");
    })
    .finally(function () { btn.disabled = false; });
}

document.addEventListener("DOMContentLoaded", function () {
  document.getElementById("scanBtn").addEventListener("click", scanCurrentTab);
  loadHistory().then(renderHistory);
});
