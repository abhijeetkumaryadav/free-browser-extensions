// Queue Position Notifier — service worker.
// Fires the notification when a drop-time alarm goes off, and opens the
// product page when the notification is clicked.

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (!alarm.name.startsWith("drop-")) return;
  const id = alarm.name.slice(5);
  const { drops = [] } = await chrome.storage.local.get("drops");
  const drop = drops.find((d) => d.id === id);
  if (!drop) return;

  await chrome.notifications.create(alarm.name, {
    type: "basic",
    iconUrl: "icons/icon128.png",
    title: "It's drop time!",
    message: drop.name,
    contextMessage: drop.host || undefined,
  });
  chrome.action.setBadgeText({ text: "•" });
  chrome.action.setBadgeBackgroundColor({ color: "#f59e0b" });

  drop.fired = true;
  await chrome.storage.local.set({ drops });
});

chrome.notifications.onClicked.addListener(async (notifId) => {
  if (!notifId.startsWith("drop-")) return;
  const id = notifId.slice(5);
  const { drops = [] } = await chrome.storage.local.get("drops");
  const drop = drops.find((d) => d.id === id);
  if (drop && drop.url) chrome.tabs.create({ url: drop.url });
  chrome.notifications.clear(notifId);
});

// Clear the badge once the user opens the popup and sees their reminders.
chrome.runtime.onMessage.addListener((msg) => {
  if (msg && msg.type === "badge-seen") {
    chrome.action.setBadgeText({ text: "" });
  }
});
