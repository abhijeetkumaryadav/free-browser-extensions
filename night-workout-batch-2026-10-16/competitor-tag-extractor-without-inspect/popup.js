'use strict';
/* Meta Tag Extractor — on-click page reader.
 * User-triggered via activeTab + scripting. Reads the tab you click from,
 * changes nothing on the page (reversible by nature).
 * Engine functions live between ENGINE-START / ENGINE-END so they can be
 * headless-tested in Node with a fake document object. */

// ============================ ENGINE-START ============================
/**
 * Collect title, meta tags, and canonical link from a document-like object.
 * Only accepts a real DOM document shape; never executes page scripts.
 * @param {{title:string, querySelectorAll:function}} doc
 * @returns {{title:string, canonical:string, tags:{key:string,value:string}[]}}
 */
function collectMeta(doc) {
  const out = { title: '', canonical: '', tags: [] };
  if (!doc || typeof doc.querySelectorAll !== 'function') return out;
  out.title = String(doc.title || '').slice(0, 300);

  const seen = new Set();
  const push = (key, value) => {
    key = String(key || '').trim().slice(0, 120);
    value = String(value || '').trim().slice(0, 2000);
    if (!key || !value) return;
    const sig = key.toLowerCase() + '|' + value;
    if (seen.has(sig)) return;
    seen.add(sig);
    if (out.tags.length < 200) out.tags.push({ key, value });
  };

  // Canonical link
  try {
    const canon = doc.querySelectorAll('link[rel="canonical"]');
    if (canon && canon.length && canon[0].getAttribute) {
      out.canonical = String(canon[0].getAttribute('href') || '').slice(0, 2000);
    }
  } catch (e) { /* treat as no canonical */ }

  let metas = [];
  try { metas = doc.querySelectorAll('meta') || []; } catch (e) { metas = []; }
  for (const m of metas) {
    if (!m || typeof m.getAttribute !== 'function') continue;
    const name = m.getAttribute('name');
    const prop = m.getAttribute('property');
    const httpEquiv = m.getAttribute('http-equiv');
    const charset = m.getAttribute('charset');
    const content = m.getAttribute('content');
    if (charset) { push('charset', charset); continue; }
    if (httpEquiv && content) { push('http-equiv:' + httpEquiv, content); continue; }
    const key = name || prop;
    if (key && content) push(key, content);
  }
  return out;
}

/**
 * Format collected meta as copyable plain text.
 * @param {{title:string, canonical:string, tags:{key:string,value:string}[]}} data
 * @param {string} url
 * @returns {string}
 */
function formatMetaText(data, url) {
  const lines = [`URL: ${url}`, `Title: ${data.title}`];
  if (data.canonical) lines.push(`Canonical: ${data.canonical}`);
  lines.push('');
  for (const t of data.tags) lines.push(`${t.key}: ${t.value}`);
  return lines.join('\n');
}

/**
 * Make a saved-snapshot entry.
 * @param {string} url
 * @param {string} title
 * @param {{title:string, canonical:string, tags:{key:string,value:string}[]}} data
 * @param {string} note
 * @returns {{id:string,url:string,title:string,note:string,tagCount:number,at:number}|null}
 */
function makeSnapshot(url, title, data, note) {
  url = String(url || '').trim();
  if (!/^https?:\/\//i.test(url)) return null;
  return {
    id: 's' + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36),
    url: url.slice(0, 2000),
    title: String(title || '').slice(0, 200),
    note: String(note || '').trim().slice(0, 140),
    tagCount: data && Array.isArray(data.tags) ? data.tags.length : 0,
    at: Date.now()
  };
}
// ============================= ENGINE-END =============================

/* ------------------------------ UI logic ------------------------------ */
const $ = id => document.getElementById(id);
const els = {};
let lastData = null;
let lastUrl = '';

document.addEventListener('DOMContentLoaded', () => {
  ['read','pageurl','results','taglist','copy','savenote','save','saved','empty']
    .forEach(id => { els[id] = $(id); });

  els.read.addEventListener('click', readPage);
  els.copy.addEventListener('click', () => {
    if (!lastData) return;
    navigator.clipboard.writeText(formatMetaText(lastData, lastUrl)).then(() => {
      els.copy.textContent = 'Copied ✓';
      setTimeout(() => { els.copy.textContent = 'Copy all'; }, 1500);
    }).catch(() => { els.copy.textContent = 'Copy failed'; });
  });
  els.save.addEventListener('click', saveSnapshot);
  renderSaved();
});

async function readPage() {
  els.read.disabled = true;
  els.read.textContent = 'Reading…';
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || tab.id == null) throw new Error('no active tab');
    lastUrl = tab.url || '';
    if (!/^https?:\/\//i.test(lastUrl)) throw new Error('only http(s) pages');
    const [res] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        // Runs in the page only because YOU clicked. Read-only.
        const metas = [...document.querySelectorAll('meta')].map(m => ({
          name: m.getAttribute('name'), property: m.getAttribute('property'),
          httpEquiv: m.getAttribute('http-equiv'), charset: m.getAttribute('charset'),
          content: m.getAttribute('content')
        }));
        const canon = document.querySelector('link[rel="canonical"]');
        return { title: document.title, metas, canonical: canon ? canon.getAttribute('href') : '' };
      }
    });
    // Rebuild through the honest engine (dedupe + caps + sanitizing).
    const fakeDoc = {
      title: res.result.title,
      querySelectorAll(sel) {
        if (sel === 'meta') return res.result.metas.map(m => ({
          getAttribute: k => ({ name: m.name, property: m.property, 'http-equiv': m.httpEquiv, charset: m.charset, content: m.content }[k] ?? null)
        }));
        if (sel === 'link[rel="canonical"]') {
          return res.result.canonical ? [{ getAttribute: () => res.result.canonical }] : [];
        }
        return [];
      }
    };
    lastData = collectMeta(fakeDoc);
    renderResults();
  } catch (e) {
    els.pageurl.textContent = 'Could not read this page (' + (e.message || 'error') + ').';
    els.results.hidden = true;
  } finally {
    els.read.disabled = false;
    els.read.textContent = "Read this page's tags";
  }
}

function renderResults() {
  els.pageurl.textContent = lastUrl;
  els.taglist.innerHTML = '';
  const addRow = (k, v) => {
    const div = document.createElement('div');
    const dt = document.createElement('dt'); dt.textContent = k;
    const dd = document.createElement('dd'); dd.textContent = v;
    div.append(dt, dd);
    els.taglist.append(div);
  };
  addRow('title', lastData.title || '(empty)');
  if (lastData.canonical) addRow('canonical', lastData.canonical);
  for (const t of lastData.tags) addRow(t.key, t.value);
  els.results.hidden = false;
}

function saveSnapshot() {
  if (!lastData) return;
  const snap = makeSnapshot(lastUrl, lastData.title, lastData, els.savenote.value);
  if (!snap) return;
  chrome.storage.local.get(['mte_saved'], res => {
    const list = Array.isArray(res.mte_saved) ? res.mte_saved : [];
    list.unshift(snap);
    chrome.storage.local.set({ mte_saved: list.slice(0, 200) }, renderSaved);
  });
  els.savenote.value = '';
}

function renderSaved() {
  chrome.storage.local.get(['mte_saved'], res => {
    const list = Array.isArray(res.mte_saved) ? res.mte_saved : [];
    els.saved.innerHTML = '';
    els.empty.hidden = list.length > 0;
    for (const s of list) {
      const li = document.createElement('li');
      const meta = document.createElement('div'); meta.className = 'meta';
      const b = document.createElement('b'); b.textContent = s.title || s.url;
      const span = document.createElement('span');
      span.textContent = `${s.tagCount} tags${s.note ? ' · ' + s.note : ''}`;
      meta.append(b, span);
      const del = document.createElement('button'); del.className = 'del'; del.textContent = '✕';
      del.title = 'Delete';
      del.addEventListener('click', () => {
        chrome.storage.local.get(['mte_saved'], r2 => {
          const l2 = (Array.isArray(r2.mte_saved) ? r2.mte_saved : []).filter(x => x.id !== s.id);
          chrome.storage.local.set({ mte_saved: l2 }, renderSaved);
        });
      });
      li.append(meta, del);
      els.saved.append(li);
    }
  });
}
