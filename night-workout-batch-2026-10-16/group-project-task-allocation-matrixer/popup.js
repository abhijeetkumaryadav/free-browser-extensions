/* Group Project Task Allocation Matrix — popup logic.
   100% manual task board. All data in chrome.storage.local, no network. */

'use strict';

const $ = (id) => document.getElementById(id);
const UNASSIGNED = 'Unassigned';
const DEFAULT_THRESHOLD = 20;

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

const store = {
  async get() {
    const d = await chrome.storage.local.get(['members', 'tasks', 'threshold']);
    return {
      members: d.members || [],
      tasks: d.tasks || [],
      threshold: typeof d.threshold === 'number' ? d.threshold : DEFAULT_THRESHOLD,
    };
  },
  async set(state) {
    await chrome.storage.local.set({
      members: state.members,
      tasks: state.tasks,
      threshold: state.threshold,
    });
  },
};

let members = []; // [{id, name}]
let tasks = [];   // [{id, name, assigneeId (member id or ''), est, depId, done}]
let threshold = DEFAULT_THRESHOLD;

// ---- Pure logic (kept isolated so it can be smoke-tested) -------------------
// Workload per member id ('' = unassigned bucket).
function computeWorkload(tasksList) {
  const w = {};
  tasksList.forEach((t) => {
    const key = t.assigneeId || '';
    w[key] = (w[key] || 0) + (Number(t.est) || 0);
  });
  return w;
}
// Flags: unassigned tasks + members over the threshold.
function computeFlags(tasksList, membersList, thr) {
  const flags = [];
  const unassigned = tasksList.filter((t) => !t.assigneeId && !t.done);
  unassigned.forEach((t) => flags.push({ kind: 'warn', text: 'Unassigned: "' + t.name + '"' }));
  const wl = computeWorkload(tasksList);
  membersList.forEach((m) => {
    const hours = wl[m.id] || 0;
    if (hours > thr) {
      flags.push({ kind: 'danger', text: m.name + ' is overloaded: ' + hours + 'h vs ' + thr + 'h threshold' });
    }
  });
  return flags;
}

// ---- Tabs -------------------------------------------------------------------
document.querySelectorAll('.tab').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach((b) => b.classList.remove('active'));
    document.querySelectorAll('.panel').forEach((p) => p.classList.remove('active'));
    btn.classList.add('active');
    $('panel-' + btn.dataset.tab).classList.add('active');
  });
});

const memberName = (id) => (members.find((m) => m.id === id) || {}).name || UNASSIGNED;
const taskName = (id) => (tasks.find((t) => t.id === id) || {}).name || '';

// ---- Matrix + workload rendering --------------------------------------------
function renderMatrix() {
  const flags = computeFlags(tasks, members, threshold);
  const alerts = $('alerts');
  alerts.innerHTML = '';
  if (flags.length === 0) {
    const ok = document.createElement('div');
    ok.className = 'alert ok';
    ok.textContent = 'All good — every active task is assigned and nobody is over the threshold.';
    alerts.appendChild(ok);
  } else {
    flags.forEach((f) => {
      const el = document.createElement('div');
      el.className = 'alert ' + f.kind;
      el.textContent = f.text;
      alerts.appendChild(el);
    });
  }

  // Allocation matrix: rows = members + Unassigned, columns = active tasks.
  const table = $('matrix-table');
  table.innerHTML = '';
  const active = tasks.filter((t) => !t.done);
  const rows = [...members.map((m) => ({ id: m.id, label: m.name })), { id: '', label: UNASSIGNED }];
  const thead = document.createElement('thead');
  const hr = document.createElement('tr');
  const corner = document.createElement('th');
  corner.textContent = 'who × task';
  hr.appendChild(corner);
  active.forEach((t) => {
    const th = document.createElement('th');
    th.textContent = t.name.length > 14 ? t.name.slice(0, 13) + '…' : t.name;
    th.title = t.name;
    hr.appendChild(th);
  });
  thead.appendChild(hr);
  table.appendChild(thead);
  const tbody = document.createElement('tbody');
  rows.forEach((r) => {
    const tr = document.createElement('tr');
    const td0 = document.createElement('td');
    td0.textContent = r.label;
    tr.appendChild(td0);
    active.forEach((t) => {
      const td = document.createElement('td');
      if ((t.assigneeId || '') === r.id) {
        td.textContent = '●';
        td.className = 'hit';
        td.title = t.name + ' → ' + r.label + ' (' + t.est + 'h)';
      } else {
        td.textContent = '·';
        td.className = 'miss';
      }
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);

  // Workload bars.
  const wl = computeWorkload(active);
  const wrap = $('workload');
  wrap.innerHTML = '';
  const max = Math.max(threshold, ...rows.map((r) => wl[r.id] || 0), 1);
  rows.forEach((r) => {
    const hours = wl[r.id] || 0;
    if (hours === 0 && r.id === '') return; // skip empty unassigned row
    const row = document.createElement('div');
    row.className = 'wrow' + (r.id && hours > threshold ? ' over' : '');
    const top = document.createElement('div');
    top.className = 'wtop';
    const nm = document.createElement('span');
    nm.textContent = r.label;
    const hrs = document.createElement('span');
    hrs.className = 'hrs';
    hrs.textContent = hours + 'h';
    top.append(nm, hrs);
    const bar = document.createElement('div');
    bar.className = 'wbar';
    const fill = document.createElement('div');
    fill.className = 'fill';
    fill.style.width = Math.min(100, (hours / max) * 100) + '%';
    bar.appendChild(fill);
    row.append(top, bar);
    wrap.appendChild(row);
  });
}

// ---- Task form ---------------------------------------------------------------
function refreshTaskForm() {
  const asg = $('task-assignee');
  asg.innerHTML = '';
  const none = document.createElement('option');
  none.value = '';
  none.textContent = UNASSIGNED;
  asg.appendChild(none);
  members.forEach((m) => {
    const o = document.createElement('option');
    o.value = m.id;
    o.textContent = m.name;
    asg.appendChild(o);
  });
  const dep = $('task-dep');
  dep.innerHTML = '';
  const dn = document.createElement('option');
  dn.value = '';
  dn.textContent = 'None';
  dep.appendChild(dn);
  tasks.forEach((t) => {
    const o = document.createElement('option');
    o.value = t.id;
    o.textContent = t.name;
    dep.appendChild(o);
  });
}

function renderTasks() {
  const list = $('task-list');
  list.innerHTML = '';
  $('tasks-empty').classList.toggle('hidden', tasks.length > 0);
  tasks.forEach((t) => {
    const li = document.createElement('li');
    const name = document.createElement('div');
    name.className = 'tname' + (t.done ? ' done' : '');
    name.textContent = t.name;
    const meta = document.createElement('div');
    meta.className = 'tmeta';
    const bits = [memberName(t.assigneeId), (t.est || 0) + 'h'];
    if (t.depId && taskName(t.depId)) bits.push('after: ' + taskName(t.depId));
    meta.textContent = bits.join(' · ');
    const actions = document.createElement('div');
    actions.className = 'tactions';
    const toggle = document.createElement('button');
    toggle.textContent = t.done ? 'Reopen' : 'Done';
    toggle.className = 'small';
    toggle.addEventListener('click', async () => {
      t.done = !t.done;
      await save();
    });
    const del = document.createElement('button');
    del.textContent = 'Delete';
    del.className = 'small danger';
    del.addEventListener('click', async () => {
      tasks = tasks.filter((x) => x.id !== t.id);
      // Clear dependencies that pointed at the deleted task.
      tasks.forEach((x) => { if (x.depId === t.id) x.depId = ''; });
      await save();
    });
    actions.append(toggle, del);
    li.append(name, meta, actions);
    list.appendChild(li);
  });
}

$('add-task').addEventListener('click', async () => {
  const name = $('task-name').value.trim();
  if (!name) { $('task-name').focus(); return; }
  tasks.push({
    id: uid(),
    name,
    assigneeId: $('task-assignee').value,
    est: Math.max(0, Number($('task-est').value) || 0),
    depId: $('task-dep').value,
    done: false,
  });
  $('task-name').value = '';
  await save();
});

// ---- Members ------------------------------------------------------------------
function renderMembers() {
  const list = $('member-list');
  list.innerHTML = '';
  $('members-empty').classList.toggle('hidden', members.length > 0);
  members.forEach((m) => {
    const li = document.createElement('li');
    const nm = document.createElement('span');
    nm.className = 'mname';
    nm.textContent = m.name;
    const del = document.createElement('button');
    del.textContent = 'Remove';
    del.className = 'danger';
    del.addEventListener('click', async () => {
      members = members.filter((x) => x.id !== m.id);
      tasks.forEach((t) => { if (t.assigneeId === m.id) t.assigneeId = ''; });
      await save();
    });
    li.append(nm, del);
    list.appendChild(li);
  });
}

$('add-member').addEventListener('click', async () => {
  const name = $('member-name').value.trim();
  if (!name) { $('member-name').focus(); return; }
  if (members.some((m) => m.name.toLowerCase() === name.toLowerCase())) return;
  members.push({ id: uid(), name });
  $('member-name').value = '';
  await save();
});
$('member-name').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') $('add-member').click();
});

// ---- Threshold -----------------------------------------------------------------
$('threshold').addEventListener('change', async () => {
  threshold = Math.max(1, Number($('threshold').value) || DEFAULT_THRESHOLD);
  $('threshold').value = threshold;
  await save();
});

// ---- Persistence + full render --------------------------------------------------
async function save() {
  await store.set({ members, tasks, threshold });
  renderAll();
}

function renderAll() {
  renderMatrix();
  refreshTaskForm();
  renderTasks();
  renderMembers();
  $('threshold').value = threshold;
}

// ---- Init ----------------------------------------------------------------------
(async function init() {
  const s = await store.get();
  members = s.members;
  tasks = s.tasks;
  threshold = s.threshold;
  renderAll();
})();

// Export pure logic for the Node smoke test (ignored in the popup).
if (typeof module !== 'undefined') {
  module.exports = { computeWorkload, computeFlags };
}
