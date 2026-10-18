/* Phishing Wallet Address Blacklist — popup logic.
 * Everything is local: blacklist lives in chrome.storage.local.
 * A "not listed" verdict is NOT a safety guarantee. */
'use strict';

/* Starter entries: clearly-marked SAMPLE data so the UI isn't empty.
 * These are illustrative examples, not real threat intelligence. */
const SAMPLE = [
  { addr: '0xDEADBEEF00000000000000000000000000000000', note: 'sample', sample: true },
  { addr: '0xSCAM000000000000000000000000000000000001', note: 'sample', sample: true },
];

const $ = (id) => document.getElementById(id);
const norm = (s) => s.trim().toLowerCase();

async function loadList() {
  const { blacklist } = await chrome.storage.local.get('blacklist');
  if (!blacklist) {
    await chrome.storage.local.set({ blacklist: SAMPLE });
    return [...SAMPLE];
  }
  return blacklist;
}

async function saveList(list) {
  await chrome.storage.local.set({ blacklist: list });
}

function render(list, filter = '') {
  const ul = $('list');
  const q = norm(filter);
  const shown = list.filter((e) => !q || norm(e.addr).includes(q));
  $('count').textContent = list.length;
  ul.innerHTML = '';
  if (!shown.length) {
    ul.innerHTML = '<li class="empty">No entries yet — add one above.</li>';
    return;
  }
  for (const e of shown) {
    const li = document.createElement('li');
    const tag = document.createElement('span');
    tag.className = 'tag';
    tag.textContent = e.sample ? 'sample' : 'yours';
    const span = document.createElement('span');
    span.textContent = e.addr;
    const x = document.createElement('button');
    x.className = 'x';
    x.textContent = '×';
    x.title = 'Remove';
    x.addEventListener('click', async () => {
      const cur = await loadList();
      await saveList(cur.filter((i) => norm(i.addr) !== norm(e.addr)));
      render(await loadList(), $('search').value);
    });
    li.append(tag, span, x);
    ul.appendChild(li);
  }
}

function verdict(kind, html) {
  const v = $('verdict');
  v.className = 'verdict ' + kind;
  v.innerHTML = html;
}

async function main() {
  let list = await loadList();
  render(list);

  $('check').addEventListener('click', async () => {
    list = await loadList();
    const a = norm($('addr').value);
    if (!a) { verdict('good', 'Enter an address first.'); return; }
    const hit = list.find((e) => norm(e.addr) === a);
    if (hit) {
      verdict('bad', '⚠️ <strong>BLACKLISTED</strong> — this address is on your local list. Do not send funds.');
    } else {
      verdict('good', '✓ Not on your local list. <strong>This does not mean it is safe</strong> — always verify out-of-band.');
    }
  });

  $('add').addEventListener('click', async () => {
    const a = $('addr').value.trim();
    if (!a) return;
    list = await loadList();
    if (list.some((e) => norm(e.addr) === norm(a))) {
      verdict('good', 'Already on your list.');
      return;
    }
    list.push({ addr: a, note: 'user-added', sample: false });
    await saveList(list);
    render(list, $('search').value);
    verdict('good', 'Added to your local blacklist.');
  });

  $('search').addEventListener('input', async () => render(await loadList(), $('search').value));

  $('export').addEventListener('click', async () => {
    const data = JSON.stringify(await loadList(), null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'wallet-blacklist.json'; a.click();
    URL.revokeObjectURL(url);
  });

  $('import').addEventListener('click', () => $('file').click());
  $('file').addEventListener('change', async (ev) => {
    const f = ev.target.files[0];
    if (!f) return;
    try {
      const arr = JSON.parse(await f.text());
      if (!Array.isArray(arr)) throw new Error('bad format');
      const clean = arr.filter((e) => e && typeof e.addr === 'string')
        .map((e) => ({ addr: e.addr.trim(), note: e.note || 'imported', sample: !!e.sample }));
      await saveList(clean);
      render(clean, $('search').value);
      verdict('good', `Imported ${clean.length} entries.`);
    } catch {
      verdict('bad', 'Import failed — expected a JSON array of {addr} objects.');
    }
    ev.target.value = '';
  });
}

document.addEventListener('DOMContentLoaded', main);
