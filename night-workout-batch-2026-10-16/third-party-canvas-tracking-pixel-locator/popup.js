/* Canvas Pixel Locator — popup logic */
const $ = (id) => document.getElementById(id);

const scanBtn = $('scanBtn');
const results = $('results');
const emptyState = $('emptyState');

function verdictFor(score) {
  if (score >= 90) return ['Clean — no tracking indicators found', 'var(--ok)'];
  if (score >= 70) return ['Low concern — a few indicators', 'var(--accent)'];
  if (score >= 40) return ['Moderate concern — notable tracking signs', 'var(--warn)'];
  return ['High concern — strong tracking indicators', 'var(--danger)'];
}

scanBtn.addEventListener('click', async () => {
  scanBtn.disabled = true;
  scanBtn.textContent = 'Scanning…';
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id) throw new Error('No active tab.');
    if (!/^https?:/.test(tab.url || '')) {
      throw new Error('Scan works on regular http(s) pages only.');
    }
    // Run the scanner in the page's MAIN world so canvas hooks work.
    const [res] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['content.js'],
      world: 'MAIN'
    });
    render(res.result);
  } catch (err) {
    emptyState.innerHTML = 'Scan failed: ' + escapeHtml(err.message || String(err));
    emptyState.classList.remove('hidden');
    results.classList.add('hidden');
  } finally {
    scanBtn.disabled = false;
    scanBtn.textContent = 'Scan this page';
  }
});

function render(data) {
  if (!data) return;
  emptyState.classList.add('hidden');
  results.classList.remove('hidden');

  $('scoreNum').textContent = data.score;
  const [verdict, color] = verdictFor(data.score);
  const vEl = $('verdict');
  vEl.textContent = verdict;
  vEl.style.color = color;
  $('summaryLine').textContent =
    data.canvasCount + ' canvas(es) · ' + data.imageCount + ' image(s) · ' +
    data.thirdPartyTrackers + ' tracker domain(s)';

  const box = $('findings');
  box.innerHTML = '';
  if (!data.findings.length) {
    box.innerHTML = '<div class="finding low"><div class="f-title">All clear <span class="sev low">none</span></div>' +
      '<div class="f-desc">No hidden canvases, tracking pixels, or known tracker endpoints detected on this page.</div></div>';
    return;
  }
  const order = { high: 0, medium: 1, low: 2 };
  data.findings
    .slice()
    .sort((a, b) => order[a.severity] - order[b.severity])
    .forEach((f) => {
      const el = document.createElement('div');
      el.className = 'finding ' + f.severity;
      el.innerHTML =
        '<div class="f-title">' + escapeHtml(f.title) +
        '<span class="sev ' + f.severity + '">' + f.severity + '</span></div>' +
        '<div class="f-desc">' + escapeHtml(f.description) + '</div>';
      box.appendChild(el);
    });
}

$('clearBtn').addEventListener('click', () => {
  results.classList.add('hidden');
  emptyState.classList.remove('hidden');
  emptyState.textContent = 'Click “Scan this page” to run the privacy scan.';
});

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[c]);
}
