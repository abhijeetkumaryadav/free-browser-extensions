/* PropCheck — DNS Propagation Checker
   Queries two free public DNS-over-HTTPS resolvers (Google + Cloudflare)
   and compares their answers side-by-side. No API keys, no remote code. */
'use strict';

/* ------------------------------------------------------------------ */
/* Resolver definitions                                                */
/* ------------------------------------------------------------------ */
const RESOLVERS = [
  {
    name: 'Google DoH',
    // Google DNS JSON API: GET https://dns.google/resolve?name=<d>&type=<t>
    buildUrl: (domain, type) =>
      `https://dns.google/resolve?name=${encodeURIComponent(domain)}&type=${encodeURIComponent(type)}`,
    fetchOptions: {},
    // Google returns { Answer: [{ name, type, TTL, data }] }
    extract: (json) => (json && Array.isArray(json.Answer) ? json.Answer : []),
    fmt: (a) => ({ data: String(a.data), ttl: a.TTL })
  },
  {
    name: 'Cloudflare DoH',
    // Cloudflare DNS JSON API needs the dns-json Accept header
    buildUrl: (domain, type) =>
      `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(domain)}&type=${encodeURIComponent(type)}`,
    fetchOptions: { headers: { accept: 'application/dns-json' } },
    extract: (json) => (json && Array.isArray(json.Answer) ? json.Answer : []),
    fmt: (a) => ({ data: String(a.data), ttl: a.TTL })
  }
];

/* ------------------------------------------------------------------ */
/* Small DOM helpers                                                   */
/* ------------------------------------------------------------------ */
const $ = (id) => document.getElementById(id);
const statusEl = $('status');
const resultsEl = $('results');
const domainEl = $('domain');
const typeEl = $('rtype');
const checkBtn = $('check');
const copyBtn = $('copy');

let lastResults = null; // kept for the Copy button

function setStatus(msg, cls) {
  statusEl.textContent = msg;
  statusEl.className = 'status ' + (cls || '');
}

/* ------------------------------------------------------------------ */
/* Core logic: query one resolver                                      */
/* ------------------------------------------------------------------ */
async function queryResolver(resolver, domain, type) {
  try {
    const res = await fetch(resolver.buildUrl(domain, type), resolver.fetchOptions);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const json = await res.json();
    const answers = resolver.extract(json).map(resolver.fmt);
    return { name: resolver.name, ok: true, answers };
  } catch (err) {
    return { name: resolver.name, ok: false, error: String(err && err.message || err), answers: [] };
  }
}

/* Two answer lists "match" when they contain the same data strings
   (order-insensitive, TTL ignored — TTLs legitimately differ). */
function answersMatch(a, b) {
  if (a.length !== b.length) return false;
  const sa = a.map((x) => x.data).sort();
  const sb = b.map((x) => x.data).sort();
  return sa.every((v, i) => v === sb[i]);
}

/* Very light domain sanity check (the APIs reject garbage anyway). */
function looksLikeDomain(d) {
  return /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/i.test(d.trim());
}

/* ------------------------------------------------------------------ */
/* Rendering                                                           */
/* ------------------------------------------------------------------ */
function esc(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function renderResults(results, domain, type) {
  resultsEl.innerHTML = '';
  const allOk = results.every((r) => r.ok);
  const matched = allOk && answersMatch(results[0].answers, results[1].answers);

  for (const r of results) {
    const card = document.createElement('div');
    card.className = 'res-card';

    let badge;
    if (!r.ok) {
      badge = '<span class="badge mismatch">Error</span>';
    } else if (matched) {
      badge = '<span class="badge match">Match</span>';
    } else {
      badge = '<span class="badge mismatch">Differs</span>';
    }

    let body;
    if (!r.ok) {
      body = `<div class="empty">Query failed: ${esc(r.error)}</div>`;
    } else if (r.answers.length === 0) {
      body = `<div class="empty">No ${esc(type)} records returned for ${esc(domain)}.</div>`;
    } else {
      const items = r.answers
        .map((a) => `<li>${esc(a.data)}<span class="ttl">TTL ${esc(String(a.ttl))}</span></li>`)
        .join('');
      body = `<ul class="ans">${items}</ul>`;
    }

    card.innerHTML = `<div class="res-head"><span class="res-name">${esc(r.name)}</span>${badge}</div>${body}`;
    resultsEl.appendChild(card);
  }

  if (results.every((r) => r.ok)) {
    setStatus(
      matched
        ? 'Both resolvers agree — record looks propagated (to these 2 resolvers).'
        : 'Resolvers disagree — record may still be propagating.',
      matched ? 'ok' : 'err'
    );
  } else {
    setStatus('One or both resolver queries failed.', 'err');
  }
}

/* ------------------------------------------------------------------ */
/* Actions                                                             */
/* ------------------------------------------------------------------ */
async function runCheck() {
  const domain = domainEl.value.trim().replace(/^https?:\/\//i, '').split('/')[0];
  const type = typeEl.value;
  if (!looksLikeDomain(domain)) {
    setStatus('Please enter a valid domain, e.g. example.com.', 'err');
    return;
  }

  checkBtn.disabled = true;
  setStatus('Querying Google DoH and Cloudflare DoH…', '');
  resultsEl.innerHTML = '';

  const results = await Promise.all(RESOLVERS.map((r) => queryResolver(r, domain, type)));
  lastResults = { domain, type, at: new Date().toISOString(), results };
  renderResults(results, domain, type);
  checkBtn.disabled = false;

  // Remember the last query for next time.
  chrome.storage.local.set({ lastDomain: domain, lastType: type });
}

function copyResults() {
  if (!lastResults) {
    setStatus('Nothing to copy yet — run a check first.', 'err');
    return;
  }
  const { domain, type, results } = lastResults;
  const lines = [`DNS check: ${domain} (${type})`];
  for (const r of results) {
    lines.push(`\n[${r.name}]`);
    if (!r.ok) {
      lines.push('  ERROR: ' + r.error);
    } else if (r.answers.length === 0) {
      lines.push('  (no records)');
    } else {
      for (const a of r.answers) lines.push(`  ${a.data}  (TTL ${a.ttl})`);
    }
  }
  navigator.clipboard.writeText(lines.join('\n')).then(
    () => setStatus('Results copied to clipboard.', 'ok'),
    () => setStatus('Clipboard write failed — select and copy manually.', 'err')
  );
}

/* ------------------------------------------------------------------ */
/* Init                                                                */
/* ------------------------------------------------------------------ */
checkBtn.addEventListener('click', runCheck);
copyBtn.addEventListener('click', copyResults);
domainEl.addEventListener('keydown', (e) => { if (e.key === 'Enter') runCheck(); });

// Restore the last query so repeat checks are one click.
chrome.storage.local.get(['lastDomain', 'lastType'], (v) => {
  if (v.lastDomain) domainEl.value = v.lastDomain;
  if (v.lastType) typeEl.value = v.lastType;
});
