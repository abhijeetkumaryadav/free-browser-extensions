/* H1 Sleuth — popup logic.
 * Audits h1 usage on the current page: duplicates, missing, empty, hidden. */
(function () {
  "use strict";

  var els = {
    scan: document.getElementById("scan"),
    empty: document.getElementById("empty"),
    results: document.getElementById("results"),
    score: document.getElementById("scoreVal"),
    verdict: document.getElementById("verdict"),
    stats: document.getElementById("statsLine"),
    count: document.getElementById("stCount"),
    emptyN: document.getElementById("stEmpty"),
    hidden: document.getElementById("stHidden"),
    issuesN: document.getElementById("stIssues"),
    issues: document.getElementById("issues"),
    outline: document.getElementById("outline")
  };

  function analyze(data) {
    var h1s = data.h1s;
    var issues = [];

    var empty = h1s.filter(function (h) { return !h.text; });
    var hidden = h1s.filter(function (h) { return h.text && !h.visible; });

    if (h1s.length === 0) {
      issues.push({ sev: "error", title: "Missing h1",
        body: "This page has no h1 tag. Every page should have exactly one clear h1 that summarizes its topic — it matters for both SEO and screen readers.",
        loc: null });
    } else if (h1s.length > 1) {
      issues.push({ sev: "error", title: h1s.length + " h1 tags found",
        body: "Best practice is exactly one h1 per page. Multiple h1s dilute the page's topical focus and confuse assistive technology. Keep the main one and demote the rest to h2.",
        loc: null });
    }

    empty.forEach(function (h) {
      issues.push({ sev: "warn", title: "Empty h1",
        body: "An h1 with no text contributes nothing and can confuse screen readers. Add descriptive text or remove it.",
        loc: h.path });
    });

    hidden.forEach(function (h) {
      issues.push({ sev: "warn", title: "Hidden h1: “" + (h.text.length > 40 ? h.text.slice(0, 40) + "…" : h.text) + "”",
        body: "This h1 is not visible (display:none, hidden, or zero-size). Search engines may ignore hidden headings; keep visible headings for real content.",
        loc: h.path });
    });

    var dupes = {};
    h1s.forEach(function (h) {
      if (h.text) dupes[h.text.toLowerCase()] = (dupes[h.text.toLowerCase()] || 0) + 1;
    });
    Object.keys(dupes).forEach(function (t) {
      if (dupes[t] > 1) {
        issues.push({ sev: "warn", title: "Identical h1 text repeated " + dupes[t] + "×",
          body: "“" + t.slice(0, 60) + "” appears multiple times. Identical headings are usually a template bug — make each heading unique.",
          loc: null });
      }
    });

    var score = 100;
    score -= Math.min(60, issues.filter(function (i) { return i.sev === "error"; }).length * 40);
    score -= Math.min(40, issues.filter(function (i) { return i.sev === "warn"; }).length * 10);
    score = Math.max(0, score);

    return { issues: issues, empty: empty.length, hidden: hidden.length, score: score };
  }

  function verdictFor(score, n) {
    if (n === 1 && score === 100) return "Perfect — one h1";
    if (score >= 80) return "Mostly healthy";
    if (score >= 50) return "Needs attention";
    return "Fix recommended";
  }

  function esc(s) {
    var d = document.createElement("div");
    d.textContent = s;
    return d.innerHTML;
  }

  function render(report) {
    els.empty.hidden = true;
    els.results.hidden = false;
    var a = report.analysis, d = report.data;
    els.score.textContent = a.score;
    els.verdict.textContent = verdictFor(a.score, d.h1s.length);
    els.stats.textContent = d.url.length > 44 ? d.url.slice(0, 44) + "…" : d.url;
    els.count.textContent = d.h1s.length;
    els.emptyN.textContent = a.empty;
    els.hidden.textContent = a.hidden;
    els.issuesN.textContent = a.issues.length;

    els.issues.innerHTML = "";
    if (!a.issues.length) {
      els.issues.innerHTML = '<div class="pass">Exactly one visible, non-empty h1 — heading usage looks good.</div>';
    } else {
      a.issues.forEach(function (i) {
        var div = document.createElement("div");
        div.className = "issue sev-" + i.sev;
        div.innerHTML = '<div class="title">' + esc(i.title) + '</div>' +
          '<div class="body">' + esc(i.body) + "</div>" +
          (i.loc ? '<div class="loc">' + esc(i.loc) + "</div>" : "");
        els.issues.appendChild(div);
      });
    }

    els.outline.innerHTML = "";
    d.outline.forEach(function (o) {
      var row = document.createElement("div");
      row.className = "outline-item" + (o.visible ? "" : " dim");
      row.style.paddingLeft = (8 + (o.level - 1) * 14) + "px";
      row.innerHTML = '<span class="tag">H' + o.level + '</span><span class="txt">' + esc(o.text) + "</span>";
      els.outline.appendChild(row);
    });
  }

  async function getTab() {
    var tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    return tabs[0];
  }

  async function scan() {
    els.scan.disabled = true;
    els.scan.textContent = "Scanning…";
    try {
      var tab = await getTab();
      var res = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ["content.js"]
      });
      var data = res && res[0] && res[0].result;
      if (!data) throw new Error("no data");
      var report = { data: data, analysis: analyze(data), at: Date.now() };
      await chrome.storage.local.set({ h1SleuthLast: report });
      render(report);
    } catch (e) {
      els.empty.hidden = false;
      els.empty.textContent = "Could not scan this page (it may be a restricted page such as chrome://).";
    } finally {
      els.scan.disabled = false;
      els.scan.textContent = "Scan this page";
    }
  }

  els.scan.addEventListener("click", scan);
  chrome.storage.local.get("h1SleuthLast").then(function (r) {
    if (r.h1SleuthLast && r.h1SleuthLast.data) render(r.h1SleuthLast);
  });
})();
