// Tab Terrarium — background service worker.
// Owns plant state; a 5-minute alarm advances growth in real time.
// Catch-up math means growth is correct even if the browser was closed.

const STORE_KEY = 'terrarium';
const ALARM_NAME = 'terrarium-tick';
const TICK_MS = 5 * 60 * 1000;

function freshState() {
  return {
    stage: 0,          // 0 seed · 1 sprout · 2 sapling · 3 budding · 4 bloom
    growth: 0,         // 0–100
    water: 60,         // 0–100
    lastTick: Date.now(),
    stats: { waters: 0, feeds: 0, plantedAt: Date.now() }
  };
}

async function load() {
  const res = await chrome.storage.local.get(STORE_KEY);
  return Object.assign(freshState(), res[STORE_KEY] || {});
}

async function save(s) {
  await chrome.storage.local.set({ [STORE_KEY]: s });
}

/** Advance one tick: water evaporates; growth depends on hydration. */
function applyTick(s) {
  s.water = Math.max(0, s.water - 8);
  s.growth = Math.min(100, s.growth + (s.water > 20 ? 6 : 1));
  s.stage = Math.min(4, Math.floor(s.growth / 25));
  s.lastTick = Date.now();
}

/** Catch up on missed ticks (browser was closed / worker slept). */
async function catchUp() {
  const s = await load();
  const missed = Math.floor((Date.now() - s.lastTick) / TICK_MS);
  for (let i = 0; i < Math.min(missed, 288); i++) applyTick(s); // cap: 24h
  if (missed > 0) { s.lastTick = Date.now(); await save(s); }
}

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== ALARM_NAME) return;
  const s = await load();
  applyTick(s);
  await save(s);
});

chrome.runtime.onInstalled.addListener(async () => {
  chrome.alarms.create(ALARM_NAME, { periodInMinutes: 5 });
  const s = await load();
  await save(s);
});

chrome.runtime.onStartup.addListener(async () => {
  chrome.alarms.create(ALARM_NAME, { periodInMinutes: 5 });
  await catchUp();
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  (async () => {
    await catchUp();
    const s = await load();
    if (msg.type === 'getState') {
      sendResponse(s);
    } else if (msg.type === 'water') {
      s.water = Math.min(100, s.water + 35);
      s.stats.waters += 1;
      await save(s);
      sendResponse({ ok: true, state: s });
    } else if (msg.type === 'feed') {
      if (s.water <= 10) {
        sendResponse({ ok: false, reason: 'Too dry — water first.' });
      } else {
        s.growth = Math.min(100, s.growth + 12);
        s.stage = Math.min(4, Math.floor(s.growth / 25));
        s.stats.feeds += 1;
        await save(s);
        sendResponse({ ok: true, state: s });
      }
    } else if (msg.type === 'replant') {
      const fresh = freshState();
      await save(fresh);
      sendResponse({ ok: true, state: fresh });
    }
  })();
  return true;
});
