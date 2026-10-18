// Variant Stock Checker — popup logic.
// detectVariants() is injected into the page; keep it self-contained.

function detectVariants() {
  const OUT_RE = /sold\s?out|out\s?of\s?stock|unavailable|notify\s?me/i;
  const LOW_RE = /only\s?\d+\s?left|low\s?stock|\d+\s?left\s?in\s?stock/i;
  const BAD_CLS = /disabled|sold-?out|unavailable|oos\b|outofstock/i;

  function labelOf(el) {
    return (el.getAttribute("aria-label") || el.getAttribute("title") ||
      el.getAttribute("data-value") || el.textContent || el.value || "").trim().replace(/\s+/g, " ").slice(0, 60);
  }

  function isOut(el) {
    if (el.disabled) return "option is disabled";
    if (el.getAttribute && el.getAttribute("aria-disabled") === "true") return "aria-disabled";
    const cls = (el.className && el.className.baseVal !== undefined ? el.className.baseVal : el.className) || "";
    if (BAD_CLS.test(String(cls))) return "marked unavailable in page markup";
    const txt = (el.innerText || el.textContent || "");
    if (OUT_RE.test(txt)) return "shows “sold out” / “out of stock” text";
    try {
      const cs = getComputedStyle(el);
      if (cs.textDecorationLine && cs.textDecorationLine.includes("line-through")) return "struck through";
      if (parseFloat(cs.opacity) < 0.4 && el.tagName !== "OPTION") return "visually dimmed as unavailable";
    } catch (e) {}
    return null;
  }

  function isLow(container, el) {
    const scope = ((container && container.innerText) || "").slice(0, 3000);
    const m = scope.match(LOW_RE);
    if (m) return m[0];
    const near = ((el.parentElement && el.parentElement.innerText) || "").slice(0, 500);
    const m2 = near.match(LOW_RE);
    return m2 ? m2[0] : null;
  }

  function groupNameFor(el) {
    const fs = el.closest("fieldset");
    if (fs) {
      const leg = fs.querySelector("legend");
      if (leg && leg.textContent.trim()) return leg.textContent.trim().slice(0, 40);
    }
    const labelled = el.closest("[aria-label]");
    if (labelled && labelled !== el) return labelled.getAttribute("aria-label").slice(0, 40);
    const c = el.closest("div");
    if (c) {
      const head = c.querySelector("label, .variant-label, [class*=label], [class*=option-name]");
      if (head && head.textContent.trim()) return head.textContent.trim().slice(0, 40);
    }
    const nm = el.getAttribute && el.getAttribute("name");
    if (nm) return nm.replace(/[-_]/g, " ").slice(0, 40);
    return "Variants";
  }

  const groups = new Map(); // name -> {variants: []}
  function addVariant(group, el) {
    const label = labelOf(el);
    if (!label) return;
    if (!groups.has(group)) groups.set(group, { variants: [] });
    const g = groups.get(group);
    if (g.variants.some((v) => v.label === label)) return;
    const outReason = isOut(el);
    let status = "in", note = "no negative signal — likely in stock";
    if (outReason) { status = "out"; note = outReason; }
    else {
      const lowTxt = isLow(el.closest("fieldset") || el.closest("div"), el);
      if (lowTxt) { status = "low"; note = `page says “${lowTxt}”`; }
    }
    g.variants.push({ label, status, note });
  }

  // 1. radio inputs (size/color swatches)
  document.querySelectorAll('input[type="radio"]').forEach((el) => {
    const wrap = el.closest("label") || el;
    addVariant(groupNameFor(el), wrap);
  });
  // 2. select dropdowns
  document.querySelectorAll("select").forEach((sel) => {
    if (sel.options.length < 2 || sel.options.length > 60) return;
    const g = groupNameFor(sel);
    [...sel.options].forEach((o) => { if (o.value || o.text.trim()) addVariant(g, o); });
  });
  // 3. option buttons / swatches
  document.querySelectorAll('button, [role="option"], [role="radio"], a').forEach((el) => {
    const cls = String(el.className && el.className.baseVal !== undefined ? el.className.baseVal : (el.className || ""));
    if (!/swatch|variant|option|size|color/i.test(cls)) return;
    if (el.closest("nav, header, footer")) return;
    const t = (el.innerText || "").trim();
    if (t.length > 40 || t.length === 0) return;
    addVariant(groupNameFor(el), el);
  });

  const out = [];
  for (const [name, g] of groups) {
    if (g.variants.length >= 2) out.push({ name, variants: g.variants.slice(0, 40) });
  }
  return out.slice(0, 8);
}

const $ = (id) => document.getElementById(id);

document.addEventListener("DOMContentLoaded", () => {
  $("scan").addEventListener("click", scan);
});

async function scan() {
  const btn = $("scan");
  btn.disabled = true; btn.textContent = "Scanning…";
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id) throw new Error("no-tab");
    try { $("pageHost").textContent = new URL(tab.url).hostname.replace(/^www\./, ""); } catch (e) {}
    const [res] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: detectVariants });
    const groups = (res && res.result) || [];
    render(groups);
  } catch (e) {
    $("empty").style.display = "";
    $("empty").innerHTML = "Couldn’t scan this page — try a product page with size/color options.";
  } finally {
    btn.disabled = false; btn.textContent = "Scan page";
  }
}

function render(groups) {
  $("empty").style.display = "none";
  const card = $("results");
  const box = $("groups");
  box.innerHTML = "";
  if (!groups.length) {
    $("empty").style.display = "";
    $("empty").innerHTML = "No variant selectors found on this page. Try a product page with size/color/style options.";
    card.hidden = true;
    return;
  }
  card.hidden = false;
  const names = { in: "In stock", low: "Low", out: "Out" };
  for (const g of groups) {
    const h = document.createElement("div");
    h.className = "gname";
    h.textContent = g.name;
    box.appendChild(h);
    for (const v of g.variants) {
      const row = document.createElement("div");
      row.className = "vrow";
      const lbl = document.createElement("div");
      lbl.className = "lbl"; lbl.textContent = v.label; lbl.title = v.label;
      const pill = document.createElement("span");
      pill.className = "pill " + v.status;
      pill.textContent = names[v.status];
      const note = document.createElement("p");
      note.className = "note";
      note.textContent = "Signal: " + v.note;
      row.append(lbl, pill, note);
      box.appendChild(row);
    }
  }
}
