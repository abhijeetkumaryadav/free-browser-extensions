// Desk Yoga — popup logic: settings form + stretch preview.
// The bundled list mirrors background.js (kept in sync manually).

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

const enabledEl = document.getElementById("enabled");
const intervalEl = document.getElementById("interval");
const previewBtn = document.getElementById("preview");
const card = document.getElementById("stretchCard");
const nameEl = document.getElementById("stretchName");
const howEl = document.getElementById("stretchHow");

// Load current settings into the form.
async function load() {
  const { enabled = true, intervalMin = 45 } =
    await chrome.storage.local.get(["enabled", "intervalMin"]);
  enabledEl.checked = enabled;
  intervalEl.value = intervalMin;
}

// Clamp interval and persist. The background re-schedules via storage.onChanged.
async function save() {
  const intervalMin = Math.max(5, Math.min(240, Number(intervalEl.value) || 45));
  intervalEl.value = intervalMin;
  await chrome.storage.local.set({ enabled: enabledEl.checked, intervalMin });
}

enabledEl.addEventListener("change", save);
intervalEl.addEventListener("change", save);

// Preview shows one random stretch without scheduling anything.
previewBtn.addEventListener("click", () => {
  const s = STRETCHES[Math.floor(Math.random() * STRETCHES.length)];
  nameEl.textContent = s.name;
  howEl.textContent = s.how;
  card.classList.remove("hidden");
});

load();
