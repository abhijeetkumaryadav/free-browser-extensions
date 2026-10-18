/* CNAME Uncloak — DNS Resolver
 * Read-only, on-click DNS-over-HTTPS lookups (Google or Cloudflare JSON API).
 * Follows CNAME chains to the final A/AAAA answers and gives a simple
 * educational heuristic about "cloaked" third-party destinations.
 * Only the provider choice is persisted (chrome.storage.local). Nothing else stored.
 */

'use strict';

/* ---------- Lucide-style stroke icons ---------- */
const ICONS = {
  radar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="0.5" fill="currentColor"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3"/></svg>',
  tab: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="14" rx="2"/><path d="M3 9h18"/><path d="M8 21h8"/></svg>',
  arrow: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14"/><path d="m6 13 6 6 6-6"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="m8.5 12.5 2.5 2.5 4.5-5"/></svg>',
  warn: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3 2.5 20h19L12 3z"/><path d="M12 10v4"/><circle cx="12" cy="17" r="0.5" fill="currentColor"/></svg>',
  server: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="4" width="18" height="7" rx="2"/><rect x="3" y="13" width="18" height="7" rx="2"/><circle cx="7" cy="7.5" r="0.5" fill="currentColor"/><circle cx="7" cy="16.5" r="0.5" fill="currentColor"/></svg>',
};

/* ---------- DOM ---------- */
const $ = (id) => document.getElementById(id);
const domainInput = $('domain-input');
const lookupBtn = $('lookup-btn');
const useTabBtn = $('use-tab-btn');
const providerSel = $('provider');
const resultsSec = $('results');
const chainEl = $('chain');
const verdictEl = $('verdict');
const eduNoteEl = $('edu-note');
const statusPanel = $('status-panel');
const statusText = $('status-text');

$('brand-icon').innerHTML = ICONS.radar;
useTabBtn.insertAdjacentHTML('afterbegin', ICONS.tab);

/* ---------- DNS-over-HTTPS ---------- */
const PROVIDERS = {
  google: (name, type) => `https://dns.google/resolve?name=${encodeURIComponent(name)}&type=${type}`,
  cloudflare: (name, type) => `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(name)}&type=${type}`,
};

const RTYPE = { 1: 'A', 5: 'CNAME', 28: 'AAAA' };

// A small list of well-known analytics/ad/track infra markers used ONLY to
// phrase the educational verdict in plain language. Heuristic, not a blocklist.
const TRACKER_HINTS = [
  'analytics', 'tracking', 'tracker', 'telemetry', 'metrics', 'beacon',
  'ads', 'adservice', 'doubleclick', 'pixel', 'fingerprint',
];

async function doh(name, type, provider) {
  const res = await fetch(PROVIDERS[provider](name, type), {
    headers: { Accept: 'application/dns-json' },
  });
  if (!res.ok) throw new Error(`DNS provider HTTP ${res.status}`);
  return res.json();
}

// Normalize + validate a user-supplied domain. Rejects URLs, IPs-as-paths, etc.
function cleanDomain(raw) {
  let d = raw.trim().toLowerCase();
  d = d.replace(/^https?:\/\//, '').split('/')[0].split(':')[0].replace(/\.$/, '');
  // IDN → punycode via URL parser; then strict label check.
  try { d = new URL(`http://${d}`).hostname; } catch { return null; }
  if (!/^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/.test(d)) return null;
  return d;
}

function registrableBase(host) {
  const parts = host.split('.');
  return parts.length >= 2 ? parts.slice(-2).join('.') : host;
}

function showStatus(msg, isError = false) {
  statusPanel.hidden = false;
  statusText.textContent = msg;
  statusText.className = 'status' + (isError ? ' error' : '');
}

function hideStatus() { statusPanel.hidden = true; }

/* ---------- Chain resolution ---------- */
// Follow CNAMEs up to 8 hops, then collect A + AAAA for the terminal name.
async function resolveChain(domain, provider) {
  const hops = [];   // { name, type, value }
  let current = domain;
  const seen = new Set();

  for (let i = 0; i < 8; i++) {
    if (seen.has(current)) break;
    seen.add(current);
    const data = await doh(current, 'CNAME', provider);
    const cname = (data.Answer || []).find((a) => a.type === 5);
    if (!cname) break;
    const target = String(cname.data).replace(/\.$/, '').toLowerCase();
    hops.push({ name: current, type: 'CNAME', value: target });
    current = target;
  }

  const [aData, aaaaData] = await Promise.all([
    doh(current, 'A', provider).catch(() => ({})),
    doh(current, 'AAAA', provider).catch(() => ({})),
  ]);
  const ips = [
    ...((aData.Answer || []).filter((a) => a.type === 1).map((a) => ({ type: 'A', value: a.data }))),
    ...((aaaaData.Answer || []).filter((a) => a.type === 28).map((a) => ({ type: 'AAAA', value: a.data }))),
  ];
  return { hops, terminal: current, ips };
}

/* ---------- Rendering ---------- */
function renderChain(domain, { hops, terminal, ips }) {
  chainEl.innerHTML = '';

  const startHop = document.createElement('div');
  startHop.className = 'hop';
  startHop.innerHTML = `<span class="hop-icon">${ICONS.server}</span><span class="rval"></span>`;
  startHop.querySelector('.rval').textContent = domain;
  chainEl.appendChild(startHop);

  for (const hop of hops) {
    const conn = document.createElement('div');
    conn.className = 'connector';
    conn.innerHTML = `${ICONS.arrow}<span>CNAME →</span>`;
    chainEl.appendChild(conn);

    const el = document.createElement('div');
    el.className = 'hop';
    el.innerHTML = `<span class="hop-icon">${ICONS.server}</span><span class="rtype">CNAME</span><span class="rval"></span>`;
    el.querySelector('.rval').textContent = hop.value;
    chainEl.appendChild(el);
  }

  if (ips.length > 0) {
    const conn = document.createElement('div');
    conn.className = 'connector';
    conn.innerHTML = `${ICONS.arrow}<span>resolves to</span>`;
    chainEl.appendChild(conn);
    for (const ip of ips.slice(0, 8)) {
      const el = document.createElement('div');
      el.className = 'hop';
      el.innerHTML = `<span class="hop-icon">${ICONS.server}</span><span class="rtype">${ip.type}</span><span class="rval"></span>`;
      el.querySelector('.rval').textContent = ip.value;
      chainEl.appendChild(el);
    }
    if (ips.length > 8) {
      const more = document.createElement('div');
      more.className = 'connector';
      more.innerHTML = `<span>…and ${ips.length - 8} more address${ips.length - 8 === 1 ? '' : 'es'}</span>`;
      chainEl.appendChild(more);
    }
  }
}

function renderVerdict(domain, { hops, terminal }) {
  const base = registrableBase(domain);
  const terminalBase = registrableBase(terminal);
  const thirdParty = hops.length > 0 && terminalBase !== base;
  const hintHit = TRACKER_HINTS.find((h) => terminal.toLowerCase().includes(h));

  verdictEl.className = 'verdict ' + (thirdParty ? 'cloaked' : 'clean');
  if (!thirdParty) {
    verdictEl.innerHTML = `${ICONS.check}<div><strong>Direct resolution</strong><p>${escapeHtml(domain)} resolves without a CNAME chain to another organization. No aliasing detected.</p></div>`;
  } else {
    verdictEl.innerHTML = `${ICONS.warn}<div><strong>Aliased to a third party</strong><p>${escapeHtml(domain)} ultimately points at <b>${escapeHtml(terminalBase)}</b> via ${hops.length} CNAME hop${hops.length === 1 ? '' : 's'}.${hintHit ? ` The destination hostname contains “${hintHit}”, which often indicates analytics/tracking infrastructure.` : ''}</p></div>`;
  }

  eduNoteEl.textContent = 'Educational heuristic only: CNAME aliasing is also used legitimately (CDNs, hosting platforms). This tool reveals DNS structure — it does not judge or block anything.';
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

/* ---------- Lookup flow ---------- */
async function runLookup(rawDomain) {
  const domain = cleanDomain(rawDomain);
  if (!domain) {
    showStatus('Please enter a valid domain, e.g. example.com', true);
    return;
  }
  lookupBtn.disabled = true;
  hideStatus();
  resultsSec.hidden = true;
  showStatus(`Resolving ${domain}…`);

  try {
    const provider = providerSel.value;
    const result = await resolveChain(domain, provider);
    hideStatus();
    if (result.ips.length === 0 && result.hops.length === 0) {
      showStatus(`No DNS records found for ${domain}. Check the spelling or try the other provider.`, true);
      return;
    }
    renderChain(domain, result);
    renderVerdict(domain, result);
    resultsSec.hidden = false;
  } catch (err) {
    showStatus(`Lookup failed: ${err.message}. The DNS provider may be unreachable.`, true);
  } finally {
    lookupBtn.disabled = false;
  }
}

lookupBtn.addEventListener('click', () => runLookup(domainInput.value));
domainInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') runLookup(domainInput.value);
});

useTabBtn.addEventListener('click', async () => {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const host = tab && tab.url ? new URL(tab.url).hostname : '';
    if (!host) { showStatus('Could not read the current tab’s domain.', true); return; }
    domainInput.value = host;
    runLookup(host);
  } catch {
    showStatus('Could not read the current tab’s domain.', true);
  }
});

/* ---------- Provider persistence ---------- */
providerSel.addEventListener('change', () => {
  chrome.storage.local.set({ dohProvider: providerSel.value });
});

(async function init() {
  const { dohProvider } = await chrome.storage.local.get('dohProvider');
  if (dohProvider && PROVIDERS[dohProvider]) providerSel.value = dohProvider;
})();
