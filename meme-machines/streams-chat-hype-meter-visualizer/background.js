/* HypeMeter background — handles the log-hype hotkey even when the popup is closed. */
// Hype level: sum of exponentially-decaying contributions (tau = 20s),
// each tap worth 25 points, capped at 100.
function hypeLevel(events, now) {
  let l = 0;
  for (const t of events) {
    const age = (now - t) / 1000;
    if (age >= 0 && age < 300) l += 25 * Math.exp(-age / 20);
  }
  return Math.min(100, Math.round(l));
}

async function logHype() {
  const data = await chrome.storage.local.get({ hm_events: [], hm_session: null });
  const events = data.hm_events;
  events.push(Date.now());
  while (events.length > 3000) events.shift();
  await chrome.storage.local.set({ hm_events: events });
  // Show the live level on the toolbar badge for a glanceable readout.
  const level = hypeLevel(events, Date.now());
  await chrome.action.setBadgeText({ text: level > 0 ? String(level) : '' });
  await chrome.action.setBadgeBackgroundColor({ color: '#ec4899' });
}

chrome.commands.onCommand.addListener(cmd => {
  if (cmd === 'log-hype') logHype();
});

// Clear a stale badge when the browser starts.
chrome.runtime.onStartup.addListener(() => chrome.action.setBadgeText({ text: '' }));
