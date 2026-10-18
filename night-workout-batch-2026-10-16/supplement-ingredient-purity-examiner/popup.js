// Label Lens — popup controller (wires UI to the rule engine).
'use strict';

/** Switch between the three tabs. */
document.querySelectorAll('.tab').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach((b) => b.classList.remove('active'));
    document.querySelectorAll('.tabpane').forEach((p) => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
  });
});

/** Render scan results into the popup. */
function renderResults({ verdict, worst, hits, stats }) {
  const verdictEl = document.getElementById('verdict');
  const statsEl = document.getElementById('stats');
  const resultsEl = document.getElementById('results');
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  verdictEl.classList.remove('hidden', 'clean', 'med', 'high');
  verdictEl.classList.add(worst === 'CLEAN' ? 'clean' : worst === 'HIGH' ? 'high' : 'med');
  verdictEl.textContent = verdict;
  if (stats && (stats.servingSize || stats.servingsPerContainer)) {
    statsEl.classList.remove('hidden');
    statsEl.textContent =
      (stats.servingSize ? 'Serving size: ' + stats.servingSize : '') +
      (stats.servingSize && stats.servingsPerContainer ? '  •  ' : '') +
      (stats.servingsPerContainer ? 'Servings/container: ' + stats.servingsPerContainer : '');
  } else {
    statsEl.classList.add('hidden');
  }
  resultsEl.innerHTML = '';
  for (const h of hits) {
    const div = document.createElement('div');
    div.className = 'hit';
    div.innerHTML =
      '<div class="head"><span class="cat">' + esc(h.category) + '</span>' +
      '<span class="sev ' + h.severity + '">' + h.severity + '</span></div>' +
      '<h3>' + esc(h.title) + '</h3>' +
      '<div class="match">&ldquo;' + esc(h.match) + '&rdquo;</div>' +
      (h.snippet ? '<div class="snippet">' + esc(h.snippet) + '</div>' : '') +
      '<div class="why">' + esc(h.why) + '</div>';
    resultsEl.appendChild(div);
  }
}

/** Analyze whatever text is in the textarea. */
function analyzeText(text) {
  const v = document.getElementById('verdict');
  if (!text || !text.trim()) {
    v.classList.remove('hidden'); v.className = 'verdict med';
    v.textContent = 'Paste a supplement label first.';
    return;
  }
  renderResults(scanLabel(text));
  chrome.storage.local.set({ lastScan: text.slice(0, 20000) });
}

document.getElementById('analyze').addEventListener('click', () => {
  analyzeText(document.getElementById('label').value);
});

/** Scan the focused field or current selection (click-only, read-only). */
document.getElementById('grab').addEventListener('click', async () => {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id || /^chrome/.test(tab.url || '')) {
      const v = document.getElementById('verdict');
      v.className = 'verdict med'; v.textContent = 'Cannot scan internal browser pages.';
      return;
    }
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });
    const resp = await chrome.tabs.sendMessage(tab.id, { type: 'GRAB_TEXT' });
    if (resp && resp.text) {
      document.getElementById('label').value = resp.text;
      analyzeText(resp.text);
    } else {
      const v = document.getElementById('verdict');
      v.className = 'verdict med'; v.textContent = 'No focused field or selected text found.';
    }
  } catch (e) {
    const v = document.getElementById('verdict');
    v.className = 'verdict med'; v.textContent = 'Scan failed: ' + (e.message || e);
  }
});

/** Render the reference list of all bundled rules. */
function renderRuleList() {
  const list = document.getElementById('ruleList');
  const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  list.innerHTML = LABEL_RULES.map((r) =>
    '<div class="rule"><div class="head"><h4>' + esc(r.title) + '</h4>' +
    '<span class="sev ' + r.severity + '">' + r.severity + '</span></div>' +
    '<p>' + esc(r.why) + '</p></div>'
  ).join('');
}
renderRuleList();

/** Restore the last pasted scan text. */
chrome.storage.local.get('lastScan', (d) => {
  if (d.lastScan) document.getElementById('label').value = d.lastScan;
});
