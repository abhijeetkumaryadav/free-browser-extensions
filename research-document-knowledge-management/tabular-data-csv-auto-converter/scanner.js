/* TableSnatch content script (injected on demand via scripting.executeScript).
 * Read-only: scans the DOM for real <table> elements and returns a compact
 * description of each. Runs in the MAIN world is not required — ISOLATED is
 * fine since we only read DOM properties.
 */
'use strict';

(() => {
  /** Extract visible text from a cell, collapsing whitespace. */
  function cellText(cell) {
    // Prefer innerText (respects visibility) but fall back to textContent.
    const t = (cell.innerText !== undefined ? cell.innerText : cell.textContent) || '';
    return t.replace(/\s+/g, ' ').trim();
  }

  /** Flatten a table into rows of cell strings, expanding colspan. */
  function tableToRows(table) {
    const rows = [];
    const trs = table.querySelectorAll('tr');
    for (const tr of trs) {
      const cells = tr.querySelectorAll('th, td');
      if (!cells.length) continue;
      const row = [];
      for (const cell of cells) {
        row.push(cellText(cell));
        const span = parseInt(cell.getAttribute('colspan') || '1', 10);
        for (let i = 1; i < span && i < 20; i++) row.push('');
      }
      rows.push(row);
    }
    return rows;
  }

  /** Human label: caption, aria-label, or nearby heading, else fallback. */
  function tableLabel(table, index) {
    const cap = table.querySelector('caption');
    if (cap && cellText(cap)) return cellText(cap).slice(0, 60);
    const aria = table.getAttribute('aria-label');
    if (aria) return aria.slice(0, 60);
    let el = table.previousElementSibling;
    for (let i = 0; i < 3 && el; i++, el = el.previousElementSibling) {
      if (/^H[1-6]$/.test(el.tagName) && cellText(el)) {
        return cellText(el).slice(0, 60);
      }
    }
    return 'Table ' + (index + 1);
  }

  function scan() {
    const out = [];
    const tables = Array.from(document.querySelectorAll('table'));
    tables.forEach((table, i) => {
      const rows = tableToRows(table);
      if (!rows.length) return;
      const cols = Math.max(...rows.map(r => r.length));
      out.push({
        index: i,
        label: tableLabel(table, i),
        rows: rows.length,
        cols,
        preview: rows.slice(0, 4).map(r => r.slice(0, 6)),
        full: rows
      });
    });
    return out;
  }

  return scan();
})();
