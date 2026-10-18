// Font Geometry Inspector — popup logic.
// Element picking runs in the page via scripting.executeScript; the picked
// element's computed style is saved to storage, then shown when the popup
// (re)opens. All data stays on-device.

const $ = (id) => document.getElementById(id);

// Injected into the active tab. Runs in the isolated world, so chrome.* is
// available. Resolves after saving the inspected element's font geometry.
function pickElementInPage() {
  return new Promise((resolve, reject) => {
    const box = document.createElement("div");
    Object.assign(box.style, {
      position: "fixed", zIndex: "2147483647", pointerEvents: "none",
      border: "2px solid #8b5cf6", background: "rgba(139,92,246,.12)",
      borderRadius: "3px", display: "none",
    });
    document.documentElement.appendChild(box);

    const toast = document.createElement("div");
    toast.textContent = "Click an element to inspect its font — Esc cancels";
    Object.assign(toast.style, {
      position: "fixed", zIndex: "2147483647", top: "12px", left: "50%",
      transform: "translateX(-50%)", background: "#17171f", color: "#f4f6fb",
      padding: "10px 16px", borderRadius: "10px", font: "13px sans-serif",
      border: "1px solid rgba(139,92,246,.5)", pointerEvents: "none",
    });
    document.documentElement.appendChild(toast);

    let target = null;
    const move = (el) => {
      const r = el.getBoundingClientRect();
      Object.assign(box.style, {
        display: "block", left: r.left + "px", top: r.top + "px",
        width: r.width + "px", height: r.height + "px",
      });
    };
    const onOver = (e) => {
      e.stopPropagation();
      target = e.target;
      move(target);
    };
    const cleanup = () => {
      document.removeEventListener("mouseover", onOver, true);
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("keydown", onKey, true);
      box.remove();
      toast.remove();
    };
    const describe = (el) => {
      let d = el.tagName.toLowerCase();
      if (el.id) d += "#" + el.id;
      else if (el.className && typeof el.className === "string") {
        const c = el.className.trim().split(/\s+/).slice(0, 2).join(".");
        if (c) d += "." + c;
      }
      return d;
    };
    const onClick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      const el = target || e.target;
      const cs = getComputedStyle(el);
      const data = {
        selector: describe(el),
        fontFamily: cs.fontFamily,
        fontSize: cs.fontSize,
        fontWeight: cs.fontWeight,
        fontStyle: cs.fontStyle,
        lineHeight: cs.lineHeight,
        letterSpacing: cs.letterSpacing,
        wordSpacing: cs.wordSpacing,
        textTransform: cs.textTransform,
        textAlign: cs.textAlign,
        textDecorationLine: cs.textDecorationLine,
        color: cs.color,
        at: Date.now(),
      };
      cleanup();
      chrome.storage.local.set({ lastInspection: data }).then(() => resolve(data));
    };
    const onKey = (e) => {
      if (e.key === "Escape") { cleanup(); reject(new Error("cancelled")); }
    };
    document.addEventListener("mouseover", onOver, true);
    document.addEventListener("click", onClick, true);
    document.addEventListener("keydown", onKey, true);
    // Auto-cancel after 60s so listeners never linger.
    setTimeout(() => {
      if (document.documentElement.contains(box)) { cleanup(); reject(new Error("timeout")); }
    }, 60000);
  });
}

const PROPS = [
  ["fontFamily", "Font family", true],
  ["fontSize", "Font size", true],
  ["fontWeight", "Font weight", false],
  ["fontStyle", "Font style", false],
  ["lineHeight", "Line height", true],
  ["letterSpacing", "Letter spacing", true],
  ["wordSpacing", "Word spacing", true],
  ["textTransform", "Text transform", false],
  ["textAlign", "Text align", false],
  ["textDecorationLine", "Text decoration", false],
  ["color", "Color", true],
];

document.addEventListener("DOMContentLoaded", init);

async function init() {
  $("pick").addEventListener("click", startPick);
  $("copyAll").addEventListener("click", copyAll);
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab && tab.url) {
    try { $("pageHost").textContent = new URL(tab.url).hostname.replace(/^www\./, ""); } catch (e) { /* ignore */ }
  }
  const { lastInspection } = await chrome.storage.local.get("lastInspection");
  if (lastInspection) render(lastInspection);
}

async function startPick() {
  const btn = $("pick");
  btn.disabled = true;
  btn.textContent = "Click an element on the page…";
  $("hint").textContent = "The popup will close — click any element, then reopen the extension to see its font geometry.";
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id || !/^https?:/.test(tab.url || "")) {
      throw new Error("Pick works on regular http/https pages.");
    }
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: pickElementInPage });
    // If the popup is still open and the promise resolved, show it now.
    const { lastInspection } = await chrome.storage.local.get("lastInspection");
    if (lastInspection) render(lastInspection);
  } catch (e) {
    $("hint").textContent = e && e.message === "cancelled"
      ? "Picking cancelled."
      : "Couldn't start the picker on this page. Try a regular website tab.";
  } finally {
    btn.disabled = false;
    btn.textContent = "Pick element on page";
  }
}

function rgbToHex(rgb) {
  const m = rgb.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (!m) return null;
  return "#" + [1, 2, 3].map((i) => Number(m[i]).toString(16).padStart(2, "0")).join("");
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

function render(d) {
  $("empty").style.display = "none";
  $("resultCard").hidden = false;
  $("tagName").textContent = d.selector;
  const box = $("props");
  box.innerHTML = "";
  for (const [key, label, mono] of PROPS) {
    const row = document.createElement("div");
    row.className = "prop";
    const k = document.createElement("div");
    k.className = "k";
    k.textContent = label;
    const v = document.createElement("div");
    v.className = "v" + (mono ? " mono" : "");
    if (key === "color") {
      const hex = rgbToHex(d.color);
      v.innerHTML = `<span class="swatch" style="background:${esc(d.color)}"></span>${esc(d.color)}${hex ? " · " + hex : ""}`;
    } else {
      v.textContent = d[key] || "—";
    }
    row.append(k, v);
    box.appendChild(row);
  }
  // Weight keyword for readability.
  const wMap = { 100: "Thin", 200: "Extra Light", 300: "Light", 400: "Regular", 500: "Medium", 600: "Semi Bold", 700: "Bold", 800: "Extra Bold", 900: "Black" };
  const wRow = box.children[2].querySelector(".v");
  const wName = wMap[d.fontWeight];
  if (wName) wRow.textContent = `${d.fontWeight} (${wName})`;
  box.dataset.json = JSON.stringify(d);
}

function copyAll() {
  const d = JSON.parse(document.getElementById("props").dataset.json || "{}");
  const css = [
    `/* ${d.selector || "element"} */`,
    `font-family: ${d.fontFamily};`,
    `font-size: ${d.fontSize};`,
    `font-weight: ${d.fontWeight};`,
    `font-style: ${d.fontStyle};`,
    `line-height: ${d.lineHeight};`,
    `letter-spacing: ${d.letterSpacing};`,
    `word-spacing: ${d.wordSpacing};`,
    `text-transform: ${d.textTransform};`,
    `text-align: ${d.textAlign};`,
    `text-decoration-line: ${d.textDecorationLine};`,
    `color: ${d.color};`,
  ].join("\n");
  navigator.clipboard.writeText(css).then(() => {
    $("copyAll").textContent = "Copied ✓";
    setTimeout(() => { $("copyAll").textContent = "Copy all as CSS"; }, 1200);
  });
}
