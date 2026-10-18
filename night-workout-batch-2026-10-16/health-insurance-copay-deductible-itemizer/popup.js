// Cost Tracker — personal healthcare payment log. Everything in chrome.storage.local.
const $ = (id) => document.getElementById(id);
const money = (n) => '$' + Number(n).toFixed(2);
const TYPES = ['copay', 'deductible', 'premium', 'other'];

const state = { payments: [], target: 0 };

async function load() {
  const data = await chrome.storage.local.get({ payments: [], deductibleTarget: 0 });
  state.payments = data.payments;
  state.target = Number(data.deductibleTarget) || 0;
  $('target').value = state.target || '';
  render();
}

async function save() {
  await chrome.storage.local.set({ payments: state.payments, deductibleTarget: state.target });
}

function render() {
  // Totals by type
  const totals = { copay: 0, deductible: 0, premium: 0, other: 0 };
  for (const p of state.payments) totals[p.type] = (totals[p.type] || 0) + p.amount;
  $('totCopay').textContent = money(totals.copay);
  $('totDeductible').textContent = money(totals.deductible);
  $('totPremium').textContent = money(totals.premium);
  $('totOther').textContent = money(totals.other);

  // Deductible progress
  const pct = state.target > 0 ? Math.min(100, (totals.deductible / state.target) * 100) : 0;
  $('progressFill').style.width = pct + '%';
  $('progressText').textContent = state.target > 0
    ? `${money(totals.deductible)} of ${money(state.target)} (${pct.toFixed(0)}%)`
    : 'Set a target to track progress';

  // History (newest first)
  const list = $('history');
  list.innerHTML = '';
  const sorted = [...state.payments].sort((a, b) => b.date.localeCompare(a.date));
  if (!sorted.length) {
    list.innerHTML = '<li class="empty">No payments logged yet.</li>';
  } else {
    for (const p of sorted) {
      const li = document.createElement('li');
      li.innerHTML = `<span class="meta">${escapeHtml(p.date)} · ${escapeHtml(p.provider || '—')} · ${p.type}</span>
        <span><span class="amt">${money(p.amount)}</span><button class="del" title="Delete">×</button></span>`;
      li.querySelector('.del').addEventListener('click', async () => {
        state.payments = state.payments.filter((x) => x.id !== p.id);
        await save();
        render();
      });
      list.appendChild(li);
    }
  }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

$('addBtn').addEventListener('click', async () => {
  const amount = parseFloat($('payAmount').value);
  if (isNaN(amount) || amount < 0) { $('payAmount').focus(); return; }
  state.payments.push({
    id: Date.now() + '-' + Math.random().toString(36).slice(2),
    date: $('payDate').value || new Date().toISOString().slice(0, 10),
    provider: $('payProvider').value.trim(),
    type: $('payType').value,
    amount: Math.round(amount * 100) / 100,
  });
  $('payAmount').value = '';
  $('payProvider').value = '';
  await save();
  render();
});

$('target').addEventListener('change', async () => {
  state.target = Math.max(0, Number($('target').value) || 0);
  await save();
  render();
});

$('clearBtn').addEventListener('click', async () => {
  if (!state.payments.length) return;
  if (confirm('Delete all logged payments?')) {
    state.payments = [];
    await save();
    render();
  }
});

$('payDate').value = new Date().toISOString().slice(0, 10);
load();
