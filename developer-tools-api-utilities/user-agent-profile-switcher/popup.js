// User-Agent Profile Switcher — popup logic.
// Applies the chosen UA via declarativeNetRequest modifyHeaders on
// main-frame requests, ONLY for sites the user explicitly enables.
// All state stays in chrome.storage.local.

const RULE_ID = 1;

const PROFILES = [
  { id: "chrome-win", name: "Chrome · Windows",
    ua: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" },
  { id: "safari-iphone", name: "Safari · iPhone",
    ua: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1" },
  { id: "firefox-linux", name: "Firefox · Linux",
    ua: "Mozilla/5.0 (X11; Linux x86_64; rv:121.0) Gecko/20100101 Firefox/121.0" },
  { id: "googlebot", name: "Googlebot",
    ua: "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)" },
  { id: "custom", name: "Custom", ua: "" },
];

const $ = (id) => document.getElementById(id);
const DEFAULTS = { enabled: false, profileId: "chrome-win", customUa: "", sites: [] };

document.addEventListener("DOMContentLoaded", init);

async function init() {
  $("master").addEventListener("change", async () => {
    const s = await getState();
    s.enabled = $("master").checked;
    await setState(s);
    await applyRules();
    render();
  });
  $("saveCustom").addEventListener("click", async () => {
    const v = $("customUa").value.trim();
    if (!v) return;
    const s = await getState();
    s.customUa = v; s.profileId = "custom";
    await setState(s);
    await applyRules();
    render();
  });
  $("addSite").addEventListener("click", addCurrentSite);
  $("reset").addEventListener("click", resetAll);
  render();
}

async function getState() {
  const s = await chrome.storage.local.get(DEFAULTS);
  return { ...DEFAULTS, ...s };
}
async function setState(s) { await chrome.storage.local.set(s); }

function activeUa(s) {
  const p = PROFILES.find((x) => x.id === s.profileId);
  return s.profileId === "custom" ? s.customUa : (p ? p.ua : "");
}

// Rebuild the single dynamic rule from current state.
async function applyRules() {
  const s = await getState();
  const ua = activeUa(s);
  await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: [RULE_ID] });
  if (s.enabled && s.sites.length && ua) {
    await chrome.declarativeNetRequest.updateDynamicRules({
      addRules: [{
        id: RULE_ID,
        priority: 1,
        action: {
          type: "modifyHeaders",
          requestHeaders: [{ header: "user-agent", operation: "set", value: ua }],
        },
        condition: {
          urlFilter: "|http*",
          resourceTypes: ["main_frame"],
          requestDomains: s.sites,
        },
      }],
    });
  }
}

function profileName(s) {
  const p = PROFILES.find((x) => x.id === s.profileId);
  return p ? p.name : "Custom";
}

async function render() {
  const s = await getState();
  $("master").checked = s.enabled;
  const rules = await chrome.declarativeNetRequest.getDynamicRules();
  const active = rules.some((r) => r.id === RULE_ID);
  $("status").textContent = active
    ? `Active · ${profileName(s)} on ${s.sites.length} site${s.sites.length === 1 ? "" : "s"}`
    : "Off";

  // profiles
  const box = $("profiles");
  box.innerHTML = "";
  for (const p of PROFILES) {
    const ua = p.id === "custom" ? s.customUa : p.ua;
    const row = document.createElement("label");
    row.className = "prof" + (s.profileId === p.id ? " sel" : "");
    const radio = document.createElement("input");
    radio.type = "radio"; radio.name = "profile";
    radio.checked = s.profileId === p.id;
    radio.addEventListener("change", async () => {
      const cur = await getState();
      if (p.id === "custom" && !cur.customUa) {
        $("customUa").focus();
        return;
      }
      cur.profileId = p.id;
      await setState(cur);
      await applyRules();
      render();
    });
    const meta = document.createElement("div");
    meta.className = "meta";
    const nm = document.createElement("div"); nm.className = "nm"; nm.textContent = p.name;
    const uad = document.createElement("div"); uad.className = "ua";
    uad.textContent = ua || "— set a custom string below —";
    meta.append(nm, uad);
    row.append(radio, meta);
    box.appendChild(row);
  }
  if ($("customUa").value !== s.customUa) $("customUa").value = s.customUa;

  // sites
  const sbox = $("sites");
  sbox.innerHTML = "";
  if (!s.sites.length) {
    const d = document.createElement("div");
    d.className = "empty-sites";
    d.textContent = "No sites enabled yet.";
    sbox.appendChild(d);
  }
  for (const dom of s.sites) {
    const row = document.createElement("div");
    row.className = "site";
    const dot = document.createElement("div"); dot.className = "dot";
    const sp = document.createElement("span"); sp.textContent = dom;
    const x = document.createElement("button"); x.textContent = "×"; x.title = "Remove site";
    x.addEventListener("click", async () => {
      const cur = await getState();
      cur.sites = cur.sites.filter((d) => d !== dom);
      await setState(cur);
      try { await chrome.permissions.remove({ origins: [`*://${dom}/*`] }); } catch (e) {}
      await applyRules();
      render();
    });
    row.append(dot, sp, x);
    sbox.appendChild(row);
  }
}

async function addCurrentSite() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.url) return;
  let dom;
  try { dom = new URL(tab.url).hostname; }
  catch (e) { return; }
  if (!dom || dom === "newtab" || dom.endsWith(".newtab")) return;
  const origin = `*://${dom}/*`;
  const granted = await chrome.permissions.request({ origins: [origin] });
  if (!granted) return;
  const s = await getState();
  if (!s.sites.includes(dom)) {
    s.sites.push(dom);
    s.enabled = true;
    await setState(s);
    await applyRules();
  }
  render();
}

async function resetAll() {
  const s = await getState();
  for (const dom of s.sites) {
    try { await chrome.permissions.remove({ origins: [`*://${dom}/*`] }); } catch (e) {}
  }
  await chrome.storage.local.set({ enabled: false, sites: [] });
  await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: [RULE_ID] });
  render();
}
