// Click Hook Retention — Self Scorecard
// Honestly narrowed: creator SELF-scorecard. The user rates their own video
// hook against bundled criteria. No video analysis, no AI — scores come
// from the user's own sliders and are saved to chrome.storage.local.

const CRITERIA = [
  { key: 'clarity',   name: 'Clarity',       desc: 'Is it obvious what this video is about in the first 3 seconds?' },
  { key: 'curiosity', name: 'Curiosity gap', desc: 'Does the hook open a question the viewer wants answered?' },
  { key: 'payoff',    name: 'Payoff promise',desc: 'Is the reward for watching (learn, laugh, surprise) clear?' },
  { key: 'pacing',    name: 'Pacing',        desc: 'Does the first 15 seconds move fast with no dead air?' },
  { key: 'visual',    name: 'Visual hook',   desc: 'Is the opening frame/scene visually striking on its own?' },
  { key: 'retention', name: 'Retention setup', desc: 'Does the hook plant a reason to keep watching past 30s?' },
];
const MAX = CRITERIA.length * 10; // 60

const $ = (id) => document.getElementById(id);
const values = {}; // key -> slider value

function grade(total) {
  if (total >= 50) return 'Strong hook — ship it';
  if (total >= 40) return 'Decent — tighten the weakest criterion';
  if (total >= 28) return 'Risky — rework before publishing';
  return 'Weak hook — likely to lose viewers early';
}

function renderCriteria() {
  const wrap = $('criteria');
  wrap.innerHTML = '';
  CRITERIA.forEach((c) => {
    const v = values[c.key] ?? 5;
    const div = document.createElement('div');
    div.className = 'crit';
    div.innerHTML =
      '<div class="crit-head"><span class="crit-name">' + escapeHtml(c.name) + '</span>' +
      '<span class="crit-val" id="val-' + c.key + '">' + v + '/10</span></div>' +
      '<p class="crit-desc">' + escapeHtml(c.desc) + '</p>' +
      '<input type="range" min="1" max="10" value="' + v + '" id="rng-' + c.key + '" aria-label="' + escapeHtml(c.name) + '">';
    wrap.appendChild(div);
    div.querySelector('input').addEventListener('input', (e) => {
      values[c.key] = Number(e.target.value);
      $('val-' + c.key).textContent = values[c.key] + '/10';
      updateTotal();
    });
  });
}

function updateTotal() {
  let sum = 0, all = true;
  CRITERIA.forEach((c) => {
    if (values[c.key] === undefined) { all = false; return; }
    sum += values[c.key];
  });
  $('score').textContent = sum;
  $('grade').textContent = all ? grade(sum) : 'Rate all six criteria';
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
}

async function getSaved() {
  const { cards = [] } = await chrome.storage.local.get('cards');
  return cards;
}

async function renderHistory() {
  const cards = await getSaved();
  const list = $('list');
  if (!cards.length) { list.innerHTML = '<p class="empty">No scorecards yet.</p>'; return; }
  list.innerHTML = '';
  cards.slice().reverse().forEach((card, revIdx) => {
    const idx = cards.length - 1 - revIdx;
    const item = document.createElement('div');
    item.className = 'item';
    item.innerHTML =
      '<div><div class="item-title">' + escapeHtml(card.title || 'Untitled') + '</div>' +
      '<div class="item-meta">' + escapeHtml(card.date) + (card.notes ? ' · ' + escapeHtml(card.notes.slice(0, 40)) : '') + '</div></div>' +
      '<div style="display:flex;align-items:center;gap:8px">' +
      '<span class="item-score">' + card.score + '</span>' +
      '<button class="del" data-idx="' + idx + '" aria-label="Delete">×</button></div>';
    list.appendChild(item);
  });
  list.querySelectorAll('.del').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const cards = await getSaved();
      cards.splice(Number(btn.dataset.idx), 1);
      await chrome.storage.local.set({ cards });
      renderHistory();
    });
  });
}

async function save() {
  const title = $('title').value.trim() || 'Untitled';
  let sum = 0;
  const breakdown = {};
  for (const c of CRITERIA) { const v = values[c.key] ?? 5; breakdown[c.key] = v; sum += v; }
  const card = {
    title,
    notes: $('notes').value.trim(),
    breakdown,
    score: sum,
    max: MAX,
    date: new Date().toLocaleString(),
  };
  const cards = await getSaved();
  cards.push(card);
  await chrome.storage.local.set({ cards });
  $('title').value = '';
  $('notes').value = '';
  renderHistory();
}

$('save').addEventListener('click', save);
$('clear').addEventListener('click', async () => {
  await chrome.storage.local.set({ cards: [] });
  renderHistory();
});

renderCriteria();
updateTotal();
renderHistory();
