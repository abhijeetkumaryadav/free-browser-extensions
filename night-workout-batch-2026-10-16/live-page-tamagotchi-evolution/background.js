/* =========================================================================
 * TamaBloom — background service worker (owns all pet state)
 *
 * Meters decay on a 5-minute alarm tick plus a catch-up pass whenever the
 * popup (or widget) asks for state, so time passes even while the browser
 * was closed. The pet never dies — neglect just makes it grumpy, and a
 * "Revive with love" button restores it. Friendlier that way.
 * ========================================================================= */

const TICK_MINUTES = 5;
const MAX_CATCHUP_TICKS = 48; /* ~4h of catch-up max */

/** Fresh-pet defaults. */
function defaultState() {
  return {
    name: 'Pixel',
    bornAt: Date.now(),
    lastTick: Date.now(),
    hunger: 80,      /* 0..100 */
    happiness: 80,   /* 0..100 */
    energy: 80,      /* 0..100 */
    sleeping: false,
    poop: 0,         /* 0..3 little messes */
    bond: 0,         /* lifetime care points */
  };
}

/** Life stage (0..4) from age. */
function stageFor(ageMin) {
  if (ageMin < 30) return 0;    /* Egg */
  if (ageMin < 120) return 1;   /* Baby */
  if (ageMin < 360) return 2;   /* Child */
  if (ageMin < 720) return 3;   /* Teen */
  return 4;                     /* Adult */
}

/** Mood string from meters. */
function moodFor(s) {
  if (s.sleeping) return 'sleepy';
  if (s.hunger <= 0 && s.happiness <= 0 && s.energy <= 0) return 'grumpy';
  if (s.hunger < 25 || s.happiness < 25 || s.energy < 25) return 'sad';
  const avg = (s.hunger + s.happiness + s.energy) / 3;
  return avg >= 70 ? 'happy' : 'neutral';
}

const clamp = (v) => Math.max(0, Math.min(100, Math.round(v)));

/** Apply decay for elapsed time. Mutates and returns s. */
function applyTick(s, now) {
  const elapsedMin = Math.max(0, (now - (s.lastTick || now)) / 60000);
  const ticks = Math.min(MAX_CATCHUP_TICKS, Math.floor(elapsedMin / TICK_MINUTES));
  for (let i = 0; i < ticks; i++) {
    if (s.sleeping) {
      s.energy = clamp(s.energy + 9);
      s.hunger = clamp(s.hunger - 1);
    } else {
      s.hunger = clamp(s.hunger - 3);
      s.happiness = clamp(s.happiness - 2 - s.poop * 2); /* messes drag mood down */
      s.energy = clamp(s.energy - 2);
    }
    if (Math.random() < 0.12 && s.poop < 3) s.poop += 1;
  }
  s.lastTick = now;
  return s;
}

async function loadState() {
  const stored = await chrome.storage.local.get(defaultState());
  /* Fill any missing keys (forward-compat) */
  return Object.assign(defaultState(), stored);
}

async function saveState(s) {
  await chrome.storage.local.set(s);
}

/** Enrich raw state with derived fields for the UI. */
function enrich(s, now) {
  const ageMin = Math.max(0, (now - s.bornAt) / 60000);
  return Object.assign({}, s, {
    stage: stageFor(ageMin),
    mood: moodFor(s),
    ageMin,
  });
}

/* ------------------------------- actions ------------------------------ */

function doAction(s, action) {
  switch (action) {
    case 'feed':
      if (s.hunger > 92) s.happiness = clamp(s.happiness - 5); /* overfed! */
      else s.happiness = clamp(s.happiness + 2);
      s.hunger = clamp(s.hunger + 18);
      s.bond += 2;
      break;
    case 'play':
      if (!s.sleeping) {
        s.happiness = clamp(s.happiness + 15);
        s.energy = clamp(s.energy - 8);
        s.hunger = clamp(s.hunger - 4);
        s.bond += 3;
      }
      break;
    case 'clean':
      if (s.poop > 0) { s.poop = 0; s.happiness = clamp(s.happiness + 8); s.bond += 1; }
      break;
    case 'sleep':
      s.sleeping = !s.sleeping;
      s.bond += 1;
      break;
    case 'revive':
      s.hunger = 55; s.happiness = 55; s.energy = 55; s.poop = 0; s.sleeping = false;
      break;
    case 'rename':
      break; /* handled with payload */
  }
  return s;
}

/* -------------------------------- events ------------------------------- */

chrome.runtime.onInstalled.addListener(async () => {
  await saveState(defaultState());
  chrome.alarms.create('tama-tick', { periodInMinutes: TICK_MINUTES });
});

chrome.runtime.onStartup.addListener(async () => {
  const s = await loadState();
  await saveState(applyTick(s, Date.now()));
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== 'tama-tick') return;
  const s = await loadState();
  await saveState(applyTick(s, Date.now()));
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  (async () => {
    if (msg.type === 'getState') {
      const s = await loadState();
      sendResponse({ ok: true, state: enrich(applyTick(s, Date.now()), Date.now()) });
      await saveState(s);
    } else if (msg.type === 'action') {
      const s = await loadState();
      applyTick(s, Date.now());
      if (msg.action === 'rename' && typeof msg.name === 'string') {
        s.name = msg.name.slice(0, 16) || 'Pixel';
      } else {
        doAction(s, msg.action);
      }
      await saveState(s);
      sendResponse({ ok: true, state: enrich(s, Date.now()) });
    }
  })();
  return true; /* async response */
}
);
