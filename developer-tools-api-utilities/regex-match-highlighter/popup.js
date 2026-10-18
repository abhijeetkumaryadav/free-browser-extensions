// Regex Match Highlighter — popup logic.
// rxhlRun() lives in content.js and is injected into the page via
// chrome.scripting; the popup validates the pattern first so the page
// only ever receives a working regex.

const $ = (id) => document.getElementById(id);

const QUICK = [
  ["Email", "[\\w.+-]+@[\\w-]+\\.[\\w.]+", "gi"],
  ["URL", "https?://[^\\s\"'<>]+", "gi"],
  ["IPv4", "\\b(?:\\d{1,3}\\.){3}\\d{1,3}\\b", "g"],
  ["Date", "\\b\\d{4}-\\d{2}-\\d{2}\\b", "g"],
  ["Hashtag", "#\\w+", "g"],
  ["Price", "[$€£₹]\\s?[\\d,]+(?:\\.\\d{2})?", "g"],
];

document.addEventListener("DOMContentLoaded", init);

async function init() {
  const saved = await chrome.storage.local.get({ pattern: "", flags: "g" });
  $("pattern").value = saved.pattern || "";
  for (const f of ["g", "i", "m", "s"]) $("f" + f).checked = (saved.flags || "g").includes(f);

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab && tab.url) {
    try { $("pageHost").textContent = new URL(tab.url).hostname.replace(/^www\./, ""); } catch (e) {}
  }

  $("highlight").addEventListener("click", highlight);
  $("clear").addEventListener("click", clearHighlights);
  $("pattern").addEventListener("keydown", (e) => { if (e.key === "Enter") highlight(); });
  $("pattern").addEventListener("input", () => { hideError(); persist(); });
  for (const f of ["g", "i", "m", "s"]) $("f" + f).addEventListener("change", persist);

  const box = $("quick");
  for (const [label, pattern, flags] of QUICK) {
    const b = document.createElement("button");
    b.textContent = label;
    b.addEventListener("click", () => {
      $("pattern").value = pattern;
      for (const f of ["g", "i", "m", "s"]) $("f" + f).checked = flags.includes(f);
      hideError();
      persist();
      highlight();
    });
    box.appendChild(b);
  }
}

function currentFlags() {
  return ["g", "i", "m", "s"].filter((f) => $("f" + f).checked).join("") || "g";
}

function persist() {
  chrome.storage.local.set({ pattern: $("pattern").value, flags: currentFlags() });
}

function showError(msg) {
  const e = $("error");
  e.textContent = msg;
  e.hidden = false;
}
function hideError() {
  $("error").hidden = true;
}

async function runInPage(mode, source, flags) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || tab.id == null) throw new Error("no-tab");
  const [res] = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: rxhlRun, // defined in content.js, serialized into the page
    args: [mode, source, flags],
  });
  return res && res.result;
}

async function highlight() {
  hideError();
  const pattern = $("pattern").value;
  const flags = currentFlags();
  if (!pattern.trim()) {
    showError("Enter a pattern first — or tap a quick pattern below.");
    return;
  }
  try {
    new RegExp(pattern, flags); // validate before touching the page
  } catch (e) {
    showError("Invalid regex: " + e.message.replace(/^Invalid regular expression:\s*/, ""));
    return;
  }
  const btn = $("highlight");
  btn.disabled = true;
  btn.textContent = "Highlighting…";
  try {
    const res = await runInPage("highlight", pattern, flags);
    const n = (res && res.count) || 0;
    $("count").hidden = false;
    $("countNum").textContent = n.toLocaleString();
    if (n === 0) showError("Pattern is valid, but nothing on this page matched.");
    persist();
  } catch (e) {
    showError("Can't highlight this page — browser, store, and settings pages are protected.");
  } finally {
    btn.disabled = false;
    btn.textContent = "Highlight";
  }
}

async function clearHighlights() {
  hideError();
  try {
    await runInPage("clear", "", "g");
  } catch (e) {
    /* page protected — nothing to clear */
  }
  $("count").hidden = true;
}
