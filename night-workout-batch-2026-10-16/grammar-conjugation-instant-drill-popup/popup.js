// Conjugation Drill — verb tables + drill engine (100% local).
// ENGINE-START
// ---------------- pure helpers (testable) ----------------
/** Parse table input into {name, forms[]} or an error string. */
function parseTable(name, formsText) {
  const clean = (name || '').trim();
  if (!clean) return { error: 'Enter a verb name.' };
  const forms = (formsText || '').split('\n').map(s => s.trim()).filter(Boolean);
  if (forms.length < 2) return { error: 'Add at least 2 forms.' };
  return { table: { id: 't' + Date.now().toString(36), name: clean, forms } };
}

/** Build a drill deck of n questions from a table: [{promptIdx, answerIdx}]. */
function buildDeck(table, count, rand = Math.random) {
  const n = Math.max(1, Math.min(50, parseInt(count, 10) || 10));
  const deck = [];
  for (let i = 0; i < n; i++) {
    const answerIdx = Math.floor(rand() * table.forms.length);
    // Prompt shows the form number (1-based) + verb; answer is the form.
    deck.push({ answerIdx });
  }
  return deck;
}

/** Normalize an answer for comparison (trim, collapse spaces, lowercase). */
function norm(s) { return (s || '').trim().replace(/\s+/g, ' ').toLowerCase(); }

/** Check a user answer against the correct form. */
function checkAnswer(user, correct) { return norm(user) === norm(correct); }
// ENGINE-END

// ---------------- state ----------------
let tables = [];
let session = null; // {deck, table, idx, ok, bad}

const $ = id => document.getElementById(id);

// ---------------- tabs ----------------
document.querySelectorAll('.tab').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    document.querySelectorAll('.panel').forEach(p => p.classList.add('hidden'));
    $('tab-' + btn.dataset.tab).classList.remove('hidden');
  });
});

// ---------------- storage ----------------
async function load() {
  const r = await chrome.storage.local.get({ conjTables: [] });
  tables = r.conjTables;
  renderTables();
}
async function save() { await chrome.storage.local.set({ conjTables: tables }); }

// ---------------- tables UI ----------------
$('addTable').addEventListener('click', async () => {
  const res = parseTable($('verbName').value, $('verbForms').value);
  if (res.error) { $('tableMsg').textContent = res.error; $('tableMsg').style.color = 'var(--bad)'; return; }
  if (tables.some(t => t.name.toLowerCase() === res.table.name.toLowerCase())) {
    $('tableMsg').textContent = 'That verb already exists.'; $('tableMsg').style.color = 'var(--bad)'; return;
  }
  tables.push(res.table);
  await save(); renderTables();
  $('verbName').value = ''; $('verbForms').value = '';
  $('tableMsg').textContent = 'Added ✓'; $('tableMsg').style.color = 'var(--ok)';
});

function renderTables() {
  $('tableCount').textContent = tables.length ? `(${tables.length})` : '';
  const list = $('tableList');
  list.innerHTML = '';
  if (!tables.length) { list.innerHTML = '<div class="empty">No tables yet — add your first verb above.</div>'; }
  tables.forEach(t => {
    const row = document.createElement('div');
    row.className = 'trow';
    const nm = document.createElement('span'); nm.className = 'vname'; nm.textContent = t.name;
    const ct = document.createElement('span'); ct.className = 'vcount'; ct.textContent = t.forms.length + ' forms';
    const del = document.createElement('button'); del.textContent = '✕'; del.title = 'Delete table';
    del.addEventListener('click', async () => { tables = tables.filter(x => x.id !== t.id); await save(); renderTables(); });
    row.append(nm, ct, del);
    list.appendChild(row);
  });
  const sel = $('drillTable');
  sel.innerHTML = '';
  tables.forEach(t => { const o = document.createElement('option'); o.value = t.id; o.textContent = `${t.name} (${t.forms.length})`; sel.appendChild(o); });
}

// ---------------- drill UI ----------------
$('startDrill').addEventListener('click', () => {
  const t = tables.find(x => x.id === $('drillTable').value);
  if (!t) return;
  session = { table: t, deck: buildDeck(t, $('drillCount').value), idx: 0, ok: 0, bad: 0 };
  $('drillSetup').classList.add('hidden');
  $('drillResult').classList.add('hidden');
  $('drillPlay').classList.remove('hidden');
  showQuestion();
});

function showQuestion() {
  const q = session.deck[session.idx];
  $('qNum').textContent = `Q${session.idx + 1}/${session.deck.length}`;
  $('scoreOk').textContent = session.ok; $('scoreBad').textContent = session.bad;
  $('drillPrompt').textContent = `${session.table.name} — form ${q.answerIdx + 1} of ${session.table.forms.length}`;
  $('drillAnswer').value = ''; $('drillFeedback').textContent = ''; $('drillFeedback').className = 'feedback';
  $('nextBtn').classList.add('hidden');
  $('drillAnswer').focus();
}

$('checkBtn').addEventListener('click', () => {
  if (!session) return;
  const q = session.deck[session.idx];
  const correct = session.table.forms[q.answerIdx];
  const user = $('drillAnswer').value;
  if (!user.trim()) return;
  if (checkAnswer(user, correct)) {
    session.ok++;
    $('drillFeedback').textContent = 'Correct ✓';
    $('drillFeedback').className = 'feedback ok';
  } else {
    session.bad++;
    $('drillFeedback').innerHTML = '';
    $('drillFeedback').append('Not quite — ', Object.assign(document.createElement('b'), { textContent: correct }));
    $('drillFeedback').className = 'feedback bad';
  }
  $('scoreOk').textContent = session.ok; $('scoreBad').textContent = session.bad;
  $('nextBtn').textContent = session.idx + 1 >= session.deck.length ? 'See results →' : 'Next →';
  $('nextBtn').classList.remove('hidden');
});

$('drillAnswer').addEventListener('keydown', e => { if (e.key === 'Enter') $('checkBtn').click(); });

$('nextBtn').addEventListener('click', () => {
  session.idx++;
  if (session.idx >= session.deck.length) {
    const pct = Math.round(session.ok / session.deck.length * 100);
    $('resultPct').textContent = pct + '%';
    $('resultText').textContent = pct >= 90 ? 'Excellent — those forms are yours.'
      : pct >= 70 ? 'Solid. A few forms need another look.'
      : 'Keep practicing — instant scoring makes it fast.';
    $('drillPlay').classList.add('hidden');
    $('drillResult').classList.remove('hidden');
  } else showQuestion();
});

$('retryBtn').addEventListener('click', () => {
  $('drillResult').classList.add('hidden');
  $('drillSetup').classList.remove('hidden');
});

load();
