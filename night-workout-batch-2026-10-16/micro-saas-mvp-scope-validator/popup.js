/* MVP Scope Validator — popup logic.
 * Bundled scope heuristics (labeled as rules-of-thumb, NOT business advice):
 *  H1: must-have effort above ~60 days is rarely a real MVP.
 *  H2: any single feature above ~15 days usually hides a sub-project — split it.
 *  H3: nice-to-haves shipped in the MVP are the classic scope creep source.
 *  H4: more than ~12 must-haves means the "minimum" is not minimal.
 * Risk score is a weighted blend of these signals, 0–100.
 */
'use strict';

const STORE = 'msv_features';
let features = []; // {id, name, days, prio:'must'|'nice'}

/* ---------- storage ---------- */
async function loadState() {
  const res = await chrome.storage.local.get([STORE]);
  features = res[STORE] || [];
}
async function saveState() {
  await chrome.storage.local.set({ [STORE]: features });
}

/* ---------- dom ---------- */
const $ = (id) => document.getElementById(id);
function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

/* ---------- pure analysis (kept side-effect free for testing) ---------- */
function analyze(list) {
  const must = list.filter((f) => f.prio === 'must');
  const nice = list.filter((f) => f.prio === 'nice');
  const mustDays = must.reduce((a, f) => a + f.days, 0);
  const niceDays = nice.reduce((a, f) => a + f.days, 0);
  const totalDays = mustDays + niceDays;
  const bigSingles = list.filter((f) => f.days > 15);
  const inMvpNice = nice.filter((f) => f.days > 0);

  // Weighted risk score 0–100
  let score = 0;
  score += Math.min(45, (mustDays / 60) * 45);        // H1
  score += Math.min(20, bigSingles.length * 7);      // H2
  score += Math.min(20, niceDays > 0 ? 12 : 0);      // H3 (any nice-have in MVP)
  score += Math.min(15, Math.max(0, must.length - 12) * 5); // H4
  score = Math.round(Math.min(100, score));

  let band, note;
  if (list.length === 0) {
    band = 'none'; note = 'Add features to get a scope reading.';
  } else if (score < 35) {
    band = 'low'; note = 'Lean scope — this looks like a genuine minimum. Ship it.';
  } else if (score < 65) {
    band = 'medium'; note = 'Getting chunky. Review the suggested cuts before committing.';
  } else {
    band = 'high'; note = 'Too big for an MVP. Cut ruthlessly — ship the smallest valuable slice.';
  }

  const suggestions = [];
  if (bigSingles.length > 0) {
    bigSingles.forEach((f) => suggestions.push({
      kind: 'cut',
      title: `Split "${f.name}"`,
      text: `Estimated ${fmtDays(f.days)} — features over ~15 days usually hide a sub-project. Break it into smaller shippable pieces.`
    }));
  }
  if (inMvpNice.length > 0) {
    suggestions.push({
      kind: 'cut',
      title: `Defer ${inMvpNice.length} nice-to-have${inMvpNice.length > 1 ? 's' : ''}`,
      text: `Nice-to-haves in the first release are the classic scope-creep source. Ship must-haves first (${fmtDays(mustDays)}), add these later.`
    });
  }
  if (must.length > 12) {
    suggestions.push({
      kind: 'cut',
      title: `Too many must-haves (${must.length})`,
      text: `More than ~12 must-haves means the "minimum" is not minimal. Ask of each: would v1 fail without it?`
    });
  }
  if (mustDays > 60) {
    suggestions.push({
      kind: 'cut',
      title: `Must-have effort: ${fmtDays(mustDays)}`,
      text: `Above the ~60-day rule-of-thumb for an MVP. Rank must-haves by risk, not preference, and cut to the smallest slice users will pay for.`
    });
  }
  if (list.length > 0 && suggestions.length === 0) {
    suggestions.push({
      kind: 'ok',
      title: 'Scope looks healthy',
      text: 'No red flags from the heuristic checklist. Keep the list short and ship.'
    });
  }
  return { must, nice, mustDays, niceDays, totalDays, bigSingles, score, band, note, suggestions };
}

function fmtDays(d) {
  if (d >= 30) return (d / 30).toFixed(1).replace(/\.0$/, '') + ' mo';
  if (d >= 7) return (d / 7).toFixed(1).replace(/\.0$/, '') + ' wk';
  return d + ' day' + (d === 1 ? '' : 's');
}

/* ---------- rendering ---------- */
const CIRC = 2 * Math.PI * 52;

function render() {
  const a = analyze(features);

  // ring
  const arc = $('riskArc');
  arc.style.strokeDashoffset = String(CIRC * (1 - a.score / 100));
  arc.setAttribute('stroke', a.band === 'high' ? '#fb7185' : a.band === 'medium' ? '#fbbf24' : '#34d399');
  $('riskScore').textContent = a.score;
  const band = $('riskBand');
  band.className = 'risk-band ' + a.band;
  band.textContent = a.band === 'none' ? '—' : a.band + ' risk';
  $('riskNote').textContent = a.note;

  // suggestions
  const box = $('suggestions');
  box.innerHTML = '';
  if (a.suggestions.length === 0) {
    box.innerHTML = '<div class="empty">Suggestions appear here after analysis.</div>';
  } else {
    a.suggestions.forEach((s) => {
      const el = document.createElement('div');
      el.className = 'sug ' + s.kind;
      el.innerHTML = `<strong>${esc(s.title)}</strong><span>${esc(s.text)}</span>`;
      box.appendChild(el);
    });
  }

  // feature list
  const fl = $('featList');
  fl.innerHTML = '';
  if (features.length === 0) {
    fl.innerHTML = '<div class="empty">No features yet. Add your first one above.</div>';
  } else {
    [...features].sort((x, y) => (y.prio === 'must') - (x.prio === 'must') || y.days - x.days)
      .forEach((f) => {
        const row = document.createElement('div');
        row.className = 'feat';
        row.innerHTML =
          `<span class="f-name">${esc(f.name)}</span>` +
          `<span class="f-days">${fmtDays(f.days)}</span>` +
          `<span class="f-prio ${f.prio}">${f.prio === 'must' ? 'Must' : 'Nice'}</span>` +
          `<button class="f-del" title="Delete feature">×</button>`;
        row.querySelector('.f-del').addEventListener('click', async () => {
          features = features.filter((x) => x.id !== f.id);
          await saveState(); render();
        });
        fl.appendChild(row);
      });
  }

  $('statsLine').textContent =
    features.length === 0
      ? 'Your list is stored locally — nothing leaves the browser.'
      : `${features.length} feature(s) · ${fmtDays(a.mustDays)} must-have · ${fmtDays(a.niceDays)} nice-to-have`;
}

/* ---------- add feature ---------- */
function initAdd() {
  const add = async () => {
    const name = $('featName').value.trim();
    const days = parseFloat($('featDays').value);
    if (!name) { $('featName').focus(); return; }
    if (!days || days <= 0) { $('featDays').focus(); return; }
    features.push({ id: 'f' + Date.now(), name, days, prio: $('featPrio').value });
    await saveState();
    $('featName').value = ''; $('featDays').value = '';
    render();
  };
  $('addFeat').addEventListener('click', add);
  $('featName').addEventListener('keydown', (e) => { if (e.key === 'Enter') add(); });
  $('featDays').addEventListener('keydown', (e) => { if (e.key === 'Enter') add(); });
}

/* ---------- export ---------- */
function initExport() {
  $('copySummary').addEventListener('click', async () => {
    const a = analyze(features);
    const lines = [
      'MVP SCOPE SUMMARY',
      '=================',
      `Features: ${features.length} (${a.must.length} must-have, ${a.nice.length} nice-to-have)`,
      `Must-have effort: ${fmtDays(a.mustDays)}`,
      `Nice-to-have effort: ${fmtDays(a.niceDays)}`,
      `Scope risk score: ${a.score}/100 (${a.band})`,
      '',
      'Features:'
    ];
    features.forEach((f) => lines.push(
      `- ${f.name} — ${fmtDays(f.days)} — ${f.prio === 'must' ? 'must-have' : 'nice-to-have'}`));
    lines.push('', 'Suggested cuts:');
    a.suggestions.forEach((s) => lines.push(`- ${s.title}: ${s.text}`));
    lines.push('', '(Heuristic checklist only — not business advice.)');
    await navigator.clipboard.writeText(lines.join('\n'));
    $('copySummary').textContent = 'Copied!';
    setTimeout(() => { $('copySummary').textContent = 'Copy scope summary'; }, 1500);
  });
  $('clearAll').addEventListener('click', async () => {
    if (!confirm('Delete all features?')) return;
    features = [];
    await saveState(); render();
  });
}

/* ---------- init ---------- */
document.addEventListener('DOMContentLoaded', async () => {
  await loadState();
  initAdd();
  initExport();
  render();
});
