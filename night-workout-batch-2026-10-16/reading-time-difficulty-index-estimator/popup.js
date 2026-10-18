/* ReadGauge popup — requests analysis from the background worker, renders the
 * ease gauge, verdict, and stats. Heuristic estimates only. */

const $ = (id) => document.getElementById(id);
const ARC_LEN = 163.4; // dash length of the gauge arc

function band(ease) {
  // Flesch-style interpretation bands
  if (ease >= 90) return 'Very easy — a child could read it';
  if (ease >= 80) return 'Easy — conversational plain English';
  if (ease >= 70) return 'Fairly easy — most adults';
  if (ease >= 60) return 'Standard — plain adult reading';
  if (ease >= 50) return 'Fairly difficult — some effort';
  if (ease >= 30) return 'Difficult — academic style';
  return 'Very difficult — dense academic/legal prose';
}

function fmtTime(minutes) {
  if (minutes < 1) return `${Math.max(1, Math.round(minutes * 60))} sec`;
  if (minutes < 60) return `${Math.round(minutes)} min`;
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return m ? `${h}h ${m}m` : `${h}h`;
}

function render(result) {
  $('error').classList.add('hidden');
  $('results').classList.remove('hidden');
  const ease = Math.round(result.ease);
  $('gauge-arc').style.strokeDashoffset = String(ARC_LEN * (1 - ease / 100));
  $('gauge-num').textContent = String(ease);
  $('verdict').textContent = band(ease);
  $('st-time').textContent = fmtTime(result.minutes);
  $('st-words').textContent = result.wordCount.toLocaleString();
  $('st-sent').textContent = result.sentences.toLocaleString();
  $('st-asl').textContent = result.avgSentence.toFixed(1);
  $('source-line').textContent =
    result.source === 'selection'
      ? 'Measured from your selected text.'
      : 'Measured from this page\u2019s main text.';
}

function showError(msg) {
  $('results').classList.add('hidden');
  const e = $('error');
  e.textContent = msg;
  e.classList.remove('hidden');
}

$('btn-analyze').addEventListener('click', async () => {
  const btn = $('btn-analyze');
  btn.disabled = true;
  btn.textContent = 'Analyzing…';
  try {
    const result = await chrome.runtime.sendMessage({ type: 'analyze-page' });
    if (!result || result.error) showError(result ? result.error : 'Analysis failed.');
    else render(result);
  } catch (e) {
    showError('Could not reach the background worker.');
  }
  btn.disabled = false;
  btn.textContent = 'Analyze this page';
});

/* If a context-menu analysis of selected text just ran, show it immediately. */
(async function init() {
  const out = await chrome.storage.local.get('readgauge.last');
  if (out['readgauge.last']) {
    render(out['readgauge.last']);
    chrome.storage.local.remove('readgauge.last');
  }
})();
