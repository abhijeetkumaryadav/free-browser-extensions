'use strict';
/* Furigana Inserter — popup: manage user pairs, click-only tab injection. */

const $ = (id) => document.getElementById(id);
let pairs = []; // [{kanji, reading}]

function status(msg, kind) {
  const el = $('status');
  el.textContent = msg;
  el.className = 'status' + (kind ? ' ' + kind : '');
}

function render() {
  const ul = $('pairs');
  ul.innerHTML = '';
  $('pair-count').textContent = pairs.length;
  $('empty').style.display = pairs.length ? 'none' : 'block';
  pairs.forEach((p, i) => {
    const li = document.createElement('li');
    const k = document.createElement('span'); k.className = 'k'; k.textContent = p.kanji;
    const arrow = document.createElement('span'); arrow.className = 'arrow'; arrow.textContent = '→';
    const r = document.createElement('span'); r.className = 'r'; r.textContent = p.reading;
    const del = document.createElement('button'); del.className = 'del'; del.textContent = '×';
    del.setAttribute('aria-label', 'Delete pair ' + p.kanji);
    del.addEventListener('click', () => { pairs.splice(i, 1); save(); render(); });
    li.append(k, arrow, r, del);
    ul.appendChild(li);
  });
  $('btn-insert').disabled = pairs.length === 0;
}

function save() {
  chrome.storage.local.set({ pairs });
}

function addPair() {
  const kanji = $('in-kanji').value.trim();
  const reading = $('in-reading').value.trim();
  if (!kanji || !reading) { status('Enter both a kanji and its reading.', 'bad'); return; }
  if (pairs.some((p) => p.kanji === kanji)) { status('That kanji is already in your list.', 'bad'); return; }
  pairs.push({ kanji, reading });
  $('in-kanji').value = '';
  $('in-reading').value = '';
  save(); render();
  status('Added: ' + kanji + ' → ' + reading, 'good');
  $('in-kanji').focus();
}

async function activeTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function ensureInjected(tabId) {
  // Idempotent: content.js self-guards with window.__fgInserterReady.
  await chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] });
}

async function run(type) {
  status('');
  try {
    const tab = await activeTab();
    if (!tab || tab.id == null) { status('No active tab.', 'bad'); return; }
    await ensureInjected(tab.id);
    const res = await chrome.tabs.sendMessage(tab.id, { type, pairs });
    if (res && res.ok) {
      status(type === 'FG_INSERT'
        ? `Wrapped ${res.count} match${res.count === 1 ? '' : 'es'} in <ruby> tags.`
        : `Removed ${res.count} furigana annotation${res.count === 1 ? '' : 's'}.`, 'good');
    } else {
      status('Failed: ' + (res && res.error || 'unknown error'), 'bad');
    }
  } catch (e) {
    status('Cannot run on this page (try a normal web page).', 'bad');
  }
}

$('btn-add').addEventListener('click', addPair);
$('in-reading').addEventListener('keydown', (e) => { if (e.key === 'Enter') addPair(); });
$('btn-insert').addEventListener('click', () => run('FG_INSERT'));
$('btn-remove').addEventListener('click', () => run('FG_REMOVE'));

chrome.storage.local.get('pairs', (d) => {
  if (d && Array.isArray(d.pairs)) pairs = d.pairs.filter((p) => p && p.kanji && p.reading);
  render();
});
