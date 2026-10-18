/* PingPlot background service worker.
 * Runs periodic HTTP latency checks via chrome.alarms + fetch timing.
 * Honest scope: HTTP(S) request latency only — browsers cannot do ICMP ping.
 */

const ALARM_NAME = 'pingplot-check';
const MAX_SAMPLES = 288; // keep ~24h at 5-min cadence

/** Load persisted config. */
async function getConfig() {
  const d = await chrome.storage.local.get(['pingplot']);
  return d.pingplot || null;
}

/** Save persisted config. */
async function setConfig(cfg) {
  await chrome.storage.local.set({ pingplot: cfg });
}

/** Perform one timed HTTP check. Returns {ok, latencyMs, status, at}. */
async function doCheck(url) {
  const started = performance.now();
  try {
    // HEAD keeps it light; fall back to GET if the server rejects HEAD.
    let res = await fetch(url, { method: 'HEAD', cache: 'no-store', redirect: 'follow' });
    if (res.status === 405 || res.status === 501) {
      res = await fetch(url, { method: 'GET', cache: 'no-store', redirect: 'follow' });
    }
    const latency = Math.round(performance.now() - started);
    const ok = res.ok; // 2xx counts as up
    return { ok, latencyMs: latency, status: res.status, at: Date.now() };
  } catch (e) {
    return { ok: false, latencyMs: null, status: 0, at: Date.now(), error: String(e && e.message || e) };
  }
}

/** Append a sample, update uptime stats, maybe notify on status change. */
async function recordSample(sample) {
  const cfg = await getConfig();
  if (!cfg || !cfg.monitoring) return; // stopped meanwhile
  cfg.samples = cfg.samples || [];
  cfg.samples.push(sample);
  if (cfg.samples.length > MAX_SAMPLES) cfg.samples = cfg.samples.slice(-MAX_SAMPLES);

  // Status-change detection → optional desktop notification.
  const prev = cfg.lastOk;
  if (prev !== undefined && prev !== sample.ok && cfg.notify) {
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon48.png',
      title: sample.ok ? 'PingPlot: site is back UP' : 'PingPlot: site is DOWN',
      message: `${cfg.url} → ${sample.ok ? 'HTTP ' + sample.status : 'unreachable'}`
    });
  }
  cfg.lastOk = sample.ok;
  cfg.lastCheck = sample.at;
  await setConfig(cfg);
}

// Alarm fires on schedule → run one check.
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== ALARM_NAME) return;
  const cfg = await getConfig();
  if (!cfg || !cfg.monitoring) return;
  const sample = await doCheck(cfg.url);
  await recordSample(sample);
});

// Re-arm the alarm if the browser restarts mid-monitoring.
chrome.runtime.onStartup.addListener(async () => {
  const cfg = await getConfig();
  if (cfg && cfg.monitoring) {
    chrome.alarms.create(ALARM_NAME, { periodInMinutes: cfg.intervalMin });
  }
});
chrome.runtime.onInstalled.addListener(async () => {
  const cfg = await getConfig();
  if (cfg && cfg.monitoring) {
    chrome.alarms.create(ALARM_NAME, { periodInMinutes: cfg.intervalMin });
  }
});

// Messages from the popup: start / stop / check-now / get-state.
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  (async () => {
    if (msg.type === 'start') {
      const cfg = (await getConfig()) || {};
      cfg.url = msg.url;
      cfg.intervalMin = msg.intervalMin;
      cfg.notify = msg.notify;
      cfg.monitoring = true;
      cfg.samples = cfg.samples || [];
      await setConfig(cfg);
      chrome.alarms.create(ALARM_NAME, { periodInMinutes: msg.intervalMin });
      const sample = await doCheck(msg.url); // immediate first check
      await recordSample(sample);
      sendResponse({ ok: true });
    } else if (msg.type === 'stop') {
      const cfg = (await getConfig()) || {};
      cfg.monitoring = false;
      await setConfig(cfg);
      await chrome.alarms.clear(ALARM_NAME);
      sendResponse({ ok: true });
    } else if (msg.type === 'check-now') {
      const cfg = await getConfig();
      if (cfg && cfg.monitoring) {
        const sample = await doCheck(cfg.url);
        await recordSample(sample);
        sendResponse({ ok: true, sample });
      } else {
        sendResponse({ ok: false });
      }
    } else if (msg.type === 'get-state') {
      sendResponse({ cfg: await getConfig() });
    } else if (msg.type === 'clear-log') {
      const cfg = (await getConfig()) || {};
      cfg.samples = [];
      cfg.lastOk = undefined;
      await setConfig(cfg);
      sendResponse({ ok: true });
    }
  })();
  return true; // async response
});
