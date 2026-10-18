/* Popup settings for Idle Motivation New Tab. */
const $ = (id) => document.getElementById(id);

async function load() {
  const s = await chrome.storage.local.get({ enabled: true, idleMinutes: 15 });
  $("enabled").checked = s.enabled;
  $("idleMinutes").value = s.idleMinutes;
}

$("enabled").addEventListener("change", (e) => {
  chrome.storage.local.set({ enabled: e.target.checked });
});

$("idleMinutes").addEventListener("change", (e) => {
  const v = Math.min(120, Math.max(5, parseInt(e.target.value, 10) || 15));
  e.target.value = v;
  chrome.storage.local.set({ idleMinutes: v });
});

load();
