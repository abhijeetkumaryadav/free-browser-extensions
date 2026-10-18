/* Payload Badger — popup logic.
 * Read-only image payload audit. All savings estimates are approximate
 * heuristics (real WebP/AVIF savings depend on content), labeled as such. */
(function () {
  "use strict";

  var els = {
    scan: document.getElementById("scan"),
    empty: document.getElementById("empty"),
    results: document.getElementById("results"),
    ring: document.getElementById("scoreRing"),
    score: document.getElementById("scoreVal"),
    verdict: document.getElementById("verdict"),
    stats: document.getElementById("statsLine"),
    total: document.getElementById("stTotal"),
    heavy: document.getElementById("stHeavy"),
    fmt: document.getElementById("stFmt"),
    save: document.getElementById("stSave"),
    findings: document.getElementById("findings"),
    exportBtn: document.getElementById("export")
  };

  var lastReport = null;
  var activeFilter = "all";

  // --- Formatting helpers ------------------------------------------------
  function fmtBytes(b) {
    if (b >= 1048576) return (b / 1048576).toFixed(1) + " MB";
    if (b >= 1024) return (b / 1024).toFixed(0) + " KB";
    return b + " B";
  }

  // --- Savings heuristics (approximate, labeled in UI) --------------------
  // Typical real-world ratios: WebP ~30% smaller than JPEG, AVIF ~45-50%
  // smaller than JPEG, PNG icons ~60% smaller when converted to WebP.
  var MODERN = ["webp", "avif"];
  function suggestFormat(format) {
    if (MODERN.indexOf(format) !== -1) return null;
    if (format === "png") return { to: "webp", ratio: 0.4 };   // est. ~60% saving
    if (format === "jpg" || format === "jpeg") return { to: "webp", ratio: 0.7 };
    if (format === "gif") return { to: "webp", ratio: 0.35 };
    return { to: "webp", ratio: 0.7 };                          // unknown -> cautious
  }

  function analyze(data) {
    var findings = data.images.map(function (img) {
      var issues = [];
      var estSave = 0;

      // 1. Oversized: natural dims much larger than displayed.
      if (img.oversizeRatio > 1.5) {
        var areaRatio = Math.min(img.oversizeRatio * img.oversizeRatio, 9);
        issues.push({
          sev: "oversized",
          title: "Oversized image",
          tip: "Served " + img.naturalW + "×" + img.naturalH + " but shown at " +
            img.shownW + "×" + img.shownH + " — resize to ~" +
            Math.round(img.shownW * 2) + "px wide for retina. Est. saving ~" +
            Math.round((1 - 1 / areaRatio) * 100) + "%."
        });
        estSave += img.bytes * (1 - 1 / areaRatio);
      }

      // 2. Old format opportunity.
      var s = suggestFormat(img.format);
      if (s) {
        issues.push({
          sev: "format",
          title: "Older format: ." + img.format,
          tip: "Convert to " + s.to.toUpperCase() + " for roughly " +
            Math.round((1 - s.ratio) * 100) + "% smaller files at similar quality."
        });
        estSave += img.bytes * (1 - s.ratio);
      }

      return { img: img, issues: issues, estSave: estSave };
    });

    var totalBytes = data.images.reduce(function (a, i) { return a + i.bytes; }, 0);
    var totalSave = findings.reduce(function (a, f) { return a + f.estSave; }, 0);
    var oversized = findings.filter(function (f) {
      return f.issues.some(function (i) { return i.sev === "oversized"; });
    }).length;
    var oldFmt = findings.filter(function (f) {
      return f.issues.some(function (i) { return i.sev === "format"; });
    }).length;

    // Score: penalize total weight vs a rough "healthy page images" budget.
    var score = 100;
    if (data.images.length) {
      var perImg = totalBytes / data.images.length;
      score -= Math.min(40, (perImg / (300 * 1024)) * 20); // >~600KB avg bites hard
      score -= Math.min(30, (oversized / data.images.length) * 60);
      score -= Math.min(30, (oldFmt / data.images.length) * 30);
    }
    score = Math.max(0, Math.round(score));

    return { findings: findings, totalBytes: totalBytes, totalSave: totalSave,
             oversized: oversized, oldFmt: oldFmt, score: score };
  }

  function verdictFor(score) {
    if (score >= 85) return "Lean & mean";
    if (score >= 65) return "Mostly optimized";
    if (score >= 40) return "Needs a diet";
    return "Payload heavy";
  }

  function render(report) {
    els.empty.hidden = true;
    els.results.hidden = false;
    var a = report.analysis;
    els.score.textContent = a.score;
    els.verdict.textContent = verdictFor(a.score);
    els.stats.textContent = report.data.url.length > 44
      ? report.data.url.slice(0, 44) + "…" : report.data.url;
    els.total.textContent = report.data.images.length;
    els.heavy.textContent = a.oversized;
    els.fmt.textContent = a.oldFmt;
    els.save.textContent = fmtBytes(Math.round(a.totalSave)) + "~";
    els.findings.innerHTML = "";

    var shown = a.findings.filter(function (f) {
      if (activeFilter === "all") return f.issues.length > 0;
      return f.issues.some(function (i) { return i.sev === activeFilter; });
    });
    // Biggest offenders first.
    shown.sort(function (x, y) { return y.estSave - x.estSave; });

    if (!shown.length) {
      els.findings.innerHTML = '<div class="empty">No issues found with this filter — images look well optimized.</div>';
      return;
    }

    shown.slice(0, 60).forEach(function (f) {
      var div = document.createElement("div");
      var main = f.issues[0];
      div.className = "finding sev-" + main.sev;
      var head = document.createElement("div");
      head.className = "finding-head";
      var src = document.createElement("span");
      src.className = "src"; src.textContent = f.img.src.split("/").pop() || f.img.src;
      src.title = f.img.src;
      var save = document.createElement("span");
      save.className = "save"; save.textContent = "≈ −" + fmtBytes(Math.round(f.estSave));
      head.appendChild(src); head.appendChild(save);
      div.appendChild(head);

      var meta = document.createElement("div");
      meta.className = "meta";
      meta.textContent = f.img.naturalW + "×" + f.img.naturalH +
        " px · ." + f.img.format + " · " + fmtBytes(f.img.bytes) +
        (f.img.transferKnown ? " (measured)" : " (estimated)") +
        " · loading=" + f.img.loading;
      div.appendChild(meta);

      f.issues.forEach(function (i) {
        var tip = document.createElement("div");
        tip.className = "tip";
        tip.innerHTML = "<b>" + i.title + ".</b> " + i.tip;
        div.appendChild(tip);
      });
      els.findings.appendChild(div);
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
      var analysis = analyze(data);
      lastReport = { data: data, analysis: analysis, at: Date.now() };
      await chrome.storage.local.set({ payloadBadgerLast: lastReport });
      render(lastReport);
    } catch (e) {
      els.empty.hidden = false;
      els.empty.textContent = "Could not scan this page (it may be a restricted page such as chrome://).";
    } finally {
      els.scan.disabled = false;
      els.scan.textContent = "Scan this page";
    }
  }

  function exportJSON() {
    if (!lastReport) return;
    var blob = new Blob([JSON.stringify(lastReport, null, 2)], { type: "application/json" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "payload-badger-audit.json";
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
  }

  els.scan.addEventListener("click", scan);
  els.exportBtn.addEventListener("click", exportJSON);
  document.querySelectorAll(".chip[data-f]").forEach(function (c) {
    c.addEventListener("click", function () {
      document.querySelectorAll(".chip[data-f]").forEach(function (x) { x.classList.remove("active"); });
      c.classList.add("active");
      activeFilter = c.dataset.f;
      if (lastReport) render(lastReport);
    });
  });

  // Restore last scan on open.
  chrome.storage.local.get("payloadBadgerLast").then(function (r) {
    if (r.payloadBadgerLast && r.payloadBadgerLast.data) {
      lastReport = r.payloadBadgerLast;
      render(lastReport);
    }
  });
})();
