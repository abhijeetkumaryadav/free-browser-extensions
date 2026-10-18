// Funding Round Notifier — background service worker.
// Fires the follow-up reminder notifications scheduled from the popup.

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (!alarm.name.startsWith("followup:")) return;
  const id = alarm.name.slice("followup:".length);
  try {
    const { companies = [] } = await chrome.storage.local.get("companies");
    const c = companies.find((x) => x.id === id);
    if (!c) return;
    await chrome.notifications.create(`followup-${id}-${Date.now()}`, {
      type: "basic",
      iconUrl: "icons/icon128.png",
      title: "Funding watch: follow-up due",
      message: c.notes ? `${c.name} — ${c.notes.slice(0, 100)}` : `Time to check in on ${c.name}.`,
    });
  } catch (e) {
    // storage unavailable — skip silently
  }
});
