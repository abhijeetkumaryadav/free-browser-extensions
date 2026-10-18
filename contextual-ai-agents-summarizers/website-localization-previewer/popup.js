// Website Localization Previewer — popup logic.
// grabVisibleText() is injected into the page; keep it self-contained (no closures).

// Runs inside the active tab: collects unique visible UI strings.
function grabVisibleText() {
  const out = [];
  const seen = new Set();
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const bad = /^(script|style|noscript|textarea|iframe)$/i;
  let node, count = 0;
  while ((node = walker.nextNode()) && count < 4000) {
    count++;
    const t = node.nodeValue.trim().replace(/\s+/g, " ");
    if (!t || t.length < 2 || t.length > 120 || seen.has(t)) continue;
    const el = node.parentElement;
    if (!el || bad.test(el.tagName)) continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    if (!/^(BUTTON|A|H1|H2|H3|H4|LABEL|SPAN|P|LI|DIV)$/.test(el.tagName)) continue;
    seen.add(t);
    out.push(t);
    if (out.length >= 30) break;
  }
  return out;
}

// Accented-character substitution table (pseudolocalization).
const ACCENTS = {
  a:"à",b:"ƀ",c:"ç",d:"ď",e:"ë",f:"ƒ",g:"ğ",h:"ħ",i:"ï",j:"ĵ",k:"ƙ",l:"ł",m:"ɱ",n:"ñ",o:"ö",p:"ƥ",q:"ɋ",r:"ř",s:"š",t:"ŧ",u:"ü",v:"ṽ",w:"ŵ",x:"ẋ",y:"ÿ",z:"ž",
  A:"À",B:"Ɓ",C:"Ç",D:"Ď",E:"Ë",F:"Ƒ",G:"Ğ",H:"Ħ",I:"Ï",J:"Ĵ",K:"Ƙ",L:"Ł",M:"Ṁ",N:"Ñ",O:"Ö",P:"Ƥ",Q:"Ƣ",R:"Ř",S:"Š",T:"Ŧ",U:"Ü",V:"Ṽ",W:"Ŵ",X:"Ẋ",Y:"Ÿ",Z:"Ž",
};

const SAMPLES = [
  "Add to cart",
  "Free shipping on orders over $50",
  "Your session expires in 5 minutes",
  "Create account",
  "Payment failed. Please try again.",
];

const $ = (id) => document.getElementById(id);

document.addEventListener("DOMContentLoaded", init);

async function init() {
  $("go").addEventListener("click", transform);
  $("grab").addEventListener("click", grabFromPage);
  $("samples").addEventListener("click", () => { $("input").value = SAMPLES.join("\n"); saveInput(); });
  $("copyAll").addEventListener("click", copyAll);
  ["optAccent","optExpand","optBrackets","optRatio"].forEach((id) =>
    $(id).addEventListener("change", () => { saveOpts(); transform(); })
  );
  $("input").addEventListener("input", saveInput);
  const { strings = "", opts = {} } = await chrome.storage.local.get(["strings","opts"]);
  $("input").value = strings;
  if (opts.accent === false) $("optAccent").checked = false;
  if (opts.expand === false) $("optExpand").checked = false;
  if (opts.brackets === false) $("optBrackets").checked = false;
  if (opts.ratio) $("optRatio").value = String(opts.ratio);
  if (strings.trim()) transform();
}

function getOpts() {
  return {
    accent: $("optAccent").checked,
    expand: $("optExpand").checked,
    brackets: $("optBrackets").checked,
    ratio: parseFloat($("optRatio").value) || 1.4,
  };
}
async function saveOpts() { await chrome.storage.local.set({ opts: getOpts() }); }
async function saveInput() { await chrome.storage.local.set({ strings: $("input").value }); }

function pseudolocalize(src, opts) {
  let s = src;
  if (opts.accent) {
    s = [...s].map((ch) => ACCENTS[ch] || ch).join("");
  }
  if (opts.expand) {
    const target = Math.ceil(src.length * opts.ratio);
    if (s.length < target) s += " " + "•".repeat(target - s.length - 1);
  }
  if (opts.brackets) s = "[!!! " + s + " !!!]";
  return s;
}

function transform() {
  const lines = $("input").value.split("\n").map((l) => l.trim()).filter(Boolean);
  const opts = getOpts();
  const box = $("results");
  box.innerHTML = "";
  $("resultsCard").hidden = lines.length === 0;
  for (const line of lines.slice(0, 60)) {
    const dst = pseudolocalize(line, opts);
    const row = document.createElement("div");
    row.className = "row";
    const srcEl = document.createElement("div"); srcEl.className = "src"; srcEl.textContent = line;
    const dstEl = document.createElement("div"); dstEl.className = "dst"; dstEl.textContent = dst;
    const btn = document.createElement("button"); btn.className = "cpy"; btn.textContent = "Copy";
    btn.addEventListener("click", async () => {
      await navigator.clipboard.writeText(dst);
      toast("Copied");
    });
    row.append(srcEl, dstEl, btn);
    box.appendChild(row);
  }
}

async function grabFromPage() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id) throw new Error("no-tab");
    const [res] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: grabVisibleText });
    const found = (res && res.result) || [];
    if (!found.length) { toast("No UI text found"); return; }
    $("input").value = found.join("\n");
    await saveInput();
    transform();
    toast(`Grabbed ${found.length} strings`);
  } catch (e) {
    toast("Can't read this page");
  }
}

async function copyAll() {
  const texts = [...document.querySelectorAll("#results .dst")].map((el) => el.textContent);
  await navigator.clipboard.writeText(texts.join("\n"));
  toast("All copied");
}

let toastTimer = null;
function toast(msg) {
  let t = document.querySelector(".toast");
  if (!t) { t = document.createElement("div"); t.className = "toast"; document.body.appendChild(t); }
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 1400);
}
