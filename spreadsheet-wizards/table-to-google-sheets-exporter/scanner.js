/* SheetsReady — injected on demand into the active tab (MAIN world isolation
   not needed; runs in the extension's isolated world). Read-only: collects
   <table> elements and returns plain data. Never modifies the page. */
(() => {
  // Label a table from caption / aria-label / nearby heading text
  function labelTable(table, index) {
    const cap = table.querySelector('caption');
    if (cap && cap.textContent.trim()) return cap.textContent.trim().slice(0, 60);
    const aria = table.getAttribute('aria-label');
    if (aria && aria.trim()) return aria.trim().slice(0, 60);
    // Look backwards for a heading-ish element
    let el = table.previousElementSibling, hops = 0;
    while (el && hops < 4) {
      if (/^H[1-4]$/.test(el.tagName) && el.textContent.trim()) {
        return el.textContent.trim().slice(0, 60);
      }
      el = el.previousElementSibling;
      hops++;
    }
    return `Table ${index + 1}`;
  }

  function tableToRows(table) {
    const rows = [];
    // Prefer explicit sections in document order
    const trs = table.querySelectorAll('tr');
    trs.forEach((tr) => {
      // Skip rows that belong to a nested table
      if (tr.closest('table') !== table) return;
      const cells = [];
      tr.querySelectorAll('th, td').forEach((cell) => {
        if (cell.closest('table') !== table) return;
        cells.push(cell.innerText.replace(/\s+/g, ' ').trim());
      });
      if (cells.length) rows.push(cells);
    });
    return rows;
  }

  const tables = [];
  document.querySelectorAll('table').forEach((table, i) => {
    // Skip layout-ish single-cell tables and invisible ones
    const rect = table.getBoundingClientRect();
    if (rect.width < 40 || rect.height < 20) return;
    const rows = tableToRows(table);
    if (!rows.length) return;
    tables.push({ label: labelTable(table, i), rows });
  });
  return tables;
})();
