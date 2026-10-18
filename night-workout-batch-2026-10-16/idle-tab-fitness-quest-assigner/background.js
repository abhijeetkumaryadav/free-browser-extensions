/* Idle Quest Assigner — service worker.
 * Watches chrome.idle state; when the browser goes idle it assigns one
 * gentle movement quest via a notification. Nothing runs on a schedule,
 * nothing leaves the browser. */

// Bundled list of gentle, equipment-free movement quests.
const QUESTS = [
  "Stand up and stretch your arms overhead for 30 seconds.",
  "Do 10 bodyweight squats.",
  "Walk to get a glass of water.",
  "Roll your shoulders back 10 times.",
  "Do a 30-second wall sit.",
  "Stretch your neck side to side, 5 each way.",
  "Do 10 push-ups (knees are fine).",
  "March in place for 1 minute.",
  "Touch your toes and hang for 20 seconds.",
  "Do 20 seconds of jumping jacks.",
  "Take 5 deep breaths with your arms raised.",
  "Do a 20-second plank."
];

const DEFAULTS = {
  enabled: true,      // master toggle
  idleMinutes: 15,    // chrome.idle detection interval
  lastQuestAt: 0,     // timestamp of last assigned quest
  pendingQuest: "",    // quest text of the live notification
  doneLog: []         // [{ quest, at }]
};

/** Read settings merged over defaults. */
async function getState() {
  return chrome.storage.local.get(DEFAULTS);
}

/** Pick a random quest and show it as a notification. */
async function assignQuest() {
  const quest = QUESTS[Math.floor(Math.random() * QUESTS.length)];
  await chrome.storage.local.set({ lastQuestAt: Date.now(), pendingQuest: quest });
  chrome.notifications.create("idle-quest", {
    type: "basic",
    iconUrl: "icons/icon128.png",
    title: "Movement quest",
    message: quest,
    buttons: [{ title: "Mark done" }]
  });
}

chrome.runtime.onInstalled.addListener(async () => {
  const cur = await chrome.storage.local.get(DEFAULTS);
  const merged = Object.assign({}, DEFAULTS, cur);
  await chrome.storage.local.set(merged);
  chrome.idle.setDetectionInterval(merged.idleMinutes * 60);
});

chrome.runtime.onStartup.addListener(async () => {
  const s = await getState();
  chrome.idle.setDetectionInterval(s.idleMinutes * 60);
});

// Keep the idle detection interval in sync with the user's setting.
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.idleMinutes) {
    chrome.idle.setDetectionInterval(changes.idleMinutes.newValue * 60);
  }
});

// Fire one quest per idle window — never more than one per threshold period.
chrome.idle.onStateChanged.addListener(async (state) => {
  if (state !== "idle") return;
  const s = await getState();
  if (!s.enabled) return;
  if (Date.now() - s.lastQuestAt < s.idleMinutes * 60 * 1000) return;
  assignQuest();
});

// "Mark done" logs the quest with a timestamp.
chrome.notifications.onButtonClicked.addListener(async (id, btn) => {
  if (id !== "idle-quest" || btn !== 0) return;
  const s = await getState();
  const log = s.doneLog.slice(-99);
  if (s.pendingQuest) log.push({ quest: s.pendingQuest, at: Date.now() });
  await chrome.storage.local.set({ doneLog: log, pendingQuest: "" });
  chrome.notifications.clear(id);
});

// Manual test trigger from the popup.
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "TEST_QUEST") assignQuest();
});
