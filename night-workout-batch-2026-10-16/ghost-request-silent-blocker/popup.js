/* GhostBlock — popup logic: toggle, counters, editable domain list. */
'use strict';

const SAMPLE_DOMAINS = [
  'doubleclick.net', 'googlesyndication.com', 'google-analytics.com',
  'googletagmanager.com', 'facebook.net', 'hotjar.com', 'criteo.com',
  'adsrvr.org', 'moatads.com', 'scorecardresearch.com'
];

const $ = (id) => document.getElementById(id);
const toggle = $('enabledToggle');
const todayCount = $('todayCount');
const totalCount = $('totalCount');
const domainCount = $('domainCount');
const domainList = $('domainList');
const domainInput = $('domainInput');

/* ------------------------------ state ------------------------------ */
async function getState() {
  const d = await chrome.storage.local.get(['ghostDomains', 'ghostEnabled', 'ghostStats']);
  return {
    domains: Array.isArray(d.ghostDomains) ? d.ghostDomains : [...SAMPLE_DOMAINS],
    enabled: d.ghostEnabled !== false,
    stats: d.ghostStats || { total: 0, dayCount: 0, byDomain: {} }
  };
}

async function saveDomains(domains) {
  await chrome.storage.local.set({ ghostDomains: domains });
}

/* ----------------------------- rendering --------------------------- */
function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

function render(state) {
  toggle.checked = state.enabled;
  todayCount.textContent = state.stats.dayCount || 0;
  totalCount.textContent = state.stats.total || 0;
  domainCount.textContent = state.domains.length;
  domainList.innerHTML = '';
  for (const domain of state.domains) {
    const li = document.createElement('li');
    const hits = (state.stats.byDomain && state.stats.byDomain[domain]) || 0;
    li.innerHTML =
      `<span class="name">${esc(domain)}<span class="count">${hits} blocked</span></span>` +
      `<button class="rm" data-domain="${esc(domain)}" title="Remove">✕</button>`;
    domainList.appendChild(li);
  }
  domainList.querySelectorAll('.rm').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const st = await getState();
      await saveDomains(st.domains.filter((d) => d !== btn.dataset.domain));
      refresh();
    });
  });
}

async function refresh() {
  render(await getState());
}

/* ------------------------------ events ----------------------------- */
toggle.addEventListener('change', async () => {
  await chrome.storage.local.set({ ghostEnabled: toggle.checked });
});

function normalizeDomain(raw) {
  let d = raw.trim().toLowerCase();
  d = d.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0].split(':')[0];
  return d;
}

async function addDomain() {
  const d = normalizeDomain(domainInput.value);
  if (!d || !d.includes('.')) {
    domainInput.focus();
    return;
  }
  const st = await getState();
  if (!st.domains.includes(d)) {
    st.domains.push(d);
    st.domains.sort();
    await saveDomains(st.domains);
  }
  domainInput.value = '';
  refresh();
}

$('addBtn').addEventListener('click', addDomain);
domainInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') addDomain();
});

$('resetBtn').addEventListener('click', async () => {
  await saveDomains([...SAMPLE_DOMAINS]);
  refresh();
});

// Live-update counters while the popup is open.
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && (changes.ghostStats || changes.ghostDomains || changes.ghostEnabled)) {
    refresh();
  }
});

refresh();
