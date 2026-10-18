/* BubbleTranslate — selection/paste translation helper.
   Honest scope: opens Google Translate in a new tab with your text.
   NOT image OCR — text baked into images cannot be read by this extension.
   Permissions: storage (remember languages), activeTab + scripting (read page
   selection on demand only). No page content is stored or transmitted anywhere
   except the Google Translate URL you explicitly open. */

"use strict";

/* [code, label] — common reading/translation languages */
const LANGUAGES = [
  ["auto", "Detect language"],
  ["en", "English"], ["es", "Spanish"], ["fr", "French"], ["de", "German"],
  ["it", "Italian"], ["pt", "Portuguese"], ["ru", "Russian"],
  ["ja", "Japanese"], ["ko", "Korean"], ["zh-CN", "Chinese (Simplified)"],
  ["zh-TW", "Chinese (Traditional)"], ["ar", "Arabic"], ["hi", "Hindi"],
  ["bn", "Bengali"], ["tr", "Turkish"], ["nl", "Dutch"], ["pl", "Polish"],
  ["uk", "Ukrainian"], ["vi", "Vietnamese"], ["th", "Thai"], ["id", "Indonesian"],
  ["ms", "Malay"], ["ta", "Tamil"], ["te", "Telugu"], ["mr", "Marathi"],
  ["gu", "Gujarati"], ["kn", "Kannada"], ["ml", "Malayalam"], ["pa", "Punjabi"],
  ["ur", "Urdu"], ["fa", "Persian"], ["he", "Hebrew"], ["el", "Greek"],
  ["sv", "Swedish"], ["da", "Danish"], ["no", "Norwegian"], ["fi", "Finnish"],
  ["ro", "Romanian"], ["hu", "Hungarian"], ["cs", "Czech"], ["sk", "Slovak"],
  ["bg", "Bulgarian"], ["hr", "Croatian"], ["sr", "Serbian"],
];

const DEFAULT_TARGET = "en";
const $ = (id) => document.getElementById(id);

const store = {
  async get(keys) {
    try { return await chrome.storage.local.get(keys); } catch { return {}; }
  },
  async set(obj) {
    try { await chrome.storage.local.set(obj); } catch { /* ignore */ }
  },
};

function fillLanguages(select, includeAuto) {
  select.innerHTML = "";
  for (const [code, label] of LANGUAGES) {
    if (code === "auto" && !includeAuto) continue;
    const opt = document.createElement("option");
    opt.value = code;
    opt.textContent = label;
    select.appendChild(opt);
  }
}

function updateCount() {
  const n = $("text").value.length;
  $("count").textContent = `${n.toLocaleString()} char${n === 1 ? "" : "s"}`;
}

function showError(msg) {
  const el = $("error");
  el.textContent = msg;
  el.classList.remove("hidden");
  clearTimeout(showError._t);
  showError._t = setTimeout(() => el.classList.add("hidden"), 3500);
}

/* Read the user's current text selection from the active tab (on demand). */
async function grabSelection() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || tab.id === undefined) throw new Error("no active tab");
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => (window.getSelection ? String(window.getSelection()) : ""),
    });
    const text = (result || "").trim();
    if (!text) {
      showError("No text selected on this page — select some text first, or paste it.");
      return;
    }
    $("text").value = text;
    updateCount();
  } catch (e) {
    showError("Couldn't read the page selection (this page may restrict extensions). Paste the text instead.");
  }
}

function translateUrl(text, sl, tl) {
  const params = new URLSearchParams({ sl, tl, text, op: "translate" });
  return "https://translate.google.com/?" + params.toString();
}

async function doTranslate() {
  const text = $("text").value.trim();
  if (!text) {
    showError("Enter or select some text first.");
    $("text").focus();
    return;
  }
  const sl = $("source").value;
  const tl = $("target").value;
  // Google Translate caps URL length in practice; warn on very long input.
  if (text.length > 4000) {
    showError("Text is very long — Google Translate may truncate it. Consider splitting it.");
    return;
  }
  await chrome.tabs.create({ url: translateUrl(text, sl, tl) });
  window.close();
}

async function swapLanguages() {
  const src = $("source"), tgt = $("target");
  const { lastSource } = await store.get(["lastSource"]);
  if (src.value === "auto") {
    // Can't put "auto" in the target slot: restore the last explicit source instead.
    src.value = lastSource && lastSource !== "auto" ? lastSource : tgt.value;
  } else {
    const tmp = src.value;
    src.value = tgt.value;
    tgt.value = tmp;
  }
  if (src.value !== "auto") await store.set({ source: src.value, lastSource: src.value });
  await store.set({ target: tgt.value });
}

document.addEventListener("DOMContentLoaded", async () => {
  fillLanguages($("source"), true);
  fillLanguages($("target"), false);

  const saved = await store.get(["source", "target", "lastSource"]);
  $("source").value = saved.source || "auto";
  $("target").value = saved.target || DEFAULT_TARGET;
  if (!$("source").value) $("source").value = "auto";
  if (!$("target").value) $("target").value = DEFAULT_TARGET;

  $("source").addEventListener("change", async () => {
    const v = $("source").value;
    const patch = { source: v };
    if (v !== "auto") patch.lastSource = v;
    await store.set(patch);
  });
  $("target").addEventListener("change", () => store.set({ target: $("target").value }));
  $("text").addEventListener("input", updateCount);
  $("grab").addEventListener("click", grabSelection);
  $("clear").addEventListener("click", () => { $("text").value = ""; updateCount(); $("text").focus(); });
  $("swap").addEventListener("click", swapLanguages);
  $("translate").addEventListener("click", doTranslate);
  updateCount();
  $("text").focus();
});
