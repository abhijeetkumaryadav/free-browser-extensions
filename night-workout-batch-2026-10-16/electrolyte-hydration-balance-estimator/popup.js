/* Hydration Drink Logger — popup logic. */

// ENGINE-START
// Pure helpers — no chrome.* calls, testable in node.
/** Storage key for a date: YYYY-MM-DD. */
function dayKey(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

/** Clamp an entered amount to 1..5000 ml. */
function clampAmount(v) {
  const n = Math.round(Number(v) || 0);
  return Math.min(5000, Math.max(1, n));
}

/** Sum entries by type. Returns {water, electrolyte, total}. */
function totalsOf(entries) {
  const t = { water: 0, electrolyte: 0, total: 0 };
  for (const e of entries) {
    if (e.type === 'electrolyte') t.electrolyte += e.amount;
    else t.water += e.amount;
    t.total += e.amount;
  }
  return t;
}

/** Validate a new entry shape. */
function validEntry(type, amount) {
  return (type === 'water' || type === 'electrolyte') && clampAmount(amount) > 0;
}
// ENGINE-END

const DATA_KEY = 'hydration_data';

const els = {
  waterTotal: document.getElementById('waterTotal'),
  electroTotal: document.getElementById('electroTotal'),
  typeSeg: document.getElementById('typeSeg'),
  amount: document.getElementById('amount'),
  logBtn: document.getElementById('logBtn'),
  entryList: document.getElementById('entryList'),
  count: document.getElementById('count'),
  undoBtn: document.getElementById('undoBtn'),
  clearBtn: document.getElementById('clearBtn'),
  history: document.getElementById('history'),
};

let selectedType = 'water';
let data = {};

async function load() {
  data = (await chrome.storage.local.get(DATA_KEY))[DATA_KEY] || {};
  render();
}
async function save() {
  await chrome.storage.local.set({ [DATA_KEY]: data });
}
function todayEntries() {
  return data[dayKey(new Date())] || [];
}
function setToday(entries) {
  data[dayKey(new Date())] = entries;
}

function render() {
  const entries = todayEntries();
  const t = totalsOf(entries);
  els.waterTotal.textContent = `${t.water.toLocaleString()} ml`;
  els.electroTotal.textContent = `${t.electrolyte.toLocaleString()} ml`;
  els.count.textContent = `(${entries.length})`;

  els.entryList.innerHTML = '';
  if (!entries.length) {
    els.entryList.innerHTML = '<li class="empty">Nothing logged yet today.</li>';
  } else {
    [...entries].reverse().forEach((e) => {
      const li = document.createElement('li');
      const d = new Date(e.when);
      li.innerHTML = `<span>${e.type === 'electrolyte' ? '⚡' : '💧'} ${e.amount} ml</span><span class="t">${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>`;
      els.entryList.appendChild(li);
    });
  }

  // Last 7 days (excluding today), newest first
  els.history.innerHTML = '';
  const keys = Object.keys(data).filter((k) => k !== dayKey(new Date())).sort().reverse().slice(0, 7);
  if (!keys.length) {
    els.history.innerHTML = '<div class="day"><span class="t">No earlier history yet.</span></div>';
  }
  keys.forEach((k) => {
    const tt = totalsOf(data[k]);
    const div = document.createElement('div');
    div.className = 'day';
    div.innerHTML = `<span>${k}</span><span class="t">💧 ${tt.water} · ⚡ ${tt.electrolyte}</span>`;
    els.history.appendChild(div);
  });
}

els.typeSeg.addEventListener('click', (ev) => {
  const b = ev.target.closest('button');
  if (!b) return;
  selectedType = b.dataset.type;
  els.typeSeg.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
});

document.querySelector('.quick').addEventListener('click', (ev) => {
  const b = ev.target.closest('button');
  if (b) els.amount.value = b.dataset.amt;
});

async function logEntry() {
  const amount = clampAmount(els.amount.value);
  if (!validEntry(selectedType, amount)) return;
  const entries = todayEntries();
  entries.push({ type: selectedType, amount, when: new Date().toISOString() });
  setToday(entries);
  await save();
  render();
}

els.logBtn.addEventListener('click', logEntry);
els.amount.addEventListener('keydown', (ev) => {
  if (ev.key === 'Enter') logEntry();
});

els.undoBtn.addEventListener('click', async () => {
  const entries = todayEntries();
  entries.pop();
  setToday(entries);
  await save();
  render();
});

els.clearBtn.addEventListener('click', async () => {
  if (confirm('Clear all entries for today?')) {
    setToday([]);
    await save();
    render();
  }
});

load();
