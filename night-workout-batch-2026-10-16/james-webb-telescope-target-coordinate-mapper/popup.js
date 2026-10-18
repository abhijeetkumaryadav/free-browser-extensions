'use strict';
/* JWST Target List — personal deep-sky coordinate logbook. Fully local (chrome.storage.local), zero network. */

// ENGINE-START
/** Format decimal RA hours as "Hh MMm SSs". */
function fmtRA(h) {
  const hh = Math.floor(h);
  const mm = Math.floor((h - hh) * 60);
  const ss = Math.round((((h - hh) * 60) - mm) * 60);
  let h2 = hh, m2 = mm, s2 = ss;
  if (s2 === 60) { s2 = 0; m2++; }
  if (m2 === 60) { m2 = 0; h2 = (h2 + 1) % 24; }
  const p = (n) => String(n).padStart(2, '0');
  return p(h2) + 'h ' + p(m2) + 'm ' + p(s2) + 's';
}

/** Format decimal declination degrees as "+DD° MM′ SS″". */
function fmtDec(d) {
  const sign = d < 0 ? '-' : '+';
  const a = Math.abs(d);
  const dd = Math.floor(a);
  const mm = Math.floor((a - dd) * 60);
  const ss = Math.round((((a - dd) * 60) - mm) * 60);
  let d2 = dd, m2 = mm, s2 = ss;
  if (s2 === 60) { s2 = 0; m2++; }
  if (m2 === 60) { m2 = 0; d2++; }
  const p = (n) => String(n).padStart(2, '0');
  return sign + p(d2) + '° ' + p(m2) + '′ ' + p(s2) + '″';
}

/** Validate raw inputs; returns {ok, error?, name, ra, dec}. */
function validateTarget(name, raRaw, decRaw) {
  const n = (name || '').trim();
  if (!n) return { ok: false, error: 'Give the target a name.' };
  const ra = Number(raRaw), dec = Number(decRaw);
  if (!isFinite(ra) || ra < 0 || ra > 24) return { ok: false, error: 'RA must be 0–24 hours.' };
  if (!isFinite(dec) || dec < -90 || dec > 90) return { ok: false, error: 'Dec must be −90° to +90°.' };
  return { ok: true, name: n, ra, dec };
}

/** Build a stored target record. */
function makeTarget(name, ra, dec, notes) {
  return { id: 't' + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36), name, ra, dec, notes: (notes || '').trim(), added: Date.now() };
}

/** Case-insensitive search over name + notes. */
function searchTargets(targets, q) {
  const query = (q || '').trim().toLowerCase();
  if (!query) return targets.slice();
  return targets.filter((t) => (t.name + ' ' + (t.notes || '')).toLowerCase().includes(query));
}
// ENGINE-END

/* ---------- storage + UI ---------- */
const $ = (id) => document.getElementById(id);
const KEY = 'jwstTargets';

async function loadAll() {
  const r = await chrome.storage.local.get(KEY);
  return Array.isArray(r[KEY]) ? r[KEY] : [];
}
async function saveAll(list) { await chrome.storage.local.set({ [KEY]: list }); }

function render(list) {
  const el = $('list'), empty = $('empty'), count = $('count');
  el.innerHTML = '';
  count.textContent = list.length ? `(${list.length})` : '';
  empty.style.display = list.length ? 'none' : 'block';
  for (const t of list) {
    const div = document.createElement('div');
    div.className = 'item';
    const head = document.createElement('div');
    head.className = 'nm';
    const nm = document.createElement('span');
    nm.textContent = t.name;
    const del = document.createElement('button');
    del.className = 'del';
    del.textContent = '×';
    del.title = 'Remove';
    del.addEventListener('click', async () => {
      const all = await loadAll();
      await saveAll(all.filter((x) => x.id !== t.id));
      refresh();
    });
    head.append(nm, del);
    const co = document.createElement('div');
    co.className = 'co';
    co.textContent = `RA ${fmtRA(t.ra)} · Dec ${fmtDec(t.dec)}`;
    div.append(head, co);
    if (t.notes) {
      const nt = document.createElement('div');
      nt.className = 'nt';
      nt.textContent = t.notes;
      div.append(nt);
    }
    el.append(div);
  }
}

let allTargets = [];
async function refresh() {
  allTargets = await loadAll();
  render(searchTargets(allTargets, $('search').value));
}

document.addEventListener('DOMContentLoaded', () => {
  refresh();
  $('search').addEventListener('input', () => render(searchTargets(allTargets, $('search').value)));
  $('addbtn').addEventListener('click', async () => {
    const err = $('formerr');
    const v = validateTarget($('tname').value, $('tra').value, $('tdec').value);
    if (!v.ok) { err.textContent = v.error; err.hidden = false; return; }
    err.hidden = true;
    const list = await loadAll();
    list.push(makeTarget(v.name, v.ra, v.dec, $('tnotes').value));
    await saveAll(list);
    $('tname').value = ''; $('tra').value = ''; $('tdec').value = ''; $('tnotes').value = '';
    refresh();
  });
});
