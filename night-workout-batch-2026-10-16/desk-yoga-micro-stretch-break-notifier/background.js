// Desk Yoga — Micro-Stretch Break Notifier (background service worker)
// Schedules break alarms and shows a notification with a random desk stretch.
// Fully local: no network, no analytics. Reminders only — not medical advice.

// ---------------------------------------------------------------------------
// Bundled stretch list. Gentle desk-friendly moves only. No medical claims.
// ---------------------------------------------------------------------------
const STRETCHES = [
  { name: "Neck Rolls", how: "Slowly roll your head in a circle, 3 times each way. Keep shoulders relaxed." },
  { name: "Shoulder Shrugs", how: "Lift shoulders to your ears, hold 3 seconds, drop. Repeat 5 times." },
  { name: "Wrist Circles", how: "Extend your arms and circle your wrists, 10 each direction." },
  { name: "Seated Twist", how: "Sit tall, twist gently to the right holding your chair, hold 20 seconds. Repeat left." },
  { name: "Chest Opener", how: "Clasp hands behind your back, squeeze shoulder blades, hold 20 seconds." },
  { name: "Ankle Circles", how: "Lift one foot and circle the ankle, 10 each way. Switch feet." },
  { name: "Seated Cat-Cow", how: "Round your back (chin to chest), then arch (look up). Repeat 6 times slowly." },
  { name: "Side Bend", how: "Raise one arm overhead and lean gently to the opposite side, 20 seconds each." },
  { name: "Finger Spreads", how: "Spread fingers wide, hold 5 seconds, make a fist. Repeat 8 times." },
  { name: "Chin Tucks", how: "Pull your chin straight back (make a double chin), hold 5 seconds. Repeat 5 times." },
  { name: "Glute Squeezes", how: "Squeeze your glutes tightly for 5 seconds, release. Repeat 10 times." },
  { name: "Calf Raises", how: "Stand behind your chair and rise onto your toes, 15 reps." }
];

const ALARM_NAME = "desk-yoga-break";
const DEFAULTS = { enabled: true, intervalMin: 45, lastShown: 0 };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
async function getSettings() {
  const stored = await chrome.storage.local.get(Object.keys(DEFAULTS));
  return { ...DEFAULTS, ...stored };
}

// Schedule (or clear) the repeating break alarm from current settings.
async function scheduleAlarm() {
  await chrome.alarms.clear(ALARM_NAME);
  const { enabled, intervalMin } = await getSettings();
  if (!enabled) return;
  const minutes = Math.max(5, Math.min(240, Number(intervalMin) || 45));
  await chrome.alarms.create(ALARM_NAME, { periodInMinutes: minutes });
}

// ---------------------------------------------------------------------------
// Alarm + notification flow
// ---------------------------------------------------------------------------
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== ALARM_NAME) return;
  const stretch = STRETCHES[Math.floor(Math.random() * STRETCHES.length)];
  await chrome.storage.local.set({ lastShown: Date.now() });
  await chrome.notifications.create("desk-yoga-break-now", {
    type: "basic",
    iconUrl: "icons/icon128.png",
    title: "Time for a micro-stretch break",
    message: `${stretch.name}: ${stretch.how}`,
    buttons: [{ title: "Snooze 10 min" }],
    requireInteraction: false
  });
});

// Snooze button reschedules a one-shot alarm 10 minutes out.
chrome.notifications.onButtonClicked.addListener(async (id, btnIdx) => {
  if (id !== "desk-yoga-break-now" || btnIdx !== 0) return;
  await chrome.alarms.clear(ALARM_NAME);
  await chrome.alarms.create(ALARM_NAME, { when: Date.now() + 10 * 60 * 1000 });
  const { intervalMin } = await getSettings();
  // Resume the normal cadence after the snooze fires.
  setTimeout(() => scheduleAlarm(), 10 * 60 * 1000 + 1000);
});

// ---------------------------------------------------------------------------
// Lifecycle: install + settings changes
// ---------------------------------------------------------------------------
chrome.runtime.onInstalled.addListener(async () => {
  await chrome.storage.local.set({ ...DEFAULTS });
  await scheduleAlarm();
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && (changes.enabled || changes.intervalMin)) {
    scheduleAlarm();
  }
});
