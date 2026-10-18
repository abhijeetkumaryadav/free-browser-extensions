/* Stretch Prompt — background worker: watches idle state and nudges. */
const NOTIF_ID = "stretch-prompt-nudge";

async function refreshSchedule() {
  const { enabled = false, threshold = 600 } = await chrome.storage.local.get({
    enabled: false, threshold: 600,
  });
  if (enabled) {
    // chrome.idle fires when the user is inactive for `threshold` seconds.
    chrome.idle.setDetectionInterval(Number(threshold));
  }
}

chrome.runtime.onInstalled.addListener(refreshSchedule);
chrome.runtime.onStartup.addListener(refreshSchedule);
chrome.runtime.onMessage.addListener((msg) => {
  if (msg && msg.type === "refresh-schedule") refreshSchedule();
});

// Fires when the user goes idle (no keyboard/mouse input).
chrome.idle.onStateChanged.addListener(async (state) => {
  if (state !== "idle") return;
  const { enabled = false, promptPending = false } = await chrome.storage.local.get({
    enabled: false, promptPending: false,
  });
  if (!enabled || promptPending) return;
  await chrome.storage.local.set({ promptPending: true });
  chrome.notifications.create(NOTIF_ID, {
    type: "basic",
    iconUrl: "icons/icon128.png",
    title: "Time to stretch?",
    message: "You've been still a while — open me for a quick 2-minute stretch routine.",
    buttons: [{ title: "Later" }],
  });
});

// "Later" button or dismissal drops the pending prompt.
chrome.notifications.onButtonClicked.addListener((id) => {
  if (id === NOTIF_ID) {
    chrome.storage.local.set({ promptPending: false });
    chrome.notifications.clear(NOTIF_ID);
  }
});
chrome.notifications.onClosed.addListener((id) => {
  if (id === NOTIF_ID) chrome.storage.local.set({ promptPending: false });
});
