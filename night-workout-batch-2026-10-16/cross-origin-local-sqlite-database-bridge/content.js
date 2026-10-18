/* Scrape Export Bridge — content script (injected on explicit user click only).
   Extracts structured data from the current page: tables, lists, JSON-LD, custom selectors.
   Guarded against double injection. */
(() => {
  if (window.__sebInjected) return;
  window.__sebInjected = true;

  // --- helpers -----------------------------------------------------------
  const cleanText = (el) => (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim();

  // Flatten one level of a JSON object: nested objects/arrays become JSON strings.
  function flatten(obj, prefix = '', out = {}) {
    for (const [k, v] of Object.entries(obj)) {
      const key = prefix ? `${prefix}.${k}` : k;
      if (v !== null && typeof v === 'object') {
        out[key] = JSON.stringify(v);
      } else {
        out[key] = v === undefined || v === null ? '' : String(v);
      }
    }
    return out;
  }

  // --- extractors ----------------------------------------------------------
  function extractTables() {
    const tables = [...document.querySelectorAll('table')].filter(t => t.offsetParent !== null);
    const all = [];
    for (const table of tables) {
      const rows = [...table.querySelectorAll('tr')];
      if (rows.length < 2) continue; // need header + at least one data row
      const headerCells = [...rows[0].querySelectorAll('th, td')].map(cleanText);
      if (headerCells.every(h => h === '')) continue;
      const headers = headerCells.map((h, i) => h || `col_${i + 1}`);
      for (const row of rows.slice(1)) {
        const cells = [...row.querySelectorAll('td, th')].map(cleanText);
        if (cells.every(c => c === '')) continue;
        const obj = {};
        headers.forEach((h, i) => { obj[h] = cells[i] ?? ''; });
        all.push(obj);
      }
    }
    return all;
  }

  function extractLists() {
    const lists = [...document.querySelectorAll('ul, ol')].filter(l => l.offsetParent !== null);
    const all = [];
    for (const list of lists) {
      // Skip nav/pagination lists
      const cls = (list.className || '').toString().toLowerCase();
      if (/nav|menu|breadcrumb|pagination|pager/.test(cls)) continue;
      const items = [...list.querySelectorAll(':scope > li')].map(cleanText).filter(t => t.length > 0);
      if (items.length < 2) continue;
      items.forEach((text, i) => all.push({ list_index: i + 1, text }));
    }
    return all;
  }

  function extractJsonLd() {
    const all = [];
    for (const script of document.querySelectorAll('script[type="application/ld+json"]')) {
      let data;
      try { data = JSON.parse(script.textContent); } catch { continue; }
      const items = Array.isArray(data) ? data : (data['@graph'] || [data]);
      for (const item of items) {
        if (item && typeof item === 'object') all.push(flatten(item));
      }
    }
    return all;
  }

  function extractCustom(selector) {
    const els = [...document.querySelectorAll(selector)].filter(e => e.offsetParent !== null);
    return els.slice(0, 2000).map((el, i) => ({
      index: i + 1,
      text: cleanText(el).slice(0, 500),
      tag: el.tagName.toLowerCase()
    }));
  }

  // --- message handler -----------------------------------------------------
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.type !== 'SEB_EXTRACT') return false;
    try {
      let rows = [];
      switch (msg.source) {
        case 'tables': rows = extractTables(); break;
        case 'lists': rows = extractLists(); break;
        case 'jsonld': rows = extractJsonLd(); break;
        case 'custom': rows = extractCustom(msg.selector || ''); break;
      }
      sendResponse({ ok: true, rows });
    } catch (err) {
      sendResponse({ ok: false, error: String(err && err.message || err) });
    }
    return true;
  });
})();
