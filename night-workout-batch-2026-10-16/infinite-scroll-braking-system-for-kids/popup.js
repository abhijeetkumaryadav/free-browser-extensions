// BrakeTime popup logic — kid dashboard + PIN-gated parent settings.
// All data lives in chrome.storage.local. Nothing leaves the device.

const $ = (id) => document.getElementById(id);

const DEFAULTS = {
  brakePx: 15000,          // scroll distance per brake
  brakeSec: 8,             // overlay countdown seconds
  sessionMin: 30,          // gentle reminder interval (0 = off)
  domains: ["youtube.com", "tiktok.com", "instagram.com", "roblox.com"],
  pinHash: null,           // SHA-256 hex of 4-digit PIN; null = not set yet
  stats: { scrollPx: 0, brakes: 0, sessionSec: 0, day: null }
};

async function sha256hex(str) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function loadState() {
  const s = await chrome.storage.local.get(DEFAULTS);
  return { ...DEFAULTS, ...s };
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

// ---------- views ----------
function show(id) {
  ["kidView", "pinView", "parentView"].forEach((v) => $(v).classList.toggle("hidden", v !== id));
}

// ---------- kid dashboard ----------
async function renderKid() {
  const s = await loadState();
  // roll stats over at midnight
  if (s.stats.day !== todayKey()) {
    s.stats = { scrollPx: 0, brakes: 0, sessionSec: 0, day: todayKey() };
    await chrome.storage.local.set({ stats: s.stats });
  }
  $("scrollPx").textContent = Math.round(s.stats.scrollPx).toLocaleString();
  $("brakeCount").textContent = s.stats.brakes;
  $("sessionMin").textContent = Math.round(s.stats.sessionSec / 60);
}

// ---------- PIN gate ----------
$("openParent").addEventListener("click", async () => {
  const s = await loadState();
  $("pinInput").value = "";
  $("pinMsg").textContent = "";
  show("pinView");
  // if no PIN set yet, the "PIN" is just creating one
  if (!s.pinHash) $("pinMsg").textContent = "No PIN yet — enter any 4 digits to create it.";
});

$("pinCancel").addEventListener("click", () => show("kidView"));

$("pinOk").addEventListener("click", async () => {
  const s = await loadState();
  const pin = $("pinInput").value.trim();
  if (!/^\d{4}$/.test(pin)) { $("pinMsg").textContent = "PIN must be 4 digits."; return; }
  const h = await sha256hex("braketime:" + pin);
  if (!s.pinHash) {
    await chrome.storage.local.set({ pinHash: h });
    openParent(s);
  } else if (h === s.pinHash) {
    openParent(s);
  } else {
    $("pinMsg").textContent = "Wrong PIN — try again.";
  }
});

// ---------- parent settings ----------
function renderDomains(list) {
  const box = $("domainList");
  box.innerHTML = "";
  list.forEach((d) => {
    const chip = document.createElement("span");
    chip.className = "chip";
    chip.textContent = d;
    const x = document.createElement("button");
    x.textContent = "×";
    x.title = "Remove";
    x.addEventListener("click", () => {
      const cur = [...$("domainList").querySelectorAll(".chip")].map((c) => c.firstChild.textContent);
      renderDomains(cur.filter((v) => v !== d));
    });
    chip.appendChild(x);
    box.appendChild(chip);
  });
}

function currentDomains() {
  return [...$("domainList").querySelectorAll(".chip")].map((c) => c.firstChild.textContent);
}

async function openParent(s) {
  s = s || await loadState();
  $("setBrakePx").value = s.brakePx;
  $("setBrakeSec").value = s.brakeSec;
  $("setSessionMin").value = s.sessionMin;
  renderDomains(s.domains);
  $("newPin").value = "";
  $("saveMsg").textContent = "";
  show("parentView");
}

$("addDomain").addEventListener("click", () => {
  const v = $("newDomain").value.trim().toLowerCase().replace(/^https?:\/\//, "").split("/")[0];
  if (!v) return;
  const cur = currentDomains();
  if (!cur.includes(v)) { cur.push(v); renderDomains(cur); }
  $("newDomain").value = "";
});

$("setPin").addEventListener("click", async () => {
  const pin = $("newPin").value.trim();
  if (!/^\d{4}$/.test(pin)) { $("saveMsg").textContent = "PIN must be 4 digits."; return; }
  await chrome.storage.local.set({ pinHash: await sha256hex("braketime:" + pin) });
  $("saveMsg").textContent = "PIN updated.";
});

$("saveSettings").addEventListener("click", async () => {
  await chrome.storage.local.set({
    brakePx: Math.max(1000, parseInt($("setBrakePx").value, 10) || DEFAULTS.brakePx),
    brakeSec: Math.min(120, Math.max(3, parseInt($("setBrakeSec").value, 10) || DEFAULTS.brakeSec)),
    sessionMin: Math.min(240, Math.max(0, parseInt($("setSessionMin").value, 10) || 0)),
    domains: currentDomains()
  });
  $("saveMsg").textContent = "Saved — brakes apply on the next page load.";
});

$("resetStats").addEventListener("click", async () => {
  await chrome.storage.local.set({ stats: { scrollPx: 0, brakes: 0, sessionSec: 0, day: todayKey() } });
  $("saveMsg").textContent = "Today's stats reset.";
});

$("lockBtn").addEventListener("click", () => { show("kidView"); renderKid(); });

document.addEventListener("DOMContentLoaded", renderKid);
