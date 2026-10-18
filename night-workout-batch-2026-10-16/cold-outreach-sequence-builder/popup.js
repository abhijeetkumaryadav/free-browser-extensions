/* Cold Outreach Sequence Builder — popup logic.
   Sequences of outreach steps with {{variable}} templating, per-step day
   offsets (follow-up spacing), filled previews, and copy-to-clipboard.
   It NEVER sends anything. All data local in chrome.storage.local. */

const VARS = ['name', 'company', 'email', 'role', 'title'];

const store = {
  async get() {
    const r = await chrome.storage.local.get(['sequences', 'activeSeq']);
    return { sequences: r.sequences || [], activeSeq: r.activeSeq || null };
  },
  async set(d) { await chrome.storage.local.set(d); }
};
const uid = () => Math.random().toString(36).slice(2, 10);
const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

/* Replace {{var}} placeholders with values from a map. Unknown vars stay as-is. */
function render(template, values) {
  return String(template ?? '').replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g,
    (m, key) => (key in values && values[key] !== '') ? values[key] : m);
}

/* ---------- tabs ---------- */
document.querySelectorAll('.tab').forEach(t =>
  t.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(x => x.classList.remove('active'));
    document.querySelectorAll('.panel').forEach(x => x.classList.remove('active'));
    t.classList.add('active');
    document.getElementById('tab-' + t.dataset.tab).classList.add('active');
  }));

/* ---------- sequences ---------- */
document.getElementById('add-seq').addEventListener('click', async () => {
  const name = document.getElementById('seq-name').value.trim();
  if (!name) return;
  const { sequences } = await store.get();
  const id = uid();
  sequences.push({ id, name, steps: [] });
  await store.set({ sequences, activeSeq: id });
  document.getElementById('seq-name').value = '';
  await refresh();
});

function activeSequence(sequences, activeSeq) {
  return sequences.find(s => s.id === activeSeq) || sequences[0] || null;
}

async function deleteSequence(id) {
  const { sequences, activeSeq } = await store.get();
  const rest = sequences.filter(s => s.id !== id);
  await store.set({ sequences: rest, activeSeq: activeSeq === id ? (rest[0]?.id || null) : activeSeq });
  await refresh();
}

async function useSequence(id) {
  await store.set({ activeSeq: id });
  await refresh();
  document.querySelector('[data-tab="steps"]').click();
}

/* ---------- steps ---------- */
let editingId = null;

document.getElementById('add-step-open').addEventListener('click', () => {
  editingId = null;
  document.getElementById('ed-title').textContent = 'New step';
  ['ed-name', 'ed-subject', 'ed-body'].forEach(i => document.getElementById(i).value = '');
  document.getElementById('ed-day').value = 0;
  document.getElementById('step-editor').classList.remove('hidden');
});
document.getElementById('ed-cancel').addEventListener('click', () =>
  document.getElementById('step-editor').classList.add('hidden'));

document.getElementById('ed-save').addEventListener('click', async () => {
  const name = document.getElementById('ed-name').value.trim();
  const body = document.getElementById('ed-body').value;
  if (!name || !body.trim()) return;
  const day = Math.max(0, parseInt(document.getElementById('ed-day').value, 10) || 0);
  const subject = document.getElementById('ed-subject').value;

  const { sequences, activeSeq } = await store.get();
  const seq = activeSequence(sequences, activeSeq);
  if (!seq) return;

  if (editingId) {
    const st = seq.steps.find(x => x.id === editingId);
    if (st) Object.assign(st, { name, day, subject, body });
  } else {
    seq.steps.push({ id: uid(), name, day, subject, body });
  }
  await store.set({ sequences });
  document.getElementById('step-editor').classList.add('hidden');
  editingId = null;
  await refresh();
});

async function moveStep(id, dir) {
  const { sequences, activeSeq } = await store.get();
  const seq = activeSequence(sequences, activeSeq);
  if (!seq) return;
  const i = seq.steps.findIndex(s => s.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= seq.steps.length) return;
  [seq.steps[i], seq.steps[j]] = [seq.steps[j], seq.steps[i]];
  await store.set({ sequences });
  await refresh();
}

async function deleteStep(id) {
  const { sequences, activeSeq } = await store.get();
  const seq = activeSequence(sequences, activeSeq);
  if (!seq) return;
  seq.steps = seq.steps.filter(s => s.id !== id);
  await store.set({ sequences });
  await refresh();
}

function editStep(id) {
  editingId = id;
  const seq = window._seq;
  const st = seq && seq.steps.find(x => x.id === id);
  if (!st) return;
  document.getElementById('ed-title').textContent = 'Edit step';
  document.getElementById('ed-name').value = st.name;
  document.getElementById('ed-day').value = st.day;
  document.getElementById('ed-subject').value = st.subject || '';
  document.getElementById('ed-body').value = st.body;
  document.getElementById('step-editor').classList.remove('hidden');
}

/* ---------- preview ---------- */
function varValues() {
  const v = {};
  for (const k of VARS) v[k] = document.getElementById('v-' + k).value.trim();
  return v;
}

document.getElementById('render').addEventListener('click', async () => {
  const { sequences, activeSeq } = await store.get();
  const seq = activeSequence(sequences, activeSeq);
  const box = document.getElementById('preview-list');
  box.innerHTML = '';
  if (!seq || !seq.steps.length) {
    box.innerHTML = '<div class="empty">No steps yet. Add steps in the Steps tab.</div>';
    return;
  }
  const v = varValues();
  const ordered = [...seq.steps].sort((a, b) => a.day - b.day);
  ordered.forEach((st, i) => {
    const div = document.createElement('div');
    div.className = 'pv';
    div.innerHTML = `<h3>Step ${i + 1}: ${esc(st.name)} <span class="day">Day ${st.day}</span></h3>
      ${st.subject ? `<div class="subj">Subject: ${esc(render(st.subject, v))}</div>` : ''}
      <pre>${esc(render(st.body, v))}</pre>
      <div class="step-btns"><button class="mini">Copy step</button></div>`;
    div.querySelector('.mini').addEventListener('click', async (e) => {
      const text = (st.subject ? 'Subject: ' + render(st.subject, v) + '\n\n' : '') + render(st.body, v);
      await navigator.clipboard.writeText(text);
      e.target.textContent = 'Copied ✓';
      setTimeout(() => e.target.textContent = 'Copy step', 1200);
    });
    box.appendChild(div);
  });
});

document.getElementById('copy-all').addEventListener('click', async (e) => {
  const { sequences, activeSeq } = await store.get();
  const seq = activeSequence(sequences, activeSeq);
  if (!seq || !seq.steps.length) return;
  const v = varValues();
  const text = [...seq.steps].sort((a, b) => a.day - b.day).map((st, i) =>
    `--- Step ${i + 1}: ${st.name} (Day ${st.day}) ---\n` +
    (st.subject ? `Subject: ${render(st.subject, v)}\n\n` : '') +
    render(st.body, v)
  ).join('\n\n');
  await navigator.clipboard.writeText(text);
  e.target.textContent = 'Copied ✓';
  setTimeout(() => e.target.textContent = 'Copy all steps', 1200);
});

['v-name', 'v-company', 'v-email', 'v-role', 'v-title'].forEach(id =>
  document.getElementById(id).addEventListener('input', () => {
    // re-render live if a preview already exists
    if (document.getElementById('preview-list').children.length)
      document.getElementById('render').click();
  }));

document.getElementById('seq-select').addEventListener('change', async (e) => {
  await store.set({ activeSeq: e.target.value });
  await refresh();
});

/* ---------- render ---------- */
async function refresh() {
  const { sequences, activeSeq } = await store.get();
  const seq = activeSequence(sequences, activeSeq);
  window._seq = seq;

  // selector + sequence list
  document.getElementById('seq-select').innerHTML =
    sequences.map(s => `<option value="${s.id}"${seq && s.id === seq.id ? ' selected' : ''}>${esc(s.name)}</option>`).join('')
    || '<option value="">— create a sequence first —</option>';
  const sl = document.getElementById('seq-list');
  sl.innerHTML = sequences.length ? '' : '<li class="empty">No sequences yet.</li>';
  for (const s of sequences) {
    const li = document.createElement('li');
    if (seq && s.id === seq.id) li.classList.add('sel');
    li.innerHTML = `<span>${esc(s.name)} <span class="cnt">(${s.steps.length} step${s.steps.length === 1 ? '' : 's'})</span></span>
      <span><button class="use">Use</button><button class="del">✕</button></span>`;
    li.querySelector('.use').addEventListener('click', () => useSequence(s.id));
    li.querySelector('.del').addEventListener('click', () => deleteSequence(s.id));
    sl.appendChild(li);
  }

  // steps timeline
  const tl = document.getElementById('step-list');
  tl.innerHTML = '';
  if (!seq) {
    tl.innerHTML = '<div class="empty">Create a sequence first.</div>';
    return;
  }
  if (!seq.steps.length) {
    tl.innerHTML = '<div class="empty">No steps yet. Click “+ Step” to add your first touch.</div>';
    return;
  }
  [...seq.steps].sort((a, b) => a.day - b.day).forEach(st => {
    const d = document.createElement('div');
    d.className = 'step';
    d.innerHTML = `<div class="card">
      <h3>${esc(st.name)} <span class="day">Day ${st.day}</span></h3>
      ${st.subject ? `<div class="subj">Subject: ${esc(st.subject)}</div>` : ''}
      <div class="bod">${esc(st.body)}</div>
      <div class="step-btns">
        <button class="mini" data-a="up">↑</button><button class="mini" data-a="down">↓</button>
        <button class="mini" data-a="edit">Edit</button><button class="mini" data-a="del">Delete</button>
      </div></div>`;
    d.querySelector('[data-a="up"]').addEventListener('click', () => moveStep(st.id, -1));
    d.querySelector('[data-a="down"]').addEventListener('click', () => moveStep(st.id, 1));
    d.querySelector('[data-a="edit"]').addEventListener('click', () => editStep(st.id));
    d.querySelector('[data-a="del"]').addEventListener('click', () => deleteStep(st.id));
    tl.appendChild(d);
  });
}

refresh();
