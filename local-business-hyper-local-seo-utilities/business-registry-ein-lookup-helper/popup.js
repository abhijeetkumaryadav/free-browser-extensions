/* Business Registry EIN Lookup Helper
 * Curated official-registry directory + step-by-step lookup checklist
 * + per-registry notes. 100% offline. No IRS access; no IDs collected.
 */
'use strict';

const $ = (id) => document.getElementById(id);
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* Curated official registries. URLs are the public, official portals. */
const CURATED = [
  { id: 'irs-ein', name: 'IRS — Apply for an EIN Online', cat: 'federal',
    url: 'https://www.irs.gov/businesses/small-businesses-self-employed/apply-for-an-employer-identification-number-ein-online',
    desc: 'Official IRS online EIN application. Free; beware third-party sites that charge.' },
  { id: 'irs-teos', name: 'IRS — Tax Exempt Organization Search', cat: 'federal',
    url: 'https://apps.irs.gov/app/eos/',
    desc: 'Look up tax-exempt organizations and their EINs.' },
  { id: 'sam', name: 'SAM.gov — Entity Registration', cat: 'federal',
    url: 'https://sam.gov/',
    desc: 'Federal entity registration & lookup for businesses working with the US government.' },
  { id: 'sec', name: 'SEC EDGAR — Company Search', cat: 'federal',
    url: 'https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany',
    desc: 'Search filings of US public companies (CIK, filings, addresses).' },
  { id: 'de', name: 'Delaware — Division of Corporations', cat: 'state',
    url: 'https://icis.corp.delaware.gov/Ecorp/EntitySearch/NameSearch.aspx',
    desc: 'Entity name search for Delaware corporations & LLCs.' },
  { id: 'ca', name: 'California — BizFile Online', cat: 'state',
    url: 'https://bizfileonline.sos.ca.gov/search/business',
    desc: 'California Secretary of State business entity search.' },
  { id: 'ny', name: 'New York — Dept. of State Entity Search', cat: 'state',
    url: 'https://apps.dos.ny.gov/publicInquiry/',
    desc: 'NY Department of State corporation & entity database.' },
  { id: 'fl', name: 'Florida — Sunbiz', cat: 'state',
    url: 'https://search.sunbiz.org/',
    desc: 'Florida Division of Corporations entity search.' },
  { id: 'tx', name: 'Texas — SOSDirect', cat: 'state',
    url: 'https://www.sosdirect.sos.state.tx.us/',
    desc: 'Texas Secretary of State business entity search (SOSDirect).' },
  { id: 'uspto', name: 'USPTO — Trademark Search', cat: 'other',
    url: 'https://tmsearch.uspto.gov/',
    desc: 'Search US federal trademarks tied to a business name.' },
];

/* Guided lookup steps — a manual process, clearly labeled. */
const STEPS = [
  'Confirm the exact legal business name (as filed, not a DBA).',
  'Identify the state (and country) of formation.',
  'Check EIN status: applied, received, or needs a new IRS application.',
  'Search the state business registry for the entity record.',
  'Verify registered agent and status (active / good standing).',
  'Record findings, dates, and document links in the notes below.',
];

const K_CUSTOM = 'breh_custom';   // custom registries
const K_NOTES = 'breh_notes';     // {registryId: note}
const K_CHECKS = 'breh_checks';   // [bool...] checklist state

async function getAll() {
  const d = await chrome.storage.local.get({ [K_CUSTOM]: [], [K_NOTES]: {}, [K_CHECKS]: STEPS.map(() => false) });
  return {
    custom: Array.isArray(d[K_CUSTOM]) ? d[K_CUSTOM] : [],
    notes: d[K_NOTES] && typeof d[K_NOTES] === 'object' ? d[K_NOTES] : {},
    checks: Array.isArray(d[K_CHECKS]) && d[K_CHECKS].length === STEPS.length ? d[K_CHECKS] : STEPS.map(() => false),
  };
}

const allRegistries = (custom) => [
  ...CURATED,
  ...custom.map((c) => ({ ...c, cat: 'custom' })),
];

/* ---------- checklist ---------- */
function renderChecklist(checks) {
  const list = $('checkList');
  const done = checks.filter(Boolean).length;
  $('checkCount').textContent = `${done} / ${STEPS.length}`;
  $('progressFill').style.width = `${(done / STEPS.length) * 100}%`;
  list.innerHTML = STEPS.map((label, i) => `
    <li class="item">
      <label class="check">
        <input type="checkbox" data-i="${i}" ${checks[i] ? 'checked' : ''}>
        <span class="box"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></span>
        <span class="label"><b>Step ${i + 1}.</b> ${esc(label)}</span>
      </label>
    </li>`).join('');
  list.querySelectorAll('input[type="checkbox"]').forEach((cb) =>
    cb.addEventListener('change', async () => {
      const s = await getAll();
      s.checks[Number(cb.dataset.i)] = cb.checked;
      await chrome.storage.local.set({ [K_CHECKS]: s.checks });
      renderChecklist(s.checks);
    }));
}

/* ---------- registries ---------- */
function renderRegistries(regs, notes, customIds) {
  const q = $('fSearch').value.trim().toLowerCase();
  const list = $('regList');
  const shown = regs.filter((r) =>
    !q || r.name.toLowerCase().includes(q) || (r.desc || '').toLowerCase().includes(q));
  $('regCount').textContent = regs.length;
  $('regEmpty').classList.toggle('hidden', shown.length > 0);
  list.innerHTML = shown.map((r) => {
    const isCustom = customIds.has(r.id);
    const note = notes[r.id] || '';
    return `
    <li class="item" data-id="${esc(r.id)}">
      <div class="top">
        <span class="name">${esc(r.name)}</span>
        <span class="cat ${r.cat}">${r.cat}</span>
      </div>
      <div class="desc">${esc(r.desc || '')}</div>
      <div class="reg-actions">
        <a class="link-btn" href="${esc(r.url)}" target="_blank" rel="noopener">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
          Open
        </a>
        <button class="icon-btn note-toggle" title="Notes">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>
        ${isCustom ? `
        <button class="icon-btn danger del-reg" title="Delete custom registry">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
        </button>` : ''}
      </div>
      <div class="notes-wrap hidden">
        <textarea data-note="${esc(r.id)}" placeholder="Findings for ${esc(r.name)} — dates, entity numbers, links…">${esc(note)}</textarea>
      </div>
    </li>`;
  }).join('');

  // wire notes toggles (save on input, debounced)
  const timers = {};
  list.querySelectorAll('.note-toggle').forEach((btn) =>
    btn.addEventListener('click', () => {
      const wrap = btn.closest('.item').querySelector('.notes-wrap');
      wrap.classList.toggle('hidden');
    }));
  list.querySelectorAll('textarea[data-note]').forEach((ta) =>
    ta.addEventListener('input', () => {
      clearTimeout(timers[ta.dataset.note]);
      timers[ta.dataset.note] = setTimeout(async () => {
        const s = await getAll();
        s.notes[ta.dataset.note] = ta.value;
        await chrome.storage.local.set({ [K_NOTES]: s.notes });
      }, 400);
    }));
  list.querySelectorAll('.del-reg').forEach((btn) =>
    btn.addEventListener('click', async () => {
      const id = btn.closest('.item').dataset.id;
      const s = await getAll();
      s.custom = s.custom.filter((c) => c.id !== id);
      delete s.notes[id];
      await chrome.storage.local.set({ [K_CUSTOM]: s.custom, [K_NOTES]: s.notes });
      await refresh();
    }));
}

async function refresh() {
  const s = await getAll();
  const regs = allRegistries(s.custom);
  renderChecklist(s.checks);
  renderRegistries(regs, s.notes, new Set(s.custom.map((c) => c.id)));
}

/* ---------- wiring ---------- */
document.addEventListener('DOMContentLoaded', async () => {
  $('fSearch').addEventListener('input', refresh);

  $('btnResetCheck').addEventListener('click', async () => {
    await chrome.storage.local.set({ [K_CHECKS]: STEPS.map(() => false) });
    await refresh();
  });

  $('btnAddReg').addEventListener('click', async () => {
    const name = $('fName').value.trim();
    let url = $('fUrl').value.trim();
    if (!name || !url) { ($('fName').value ? $('fUrl') : $('fName')).focus(); return; }
    if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
    try { new URL(url); } catch { $('fUrl').focus(); $('fUrl').style.borderColor = '#f43f5e'; return; }
    const s = await getAll();
    s.custom.push({ id: uid(), name, url, desc: 'Custom registry added by you.' });
    await chrome.storage.local.set({ [K_CUSTOM]: s.custom });
    $('fName').value = ''; $('fUrl').value = ''; $('fUrl').style.borderColor = '';
    $('fSearch').value = '';
    await refresh();
  });

  await refresh();
});
