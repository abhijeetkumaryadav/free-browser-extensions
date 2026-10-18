// Popup logic: search the bundled Rx dictionary, or decode abbreviations in a
// pasted label line. Educational reference only — NOT medical advice.
// All matching is local, case-insensitive, whole-word where possible.

(() => {
  'use strict';

  const TERMS = (window.RX_TERMS || []).slice();
  // Sort by abbreviation length desc so multi-word keys ("ad lib") match first.
  TERMS.sort((a, b) => b.abbr.length - a.abbr.length);
  const byAbbr = new Map(TERMS.map((t) => [t.abbr.toLowerCase(), t]));

  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));

  function renderTerms(list) {
    const box = $('terms');
    $('count').textContent = list.length;
    box.innerHTML = '';
    if (!list.length) {
      box.innerHTML = '<p class="no-results">No matches in the dictionary. Try fewer letters, or paste a label line above.</p>';
      return;
    }
    for (const t of list) {
      const d = document.createElement('div');
      d.className = 'term';
      d.innerHTML = '<span class="abbr">' + esc(t.abbr) + '</span>' +
        '<span class="def">' + esc(t.means) +
        (t.note ? ' <span class="note">(' + esc(t.note) + ')</span>' : '') + '</span>';
      box.appendChild(d);
    }
  }

  // Live search: match abbreviation prefix or words in the definition.
  $('search').addEventListener('input', (e) => {
    const q = e.target.value.trim().toLowerCase();
    if (!q) { renderTerms(TERMS); return; }
    renderTerms(TERMS.filter((t) =>
      t.abbr.toLowerCase().startsWith(q) ||
      t.means.toLowerCase().includes(q) ||
      (t.note || '').toLowerCase().includes(q)));
  });

  // Decode a pasted label line: find whole-word abbreviations, explain each.
  $('decodeBtn').addEventListener('click', () => {
    const line = $('paste').value.trim();
    const out = $('decodeOut');
    if (!line) { out.hidden = true; return; }
    const words = line.split(/[\s,;]+/);
    const found = [];
    const seen = new Set();
    for (const w of words) {
      const clean = w.replace(/^[("'\[]+|[).,"'\]]+$/g, '').toLowerCase();
      if (!clean) continue;
      const t = byAbbr.get(clean);
      if (t && !seen.has(t.abbr)) { seen.add(t.abbr); found.push(t); }
    }
    out.hidden = false;
    if (!found.length) {
      out.innerHTML = '<strong>No known abbreviations found</strong> in that line. It may use plain words, a brand name, or an abbreviation outside our dictionary — ask your pharmacist.';
      return;
    }
    out.innerHTML = found.map((t) =>
      '<span class="found">' + esc(t.abbr) + '</span> → <strong>' + esc(t.means) + '</strong>' +
      (t.note ? ' <span style="color:var(--muted)">(' + esc(t.note) + ')</span>' : '') + '<br>').join('') +
      '<div style="margin-top:8px;font-size:11px;color:var(--muted)">Still unsure? Ask your pharmacist or doctor — never guess a dose.</div>';
  });

  renderTerms(TERMS);
})();
