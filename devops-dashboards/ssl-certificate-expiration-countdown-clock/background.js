/* CertWatch background service worker: daily expiry check + alerts. */
const ALARM_NAME = 'certwatch-daily';

async function getState() {
  const d = await chrome.storage.local.get(['certwatch']);
  return d.certwatch || { domains: [], warnDays: 14, alerts: true };
}
async function setState(s) {
  await chrome.storage.local.set({ certwatch: s });
}

/** Query crt.sh for a domain's certs; return the latest-expiring *valid* (not yet expired) cert, or null. */
async function fetchLatestCert(domain) {
  const url = 'https://crt.sh/?q=' + encodeURIComponent(domain) + '&output=json';
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error('crt.sh HTTP ' + res.status);
  const rows = await res.json();
  if (!Array.isArray(rows) || !rows.length) return null;
  const now = Date.now();
  let best = null;
  for (const r of rows) {
    if (!r.not_after) continue;
    const exp = Date.parse(r.not_after);
    if (isNaN(exp) || exp <= now) continue; // skip expired
    if (!best || exp > best.expiresAt) {
      best = {
        expiresAt: exp,
        issuer: (r.issuer_name || '').slice(0, 80),
        commonName: r.common_name || ''
      };
    }
  }
  return best;
}

async function runDailyCheck() {
  const st = await getState();
  if (!st.alerts || !st.domains.length) return;
  let changed = false;
  for (const d of st.domains) {
    if (d.source !== 'crtsh') continue; // manual entries are static
    try {
      const cert = await fetchLatestCert(d.domain);
      if (cert) {
        d.expiresAt = cert.expiresAt;
        d.issuer = cert.issuer;
        d.commonName = cert.commonName;
        d.lastChecked = Date.now();
        d.error = null;
        changed = true;
      }
    } catch (e) { d.error = String(e && e.message || e); changed = true; }
  }
  if (changed) await setState(st);

  // Notify for anything under the threshold.
  const now = Date.now();
  const urgent = st.domains.filter(d =>
    d.expiresAt && (d.expiresAt - now) < st.warnDays * 86400000 && (d.expiresAt - now) > 0
  );
  const expired = st.domains.filter(d => d.expiresAt && d.expiresAt <= now);
  if (urgent.length || expired.length) {
    const lines = [
      ...expired.map(d => `EXPIRED: ${d.domain}`),
      ...urgent.map(d => `${d.domain}: ${Math.ceil((d.expiresAt - now) / 86400000)}d left`)
    ];
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon48.png',
      title: 'CertWatch: certificate expiring',
      message: lines.slice(0, 4).join('\n')
    });
  }
}

chrome.alarms.onAlarm.addListener((a) => { if (a.name === ALARM_NAME) runDailyCheck(); });
chrome.runtime.onStartup.addListener(() => chrome.alarms.create(ALARM_NAME, { periodInMinutes: 24 * 60 }));
chrome.runtime.onInstalled.addListener(() => chrome.alarms.create(ALARM_NAME, { periodInMinutes: 24 * 60 }));

chrome.runtime.onMessage.addListener((msg, _s, sendResponse) => {
  (async () => {
    if (msg.type === 'get-state') sendResponse({ st: await getState() });
    else if (msg.type === 'save-state') { await setState(msg.st); sendResponse({ ok: true }); }
    else if (msg.type === 'lookup') {
      try { sendResponse({ ok: true, cert: await fetchLatestCert(msg.domain) }); }
      catch (e) { sendResponse({ ok: false, error: String(e && e.message || e) }); }
    }
    else if (msg.type === 'run-check') { await runDailyCheck(); sendResponse({ ok: true, st: await getState() }); }
  })();
  return true;
});
