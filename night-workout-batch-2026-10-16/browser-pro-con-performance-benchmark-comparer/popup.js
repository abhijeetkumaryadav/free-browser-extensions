/* Browser Benchmark — local micro-benchmark runner (THIS browser only).
 * All benchmarks are DOM-free JS; runs are timed in the popup page itself.
 * Results + run history live in chrome.storage.local. Zero network. */

'use strict';

/* ---------------------------------------------------------------- helpers */
const $ = (id) => document.getElementById(id);

function median(arr) {
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function timeIt(fn) {
  const t0 = performance.now();
  fn();
  return performance.now() - t0;
}

/* ------------------------------------------------------------- benchmarks */
/* Each benchmark: { id, name, desc, run } — run executes a fixed workload
 * once; score = operations per second (higher = faster). */

function makeRand(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

const BENCHMARKS = [
  {
    id: 'array-sort',
    name: 'Array sort',
    desc: 'Sort 50k random numbers',
    run() {
      const rand = makeRand(42);
      const a = Array.from({ length: 50000 }, () => rand());
      a.sort((x, y) => x - y);
    },
  },
  {
    id: 'array-map-reduce',
    name: 'Array map + filter',
    desc: 'Map & filter over 100k items',
    run() {
      const a = Array.from({ length: 100000 }, (_, i) => i);
      const out = a.map((x) => x * 2).filter((x) => x % 3 === 0);
      if (out.length < 0) throw new Error('unreachable');
    },
  },
  {
    id: 'string-build',
    name: 'String build',
    desc: 'Concatenate 20k strings',
    run() {
      let s = '';
      for (let i = 0; i < 20000; i++) s += 'item-' + i + ' ';
      if (s.length < 0) throw new Error('unreachable');
    },
  },
  {
    id: 'regex-scan',
    name: 'Regex scan',
    desc: 'Match patterns in a large text',
    run() {
      const words = 'alpha beta gamma delta epsilon zeta eta theta iota kappa lambda mu ';
      const text = words.repeat(4000);
      const emails = text.match(/[a-z]{5,}/g);
      const nums = text.replace(/[aeiou]/g, '*');
      if (emails.length < 0 || nums.length < 0) throw new Error('unreachable');
    },
  },
  {
    id: 'math-crunch',
    name: 'Math crunch',
    desc: '1M trig + sqrt iterations',
    run() {
      let acc = 0;
      for (let i = 1; i <= 1000000; i++) acc += Math.sqrt(i) * Math.sin(i * 0.001);
      if (acc === Infinity) throw new Error('unreachable');
    },
  },
  {
    id: 'object-churn',
    name: 'Object churn',
    desc: 'Create 50k objects, read props',
    run() {
      let sum = 0;
      for (let i = 0; i < 50000; i++) {
        const o = { a: i, b: i * 2, c: 'k' + i };
        sum += o.a + o.b + o.c.length;
      }
      if (sum < 0) throw new Error('unreachable');
    },
  },
];

const REPS = 5; // timed repetitions per benchmark; median is scored

async function runBenchmarks(selected) {
  const scores = {};
  for (const b of BENCHMARKS) {
    if (!selected.includes(b.id)) continue;
    setStatus(`Running ${b.name}…`, true);
    b.run(); // warmup
    const times = [];
    for (let r = 0; r < REPS; r++) {
      times.push(timeIt(() => b.run()));
      await new Promise((res) => setTimeout(res, 0)); // let UI breathe
    }
    const med = median(times);
    scores[b.id] = { ms: +med.toFixed(2), ops: Math.round(1000 / med * 100) / 100 };
  }
  return scores;
}

/* ---------------------------------------------------------------- storage */
const HISTORY_KEY = 'benchmark_history_v1';

async function loadHistory() {
  const { [HISTORY_KEY]: h } = await chrome.storage.local.get(HISTORY_KEY);
  return Array.isArray(h) ? h : [];
}

async function saveHistory(history) {
  await chrome.storage.local.set({ [HISTORY_KEY]: history.slice(-30) });
}

/* ------------------------------------------------------------------ render */
function renderBenchList(selected) {
  const list = $('bench-list');
  list.innerHTML = '';
  for (const b of BENCHMARKS) {
    const label = document.createElement('label');
    label.className = 'bench';
    const box = document.createElement('input');
    box.type = 'checkbox';
    box.checked = selected.includes(b.id);
    box.dataset.id = b.id;
    const txt = document.createElement('span');
    txt.innerHTML = `<b>${escapeHtml(b.name)}</b><small>${escapeHtml(b.desc)}</small>`;
    label.append(box, txt);
    list.appendChild(label);
  }
}

function selectedIds() {
  return [...document.querySelectorAll('#bench-list input:checked')].map((i) => i.dataset.id);
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function renderResults(scores) {
  const box = $('results');
  box.innerHTML = '';
  const entries = Object.entries(scores);
  if (!entries.length) {
    box.innerHTML = '<p class="empty">No run yet — press <strong>Run selected</strong>.</p>';
    return;
  }
  const max = Math.max(...entries.map(([, s]) => s.ops));
  for (const [id, s] of entries) {
    const b = BENCHMARKS.find((x) => x.id === id);
    const div = document.createElement('div');
    div.className = 'result';
    div.innerHTML =
      `<div class="top"><b>${escapeHtml(b ? b.name : id)}</b>` +
      `<span class="score">${s.ops.toFixed(1)} ops/s · ${s.ms} ms</span></div>` +
      `<div class="bar"><i style="width:${Math.max(2, (s.ops / max) * 100)}%"></i></div>`;
    box.appendChild(div);
  }
}

function fmtTime(ts) {
  return new Date(ts).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function renderHistory(history) {
  const box = $('history');
  box.innerHTML = '';
  if (!history.length) {
    box.innerHTML = '<p class="empty">No runs saved yet.</p>';
    return;
  }
  [...history].reverse().forEach((run, i) => {
    const prev = history.length > 1 ? history[history.length - 2 - i] : null;
    const total = Object.values(run.scores).reduce((a, s) => a + s.ops, 0);
    const prevTotal = prev ? Object.values(prev.scores).reduce((a, s) => a + s.ops, 0) : null;
    let delta = '<span class="delta flat">first run</span>';
    if (prevTotal) {
      const pct = ((total - prevTotal) / prevTotal) * 100;
      const cls = pct > 0.5 ? 'up' : pct < -0.5 ? 'down' : 'flat';
      delta = `<span class="delta ${cls}">${pct >= 0 ? '+' : ''}${pct.toFixed(1)}% vs prev</span>`;
    }
    const div = document.createElement('div');
    div.className = 'run';
    const items = Object.entries(run.scores)
      .map(([id, s]) => {
        const b = BENCHMARKS.find((x) => x.id === id);
        return `<li>${escapeHtml(b ? b.name : id)}: <b>${s.ops.toFixed(1)}</b></li>`;
      })
      .join('');
    div.innerHTML =
      `<div class="top"><span>${fmtTime(run.ts)} · total <b style="color:var(--text)">${total.toFixed(1)}</b></span>${delta}</div>` +
      `<ul>${items}</ul>`;
    box.appendChild(div);
  });
}

function setStatus(msg, live = false) {
  const el = $('status');
  el.textContent = msg;
  el.classList.toggle('live', live);
}

/* -------------------------------------------------------------------- boot */
document.addEventListener('DOMContentLoaded', async () => {
  const history = await loadHistory();
  renderBenchList(BENCHMARKS.map((b) => b.id));
  renderHistory(history);
  const last = history[history.length - 1];
  if (last) renderResults(last.scores);

  $('toggle-all').addEventListener('click', () => {
    const boxes = [...document.querySelectorAll('#bench-list input')];
    const allOn = boxes.every((b) => b.checked);
    boxes.forEach((b) => (b.checked = !allOn));
  });

  $('run').addEventListener('click', async () => {
    const ids = selectedIds();
    if (!ids.length) {
      setStatus('Select at least one benchmark.');
      return;
    }
    const btn = $('run');
    btn.disabled = true;
    try {
      const scores = await runBenchmarks(ids);
      renderResults(scores);
      const h = await loadHistory();
      h.push({ ts: Date.now(), scores });
      await saveHistory(h);
      renderHistory(h);
      setStatus(`Done — ${ids.length} benchmark${ids.length > 1 ? 's' : ''} saved to history.`, true);
    } catch (e) {
      setStatus('Run failed: ' + e.message);
    } finally {
      btn.disabled = false;
    }
  });

  $('clear').addEventListener('click', async () => {
    await chrome.storage.local.remove(HISTORY_KEY);
    renderHistory([]);
    renderResults({});
    setStatus('History cleared.');
  });
});
