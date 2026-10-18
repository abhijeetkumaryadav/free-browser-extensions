/* Property Dedupe Planner — fuzzy duplicate detection (Levenshtein) + merge-plan export.
   All logic runs on-device; nothing is ever sent anywhere. */

'use strict';

/* ---------- Levenshtein distance ---------- */
function levenshtein(a, b) {
  const m = a.length, n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let prev = new Array(n + 1), curr = new Array(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    const ca = a.charCodeAt(i - 1);
    for (let j = 1; j <= n; j++) {
      const cost = ca === b.charCodeAt(j - 1) ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[n];
}

/* Normalized similarity: 1 = identical. Compares on a normalized form
   (lowercased, non-alphanumerics stripped) so "First Name" ~= "firstname". */
function similarity(a, b) {
  const norm = s => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  const na = norm(a), nb = norm(b);
  if (na === nb) return 1;
  if (!na || !nb) return 0;
  const dist = levenshtein(na, nb);
  return 1 - dist / Math.max(na.length, nb.length);
}

/* ---------- Grouping (single-linkage clustering over the similarity graph) ---------- */
function findGroups(names, threshold) {
  const n = names.length;
  const parent = names.map((_, i) => i);
  const find = x => (parent[x] === x ? x : (parent[x] = find(parent[x])));
  const union = (a, b) => { parent[find(a)] = find(b); };

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (similarity(names[i], names[j]) >= threshold) union(i, j);
    }
  }

  const buckets = new Map();
  names.forEach((name, i) => {
    const root = find(i);
    if (!buckets.has(root)) buckets.set(root, []);
    buckets.get(root).push({ name, idx: i });
  });

  // Only keep groups with 2+ members; compute min pairwise similarity.
  const groups = [];
  for (const members of buckets.values()) {
    if (members.length < 2) continue;
    let minSim = 1;
    for (let i = 0; i < members.length; i++) {
      for (let j = i + 1; j < members.length; j++) {
        minSim = Math.min(minSim, similarity(members[i].name, members[j].name));
      }
    }
    groups.push({ members, minSim });
  }
  groups.sort((a, b) => b.members.length - a.members.length || a.minSim - b.minSim);
  return groups;
}

/* ---------- State ---------- */
let groups = [];            // [{members:[{name,idx}], minSim}]
let decisions = {};         // idx -> 'keep' | 'merge' | 'delete'

/* ---------- DOM ---------- */
const $ = id => document.getElementById(id);
const input = $('propInput'), resultsPanel = $('resultsPanel'), exportPanel = $('exportPanel');
const groupsList = $('groupsList'), noDupes = $('noDupes'), groupCount = $('groupCount');
const threshold = $('threshold'), thresholdVal = $('thresholdVal');

/* ---------- Parse input: one per line, or CSV (first column) ---------- */
function parseNames(text) {
  const names = [];
  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim();
    if (!line) continue;
    // If it looks like CSV, take the first column.
    let name = line;
    if (line.includes(',')) {
      const first = line.split(',')[0].trim().replace(/^"|"$/g, '');
      if (first) name = first;
    }
    if (name && !names.includes(name)) names.push(name);
  }
  return names;
}

const SAMPLE = `First Name
firstname
First name
Company
Company Name
companyname
Email
email address
Email Address
Phone Number
phone
phone_number
Lifecycle Stage
lifecyclestage
Annual Revenue
annualrevenue
Annual_Revenue`;

function runAnalysis() {
  const names = parseNames(input.value);
  if (names.length < 2) {
    alert('Paste at least two property names to analyze.');
    return;
  }
  const t = threshold.value / 100;
  groups = findGroups(names, t);
  decisions = {};
  groups.forEach(g => g.members.forEach(m => { decisions[m.idx] = 'merge'; }));
  renderGroups();
  resultsPanel.classList.remove('hidden');
  exportPanel.classList.toggle('hidden', groups.length === 0);
  // Remember the last input for convenience.
  chrome.storage.local.set({ lastInput: input.value }).catch(() => {});
}

function renderGroups() {
  groupsList.innerHTML = '';
  const t = threshold.value / 100;
  const visible = groups.filter(g => g.minSim >= t * 0.999); // slider re-filters live
  groupCount.textContent = visible.length + (visible.length === 1 ? ' group' : ' groups');
  noDupes.classList.toggle('hidden', visible.length > 0);

  visible.forEach((g, gi) => {
    const el = document.createElement('div');
    el.className = 'group';

    const head = document.createElement('div');
    head.className = 'group-head';
    head.innerHTML =
      '<span class="group-num">Group ' + (gi + 1) + '</span>' +
      '<span class="sim-badge">min similarity ' + Math.round(g.minSim * 100) + '%</span>';
    el.appendChild(head);

    g.members.forEach(m => {
      const row = document.createElement('div');
      row.className = 'member';

      const name = document.createElement('span');
      name.className = 'member-name';
      name.textContent = m.name;
      name.title = m.name;
      row.appendChild(name);

      const dec = document.createElement('div');
      dec.className = 'decision';
      ['keep', 'merge', 'delete'].forEach(d => {
        const b = document.createElement('button');
        b.className = 'dec-btn' + (decisions[m.idx] === d ? ' active-' + d : '');
        b.textContent = d[0].toUpperCase() + d.slice(1);
        b.title = 'Mark as ' + d;
        b.addEventListener('click', () => {
          decisions[m.idx] = d;
          renderGroups();
        });
        dec.appendChild(b);
      });
      row.appendChild(dec);
      el.appendChild(row);
    });

    groupsList.appendChild(el);
  });
}

/* ---------- Export: merge plan CSV ---------- */
function buildPlanCsv() {
  const rows = [['group', 'property', 'decision', 'canonical_name']];
  const t = threshold.value / 100;
  groups.filter(g => g.minSim >= t * 0.999).forEach((g, gi) => {
    const canonical = g.members.find(m => decisions[m.idx] === 'keep');
    g.members.forEach(m => {
      rows.push([
        'Group ' + (gi + 1),
        m.name,
        decisions[m.idx],
        decisions[m.idx] === 'keep' ? m.name : (canonical ? canonical.name : '')
      ]);
    });
  });
  return rows.map(r => r.map(c => '"' + String(c).replace(/"/g, '""') + '"').join(',')).join('\r\n');
}

function downloadCsv() {
  const csv = buildPlanCsv();
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'property-merge-plan.csv';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/* ---------- Events ---------- */
$('analyzeBtn').addEventListener('click', runAnalysis);
$('loadSample').addEventListener('click', () => { input.value = SAMPLE; });
$('clearInput').addEventListener('click', () => {
  input.value = '';
  groups = []; decisions = {};
  resultsPanel.classList.add('hidden');
  exportPanel.classList.add('hidden');
});
threshold.addEventListener('input', () => {
  thresholdVal.textContent = threshold.value + '%';
  if (groups.length) {
    renderGroups();
    exportPanel.classList.toggle('hidden',
      !groups.some(g => g.minSim >= (threshold.value / 100) * 0.999));
  }
});
$('copyPlan').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(buildPlanCsv());
    $('copyPlan').textContent = 'Copied!';
    setTimeout(() => { $('copyPlan').textContent = 'Copy plan CSV'; }, 1500);
  } catch { alert('Copy failed — try Download instead.'); }
});
$('downloadPlan').addEventListener('click', downloadCsv);

/* Restore last input on open. */
chrome.storage.local.get('lastInput').then(r => {
  if (r.lastInput) input.value = r.lastInput;
}).catch(() => {});
