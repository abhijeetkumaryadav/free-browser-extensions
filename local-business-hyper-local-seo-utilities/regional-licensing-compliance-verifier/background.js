/* LicenseLens background worker — daily renewal reminder checks. */
"use strict";

const THRESHOLDS = [30, 7, 1]; // notify at 30, 7 and 1 day(s) before expiry

chrome.runtime.onInstalled.addListener(() => schedule());
chrome.runtime.onStartup.addListener(() => schedule());
chrome.runtime.onMessage.addListener((msg) => {
  if (msg && msg.type === "reschedule") schedule();
});

async function schedule() {
  await chrome.alarms.clear("renewal-check");
  chrome.alarms.create("renewal-check", { periodInMinutes: 60 * 24 });
  checkRenewals(); // also run once now
}

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "renewal-check") checkRenewals();
});

async function checkRenewals() {
  const { licenses = [], notified = {} } = await chrome.storage.local.get(["licenses", "notified"]);
  const today = new Date().toISOString().slice(0, 10);
  let changed = false;

  for (const lic of licenses) {
    if (!lic.expiry) continue;
    const daysLeft = Math.ceil((new Date(lic.expiry + "T23:59:59") - Date.now()) / 86400000);
    if (!THRESHOLDS.includes(daysLeft)) continue;
    const key = `${lic.id}:${daysLeft}`;
    if (notified[key] === today) continue; // already reminded today

    const when = daysLeft === 1 ? "tomorrow" : `in ${daysLeft} days`;
    await chrome.notifications.create(key, {
      type: "basic",
      iconUrl: "icons/icon48.png",
      title: "License renewal due",
      message: `“${lic.name}” expires ${when} (${lic.expiry}).`,
    });
    notified[key] = today;
    changed = true;
  }
  if (changed) await chrome.storage.local.set({ notified });
}
