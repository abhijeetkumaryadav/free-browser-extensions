/* Contrast Ratio WCAG Checker — popup logic.
 * Injects contrast-probe.js on demand, then either picks a text element
 * (message-driven) or runs a full page scan (request/response). */
(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const pickBtn = $("pickBtn"), scanBtn = $("scanBtn"), err = $("err");
  const singlePane = $("single"), scanPanel = $("scanPanel");

  function showErr(msg) { err.textContent = msg; err.classList.remove("hidden"); }
  function clearErr() { err.classList.add("hidden"); }

  async function activeTab() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id) throw new Error("No active tab.");
    if (/^(chrome|edge|about):/.test(tab.url || ""))
      throw new Error("Cannot inspect browser-internal pages. Try a normal web page.");
    return tab;
  }

  /** Ensure the probe is injected, then send it a message. */
  async function withProbe(type) {
    const tab = await activeTab();
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["contrast-probe.js"] });
    return chrome.tabs.sendMessage(tab.id, { type });
  }

  /* ---------- pick flow ---------- */

  function resetPickBtn() {
    pickBtn.disabled = false;
    pickBtn.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
      'stroke-linecap="round" stroke-linejoin="round"><path d="M3 7V5a2 2 0 0 1 2-2h2"/>' +
      '<path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/>' +
      '<path d="M7 21H5a2 2 0 0 1-2-2v-2"/><circle cx="12" cy="12" r="3"/></svg>' +
      "Pick text";
  }

  pickBtn.addEventListener("click", async () => {
    clearErr();
    pickBtn.disabled = true;
    pickBtn.textContent = "Picking… click text";
    try {
      await withProbe("dcc-pick");
    } catch (e) {
      showErr(e.message || "Could not start picking on this tab.");
      resetPickBtn();
    }
  });

  /* ---------- scan flow ---------- */

  scanBtn.addEventListener("click", async () => {
    clearErr();
    scanBtn.disabled = true;
    scanBtn.textContent = "Scanning…";
    try {
      const res = await withProbe("dcc-scan");
      renderScan(res.results || []);
    } catch (e) {
      showErr(e.message || "Could not scan this tab.");
    } finally {
      scanBtn.disabled = false;
      scanBtn.innerHTML =
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
        'stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/>' +
        '<path d="m21 21-4.3-4.3"/></svg>Scan page';
    }
  });

  /* ---------- incoming pick results ---------- */

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === "dcc-result") {
      renderSingle(msg.data);
      resetPickBtn();
    } else if (msg.type === "dcc-cancel") {
      resetPickBtn();
    }
  });

  /* ---------- rendering ---------- */

  function pill(el, pass, label) {
    el.textContent = `${label} ${pass ? "✓" : "✗"}`;
    el.classList.toggle("pass", pass);
    el.classList.toggle("fail", !pass);
  }

  function renderSingle(d) {
    singlePane.classList.remove("hidden");
    scanPanel.classList.add("hidden");
    $("ratioBig").textContent = d.ratio.toFixed(2) + ":1";
    $("fgSw").style.background = d.fg;
    $("bgSw").style.background = d.bg;
    $("fgHex").textContent = d.fg;
    $("bgHex").textContent = d.bg;
    const sample = $("sample");
    sample.textContent = d.text || "Sample text";
    sample.style.color = d.fg;
    sample.style.background = d.bg;
    sample.style.fontSize = d.fontSize;

    // WCAG thresholds: normal text AA 4.5 / AAA 7; large text AA 3 / AAA 4.5.
    const large = d.large;
    pill($("aaNormal"), d.ratio >= 4.5, "AA");
    pill($("aaaNormal"), d.ratio >= 7, "AAA");
    pill($("aaLarge"), d.ratio >= 3, "AA");
    pill($("aaaLarge"), d.ratio >= 4.5, "AAA");
    document.querySelectorAll(".grade")[1].querySelector(".glabel").textContent =
      large ? "Large text ★" : "Large text";

    const cls = d.classes.length ? "." + d.classes.join(".") : "";
    $("elemInfo").textContent = `<${d.tag}${cls}> · ${d.fontSize}${large ? " · large text" : ""}`;
    chrome.storage.local.set({ lastCheck: d }).catch(() => {});
  }

  function renderScan(results) {
    singlePane.classList.add("hidden");
    scanPanel.classList.remove("hidden");
    $("scanCount").textContent = `${results.length} text nodes checked`;
    const list = $("scanList");
    list.innerHTML = "";
    if (!results.length) {
      list.innerHTML = "<li><span class='t'>No readable text found on this page.</span></li>";
      return;
    }
    for (const d of results) {
      const li = document.createElement("li");
      const cls = d.ratio < 3 ? "bad" : d.ratio < 4.5 ? "warn" : "ok";
      const tag = d.classes.length ? `${d.tag}.${d.classes[0]}` : d.tag;
      li.innerHTML =
        `<span class="r ${cls}">${d.ratio.toFixed(1)}</span>` +
        `<span class="t">${escapeHtml(d.text || tag)} · &lt;${escapeHtml(tag)}&gt;</span>` +
        `<span class="dots"><span class="dot" style="background:${d.fg}"></span>` +
        `<span class="dot" style="background:${d.bg}"></span></span>`;
      list.appendChild(li);
    }
    chrome.storage.local.set({ lastScan: results }).catch(() => {});
  }

  function escapeHtml(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  /* ---------- restore last results ---------- */

  chrome.storage.local.get(["lastCheck", "lastScan"]).then(({ lastCheck, lastScan }) => {
    if (lastCheck) renderSingle(lastCheck);
    else if (lastScan) renderScan(lastScan);
  }).catch(() => {});
})();
