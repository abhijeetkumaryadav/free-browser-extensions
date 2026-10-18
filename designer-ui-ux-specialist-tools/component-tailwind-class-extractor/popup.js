/* Component Class Extractor — popup logic.
 * Injects picker.js on demand, receives the picked element data,
 * renders HTML / CSS / Tree snippets, copies to clipboard. */
(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const pickBtn = $("pickBtn"), err = $("err");
  const emptyPane = $("empty"), resultPane = $("result");
  const codeEl = $("code"), tagBadge = $("tagBadge"), classCount = $("classCount");
  const copyBtn = $("copyBtn"), copied = $("copied");
  const tabHtml = $("tabHtml"), tabCss = $("tabCss"), tabTree = $("tabTree");

  let lastData = null;      // last picked element descriptor
  let depth = "el";         // "el" | "tree"
  let activeTab = "html";   // "html" | "css" | "tree"

  /* ---------- helpers ---------- */

  function showErr(msg) {
    err.textContent = msg;
    err.classList.remove("hidden");
  }
  function clearErr() { err.classList.add("hidden"); }

  function esc(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  /** Build the HTML snippet for the picked element. */
  function buildHtml(d) {
    const attrs = [];
    if (d.id) attrs.push(`id="${esc(d.id)}"`);
    if (d.classes.length) attrs.push(`class="${esc(d.classes.join(" "))}"`);
    const attrStr = attrs.length ? " " + attrs.join(" ") : "";
    const inner = d.text ? esc(d.text) : "<!-- content -->";
    return `<${d.tag}${attrStr}>\n  ${inner}\n</${d.tag}>`;
  }

  /** Build a CSS block from the key computed styles. */
  function buildCss(d) {
    const sel = d.id ? `#${d.id}` : (d.classes[0] ? `.${d.classes[0]}` : d.tag);
    const lines = Object.entries(d.styles).map(([k, v]) => `  ${k}: ${v};`);
    const body = lines.length ? lines.join("\n") : "  /* no distinctive computed styles */";
    return `${sel} {\n${body}\n}`;
  }

  /** Build a compact tree listing for "With children" mode. */
  function buildTree(d, indent = 0) {
    const pad = "  ".repeat(indent);
    const cls = d.classes.length ? `.${d.classes.join(".")}` : "";
    const id = d.id ? `#${d.id}` : "";
    let out = `${pad}<${d.tag}${id}${cls}>`;
    for (const c of d.children || []) out += "\n" + buildTree(c, indent + 1);
    return out;
  }

  function render() {
    if (!lastData) return;
    emptyPane.classList.add("hidden");
    resultPane.classList.remove("hidden");
    tagBadge.textContent = `<${lastData.tag}>`;
    classCount.textContent = lastData.classes.length
      ? `${lastData.classes.length} class${lastData.classes.length > 1 ? "es" : ""}`
      : "no classes";
    tabTree.classList.toggle("hidden", depth !== "tree");
    if (activeTab === "tree" && depth !== "tree") activeTab = "html";
    for (const [btn, name] of [[tabHtml, "html"], [tabCss, "css"], [tabTree, "tree"]])
      btn.classList.toggle("active", activeTab === name);
    codeEl.textContent =
      activeTab === "css" ? buildCss(lastData) :
      activeTab === "tree" ? buildTree(lastData) :
      buildHtml(lastData);
  }

  async function copySnippet() {
    try {
      await navigator.clipboard.writeText(codeEl.textContent);
      copied.classList.remove("hidden");
      setTimeout(() => copied.classList.add("hidden"), 1500);
    } catch {
      showErr("Clipboard write failed — select the snippet and copy manually.");
    }
  }

  /* ---------- picking ---------- */

  async function startPick() {
    clearErr();
    pickBtn.disabled = true;
    pickBtn.textContent = "Picking… click an element";
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab || !tab.id) throw new Error("No active tab.");
      if (/^(chrome|edge|about):/.test(tab.url || ""))
        throw new Error("Cannot inject into browser-internal pages. Try a normal web page.");

      // Pass the chosen depth to the picker via the document dataset.
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: (d) => { document.documentElement.dataset.cteDepth = d; },
        args: [depth],
      });
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ["picker.js"],
      });
    } catch (e) {
      showErr(e.message || "Could not start picking on this tab.");
      resetPickBtn();
    }
  }

  function resetPickBtn() {
    pickBtn.disabled = false;
    pickBtn.innerHTML = null;
    // Restore original button content (icon + label).
    pickBtn.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
      'stroke-linecap="round" stroke-linejoin="round"><path d="M3 7V5a2 2 0 0 1 2-2h2"/>' +
      '<path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/>' +
      '<path d="M7 21H5a2 2 0 0 1-2-2v-2"/><circle cx="12" cy="12" r="3"/></svg>' +
      "Pick element on page";
  }

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === "cte-result") {
      lastData = msg.data;
      activeTab = "html";
      render();
      chrome.storage.local.set({ lastExtraction: msg.data }).catch(() => {});
      resetPickBtn();
    } else if (msg.type === "cte-cancel") {
      resetPickBtn();
    }
  });

  /* ---------- events ---------- */

  pickBtn.addEventListener("click", startPick);
  copyBtn.addEventListener("click", copySnippet);
  tabHtml.addEventListener("click", () => { activeTab = "html"; render(); });
  tabCss.addEventListener("click", () => { activeTab = "css"; render(); });
  tabTree.addEventListener("click", () => { activeTab = "tree"; render(); });

  $("depthEl").addEventListener("click", () => {
    depth = "el";
    $("depthEl").classList.add("active");
    $("depthTree").classList.remove("active");
    if (lastData && !lastData.children) render();
  });
  $("depthTree").addEventListener("click", () => {
    depth = "tree";
    $("depthTree").classList.add("active");
    $("depthEl").classList.remove("active");
    if (lastData && lastData.children) render();
  });

  /* ---------- restore last extraction ---------- */

  chrome.storage.local.get("lastExtraction").then(({ lastExtraction }) => {
    if (lastExtraction) { lastData = lastExtraction; render(); }
  }).catch(() => {});
})();
