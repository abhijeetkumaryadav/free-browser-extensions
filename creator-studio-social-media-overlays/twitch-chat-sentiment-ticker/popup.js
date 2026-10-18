/* Twitch Chat Sentiment Ticker — popup controller.
 * Reads aggregated samples from chrome.storage.local (written by sampler.js)
 * and renders rolling stats. No network, no page mutation. */

const $ = (id) => document.getElementById(id);
const WINDOW_MS = 5 * 60 * 1000; // rolling 5-minute window
const REFRESH_MS = 2000;

let tabId = null;
let isTwitch = false;
let running = false;

/** Get the currently active tab. */
async function activeTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

/** Refresh UI state from storage + tab. */
async function refresh() {
  const store = await chrome.storage.local.get({ twst_samples: [], twst_running: false });
  running = !!store.twst_running;

  // Toggle button state
  const btn = $("toggleBtn");
  btn.disabled = !isTwitch;
  btn.textContent = running ? "Stop sampling" : "Start sampling";
  btn.classList.toggle("stop", running);
  $("liveDot").classList.toggle("on", running);

  const status = $("statusLine");
  if (!isTwitch) {
    status.textContent = "Open a Twitch stream tab, then open this popup again.";
    status.classList.remove("ok");
  } else if (running) {
    status.textContent = "Sampling chat on this stream…";
    status.classList.add("ok");
  } else {
    status.textContent = "Ready. Sampling starts only when you press the button.";
    status.classList.remove("ok");
  }

  renderStats(store.twst_samples || []);
}

/** Compute rolling stats and paint them. */
function renderStats(samples) {
  const cutoff = Date.now() - WINDOW_MS;
  const recent = samples.filter((s) => s.t >= cutoff);

  const scored = recent.filter((s) => s.s !== 0);
  const pos = scored.filter((s) => s.s > 0).length;
  const posPct = scored.length ? Math.round((pos / scored.length) * 100) : null;

  // Messages per minute over the window actually covered by data
  let rate = 0;
  if (recent.length >= 2) {
    const spanMin = Math.max((recent[recent.length - 1].t - recent[0].t) / 60000, 1 / 60);
    rate = recent.length / spanMin;
  } else if (recent.length === 1) {
    rate = 1;
  }

  $("posPct").textContent = posPct === null ? "—" : posPct + "%";
  $("msgRate").textContent = recent.length ? (rate >= 10 ? Math.round(rate) : rate.toFixed(1)) : "—";
  $("sampled").textContent = recent.length;
  $("sentFill").style.width = (posPct === null ? 50 : posPct) + "%";

  // Top emotes
  const counts = {};
  for (const s of recent) {
    for (const e of s.emotes || []) counts[e] = (counts[e] || 0) + 1;
  }
  const top = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const box = $("emotes");
  box.innerHTML = "";
  if (!top.length) {
    box.innerHTML = '<span class="muted">No emotes seen yet.</span>';
  } else {
    for (const [name, n] of top) {
      const chip = document.createElement("span");
      chip.className = "chip";
      chip.textContent = `${name} ×${n}`;
      box.appendChild(chip);
    }
  }
}

/** Start or stop the in-page sampler. */
async function toggle() {
  if (!isTwitch || tabId == null) return;
  const btn = $("toggleBtn");
  btn.disabled = true;
  try {
    if (!running) {
      // Inject the sampler into the Twitch tab (user gesture → activeTab grant)
      await chrome.scripting.executeScript({ target: { tabId }, files: ["sampler.js"] });
      await chrome.storage.local.set({ twst_running: true });
    } else {
      try {
        await chrome.tabs.sendMessage(tabId, { type: "TWST_STOP" });
      } catch {
        /* sampler may already be gone; the flag below is the source of truth */
      }
      await chrome.storage.local.set({ twst_running: false });
    }
  } catch (err) {
    $("statusLine").textContent = "Could not access this tab (" + (err.message || err) + ").";
  }
  await refresh();
}

$("toggleBtn").addEventListener("click", toggle);

(async function init() {
  const tab = await activeTab();
  tabId = tab ? tab.id : null;
  isTwitch = !!tab?.url && /(^|\.)twitch\.tv$/i.test(new URL(tab.url).hostname);
  await refresh();
  setInterval(refresh, REFRESH_MS);
})();
