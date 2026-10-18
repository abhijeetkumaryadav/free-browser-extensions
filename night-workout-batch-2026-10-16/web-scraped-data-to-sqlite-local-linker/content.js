// content.js — extracts structured data from the page.
//
// Three extraction presets:
//   tables  — every <table>: first row (th or td) becomes headers, the rest rows
//   lists   — every <ul>/<ol>: each <li> becomes a single-column row
//   jsonld  — every <script type="application/ld+json">: flattened key/value pairs
//   custom  — any CSS selector: the textContent of each match becomes a row
//
// Returns [{ source, headers: [...], rows: [[...], ...] }]. No network, read-only.

(function () {
  'use strict';

  function text(el) {
    return (el.textContent || '').replace(/\s+/g, ' ').trim();
  }

  function extractTables() {
    const out = [];
    document.querySelectorAll('table').forEach((table, ti) => {
      const trs = Array.from(table.querySelectorAll('tr'));
      if (!trs.length) return;
      const headers = Array.from(trs[0].querySelectorAll('th, td')).map((c, i) => text(c) || 'col_' + (i + 1));
      const rows = trs.slice(1).map(tr =>
        Array.from(tr.querySelectorAll('th, td')).map(text)
      ).filter(r => r.length);
      if (rows.length) {
        out.push({ source: 'table #' + (ti + 1), headers, rows });
      }
    });
    return out;
  }

  function extractLists() {
    const out = [];
    document.querySelectorAll('ul, ol').forEach((list, li) => {
      const items = Array.from(list.children)
        .filter(c => c.tagName === 'LI')
        .map(text)
        .filter(Boolean);
      if (items.length >= 2) { // skip one-item decoration lists
        out.push({ source: 'list #' + (li + 1), headers: ['item'], rows: items.map(i => [i]) });
      }
    });
    return out;
  }

  /** Flatten one JSON object to key/value rows, one level deep. */
  function flatten(obj, prefix, rows) {
    for (const key of Object.keys(obj)) {
      const val = obj[key];
      const label = prefix ? prefix + '.' + key : key;
      if (val !== null && typeof val === 'object' && !Array.isArray(val)) {
        flatten(val, label, rows);
      } else {
        rows.push([label, Array.isArray(val) ? val.map(String).join('; ') : String(val)]);
      }
    }
  }

  function extractJsonLd() {
    const out = [];
    document.querySelectorAll('script[type="application/ld+json"]').forEach((s, i) => {
      try {
        const data = JSON.parse(s.textContent);
        const items = Array.isArray(data) ? data : [data];
        items.forEach((obj, j) => {
          if (obj && typeof obj === 'object') {
            const rows = [];
            flatten(obj, '', rows);
            if (rows.length) {
              out.push({ source: 'json-ld #' + (i + 1) + (items.length > 1 ? ' item ' + (j + 1) : ''), headers: ['field', 'value'], rows });
            }
          }
        });
      } catch (e) { /* invalid JSON-LD block -> skip */ }
    });
    return out;
  }

  function extractCustom(selector) {
    const out = [];
    if (!selector) return out;
    try {
      const matches = Array.from(document.querySelectorAll(selector)).map(text).filter(Boolean);
      if (matches.length) {
        out.push({ source: 'selector: ' + selector, headers: ['text'], rows: matches.map(m => [m]) });
      }
    } catch (e) { /* invalid selector -> empty result */ }
    return out;
  }

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (!msg || msg.action !== 'scrape') return false;
    let datasets = [];
    try {
      if (msg.preset === 'tables') datasets = extractTables();
      else if (msg.preset === 'lists') datasets = extractLists();
      else if (msg.preset === 'jsonld') datasets = extractJsonLd();
      else if (msg.preset === 'custom') datasets = extractCustom(msg.selector);
    } catch (e) {
      sendResponse({ ok: false, error: String(e && e.message || e) });
      return false;
    }
    sendResponse({ ok: true, datasets });
    return false;
  });
})();
