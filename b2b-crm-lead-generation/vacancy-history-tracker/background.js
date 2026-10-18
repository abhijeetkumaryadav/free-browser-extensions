// Vacancy History Tracker — service worker.
// Fires follow-up reminders scheduled with chrome.alarms.

const ACTIVE = ["saved", "applied", "interview"];

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (!alarm.name.startsWith("fu-")) return;
  const jobId = alarm.name.slice(3);
  const { jobs = [] } = await chrome.storage.local.get("jobs");
  const job = jobs.find((j) => j.id === jobId);
  if (!job || !ACTIVE.includes(job.status)) return;
  chrome.notifications.create("fu-" + jobId + "-" + Date.now(), {
    type: "basic",
    iconUrl: chrome.runtime.getURL("icons/icon48.png"),
    title: "Follow-up reminder",
    message: `Time to follow up on "${job.title}" at ${job.company}.`,
  });
});

// Re-schedule alarms after install/update/restart so reminders survive.
async function reschedule() {
  const { jobs = [] } = await chrome.storage.local.get("jobs");
  for (const job of jobs) {
    if (!job.followUp || !ACTIVE.includes(job.status)) continue;
    const when = new Date(job.followUp + "T09:00:00").getTime();
    if (when > Date.now()) {
      try { await chrome.alarms.create("fu-" + job.id, { when }); } catch (e) {}
    }
  }
}
chrome.runtime.onInstalled.addListener(reschedule);
chrome.runtime.onStartup.addListener(reschedule);
