'use strict';
/* ============================================================
   Ergo ROI Calculator — engine + UI
   Workdays per year ≈ 250. All inputs are the user's own values.
   ============================================================ */

// ENGINE-START
const WORKDAYS = 250;

/** Pure ROI computation. cost: $, years: expected lifespan, dailyValue: $/workday */
function computeROI(cost, years, dailyValue) {
  cost = Math.max(0, Number(cost) || 0);
  years = Math.max(0, Number(years) || 0);
  dailyValue = Math.max(0, Number(dailyValue) || 0);
  const yearly = dailyValue * WORKDAYS;
  const lifetime = yearly * years;
  const net = lifetime - cost;
  const paybackYears = yearly > 0 ? cost / yearly : Infinity;
  return { cost, years, dailyValue, yearly, lifetime, net, paybackYears };
}

/** "2.3 years" / "4 months" / "≈ 9 days" / "never" formatting */
function fmtPayback(paybackYears) {
  if (!isFinite(paybackYears)) return 'never';
  if (paybackYears <= 0) return 'immediate';
  const months = paybackYears * 12;
  if (months < 1) return `≈ ${Math.round(paybackYears * 365)} days`;
  if (months < 24) return `≈ ${months < 1.5 ? months.toFixed(1) : Math.round(months)} month${Math.round(months) === 1 ? '' : 's'}`;
  return `≈ ${paybackYears < 10 ? paybackYears.toFixed(1) : Math.round(paybackYears)} years`;
}

function money(n) {
  return '$' + n.toLocaleString('en-US', { maximumFractionDigits: 0 });
}
// ENGINE-END

/* ---------------- UI ---------------- */
const $ = (id) => document.getElementById(id);

function renderSaved(items) {
  const list = $('list');
  list.innerHTML = '';
  $('empty').style.display = items.length ? 'none' : 'block';
  for (const it of items) {
    const li = document.createElement('li');
    const name = document.createElement('span');
    name.className = 'nm';
    name.textContent = it.name;
    const det = document.createElement('span');
    det.className = 'dt';
    det.textContent = `${money(it.net)} net · ${fmtPayback(it.paybackYears)}`;
    const del = document.createElement('button');
    del.textContent = '×';
    del.title = 'Delete';
    del.addEventListener('click', () => {
      chrome.storage.local.get({ roiItems: [] }, (d) => {
        chrome.storage.local.set(
          { roiItems: d.roiItems.filter((x) => x.id !== it.id) },
          () => renderSaved(d.roiItems.filter((x) => x.id !== it.id))
        );
      });
    });
    li.append(name, det, del);
    list.appendChild(li);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  chrome.storage.local.get({ roiItems: [] }, (d) => renderSaved(d.roiItems));

  $('calc').addEventListener('click', () => {
    const name = $('itemName').value.trim() || 'Unnamed item';
    const r = computeROI($('cost').value, $('years').value, $('dailyValue').value);

    $('results').hidden = false;
    $('yearly').textContent = money(r.yearly);
    $('lifetime').textContent = money(r.lifetime);
    $('payback').textContent = fmtPayback(r.paybackYears);
    $('net').textContent = (r.net < 0 ? '−' : '') + money(Math.abs(r.net));
    $('net').style.color = r.net < 0 ? 'var(--danger)' : 'var(--accent)';

    // bar: lifetime value vs cost (clamped)
    const pct = r.lifetime + r.cost > 0 ? (r.lifetime / (r.lifetime + r.cost)) * 100 : 0;
    $('roiBar').style.width = Math.min(100, Math.max(0, pct)) + '%';

    $('verdict').textContent = r.net >= 0
      ? `${name} pays for itself — ${fmtPayback(r.paybackYears)} to break even on your numbers.`
      : `${name} never pays for itself on your numbers — comfort alone may still be worth it.`;

    const item = { id: Date.now(), name, ...r };
    chrome.storage.local.get({ roiItems: [] }, (d) => {
      const items = [item, ...d.roiItems].slice(0, 30);
      chrome.storage.local.set({ roiItems: items }, () => renderSaved(items));
    });
  });

  $('clear').addEventListener('click', () => {
    chrome.storage.local.set({ roiItems: [] }, () => renderSaved([]));
  });
});
