// popup.js — per-site custom CSS themer. All state local; applies only to YOUR view.
/* Presets between ENGINE-START / ENGINE-END so logic stays testable. */
// ENGINE-START
const PRESETS = {
  "MySpace Retro": `body{background:#0d0221 !important;color:#ff4d6d !important;font-family:"Comic Sans MS",cursive !important;}
a{color:#00e5ff !important;} img{border:3px ridge #ff4d6d !important;border-radius:8px;}`,
  "Midnight": `body{background:#0b0e14 !important;color:#dbe4f0 !important;}
a{color:#7dd3fc !important;}`,
  "Paper": `body{background:#faf7f0 !important;color:#2b2b2b !important;}
a{color:#b45309 !important;}`,
  "Forest": `body{background:#0c1a12 !important;color:#d3f9d8 !important;}
a{color:#8ce99a !important;}`,
  "Sunset": `body{background:linear-gradient(135deg,#2b1055,#7597de) !important;color:#fff !important;}
a{color:#ffd43b !important;}`
};

function storageKey(domain) { return "theme:" + domain; }
function isHttpUrl(url) { return /^https?:\/\//i.test(url || ""); }
// ENGINE-END

const siteLabel = document.getElementById("siteLabel");
const cssBox = document.getElementById("cssBox");
const statusEl = document.getElementById("status");
const presetsEl = document.getElementById("presets");

let domain = "";

function setStatus(msg, cls) {
  statusEl.textContent = msg;
  statusEl.className = "status" + (cls ? " " + cls : "");
}

// Render preset chips; clicking one loads its CSS into the editor.
function renderPresets(activeName) {
  presetsEl.innerHTML = "";
  for (const name of Object.keys(PRESETS)) {
    const b = document.createElement("button");
    b.textContent = name;
    if (name === activeName) b.classList.add("active");
    b.addEventListener("click", () => {
      cssBox.value = PRESETS[name];
      renderPresets(name);
    });
    presetsEl.appendChild(b);
  }
}

// Inject (or replace) our theme <style> in the active tab.
async function applyCssToTab(css) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !isHttpUrl(tab.url)) throw new Error("Open a normal web page first.");
  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: (cssText) => {
      const ID = "myspace-themer-style";
      document.getElementById(ID)?.remove();
      const el = document.createElement("style");
      el.id = ID;
      el.textContent = cssText;
      document.documentElement.appendChild(el);
    },
    args: [css]
  });
}

async function removeCssFromTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !isHttpUrl(tab.url)) return;
  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => document.getElementById("myspace-themer-style")?.remove()
  });
}

async function init() {
  renderPresets("");
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !isHttpUrl(tab.url)) {
    siteLabel.textContent = "No web page active";
    setStatus("Open a normal web page to theme it.", "err");
    document.getElementById("applyBtn").disabled = true;
    return;
  }
  domain = new URL(tab.url).hostname;
  siteLabel.textContent = domain;
  const saved = await chrome.storage.local.get(storageKey(domain));
  const css = saved[storageKey(domain)];
  if (css) {
    cssBox.value = css;
    setStatus("Saved theme loaded — Apply to see it.", "ok");
    // Highlight preset if it matches exactly.
    for (const [name, presetCss] of Object.entries(PRESETS)) {
      if (presetCss === css) { renderPresets(name); break; }
    }
  }
}

document.getElementById("applyBtn").addEventListener("click", async () => {
  const css = cssBox.value.trim();
  if (!css) { setStatus("Write some CSS first.", "err"); return; }
  try {
    await applyCssToTab(css);
    await chrome.storage.local.set({ [storageKey(domain)]: css });
    setStatus("Theme applied to " + domain + ".", "ok");
  } catch (e) {
    setStatus(String(e.message || e), "err");
  }
});

document.getElementById("removeBtn").addEventListener("click", async () => {
  try {
    await removeCssFromTab();
    await chrome.storage.local.remove(storageKey(domain));
    cssBox.value = "";
    renderPresets("");
    setStatus("Theme removed — page restored.", "ok");
  } catch (e) {
    setStatus(String(e.message || e), "err");
  }
});

init();
