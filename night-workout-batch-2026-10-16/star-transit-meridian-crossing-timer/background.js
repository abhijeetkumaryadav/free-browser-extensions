"use strict";
/* Star Transit Timer — background worker: fires the transit notification. */
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name !== "stt-transit") return;
  chrome.storage.local.get({ sttTrack: null }, (r) => {
    const t = r.sttTrack;
    const label = (t && t.name) ? t.name : "your star";
    chrome.notifications.create("stt-transit-now", {
      type: "basic",
      iconUrl: "icons/icon128.png",
      title: "Star transit",
      message: label + " is crossing the meridian now.",
      priority: 2
    });
  });
});
