// ---------------------------------------------------------------------------
// popup.js — ROI forecaster UI. Instant local recalculation on any input.
// ---------------------------------------------------------------------------

'use strict';

const $ = (id) => document.getElementById(id);
let costModel = 'cpc';

function readInputs() {
  return {
    spend: +$('inSpend').value,
    cpc: +$('inCpc').value,
    cpm: +$('inCpm').value,
    ctr: +$('inCtr').value,
    cvr: +$('whatif').value, // what-if slider drives conversion rate
    aov: +$('inAov').value,
    margin: +$('inMargin').value,
    costModel,
  };
}

function render() {
  const r = forecast(readInputs());
  $('whatifVal').textContent = readInputs().cvr + '%';

  const el = $('results');
  el.innerHTML =
    stat('Est. clicks', fmt(Math.round(r.clicks * 100) / 100), 'acc') +
    stat('Est. conversions', fmt(Math.round(r.conversions * 100) / 100), 'acc') +
    stat('Est. revenue', fmtMoney(r.revenue), '') +
    stat('ROAS', fmt(Math.round(r.roas * 100) / 100, 2) + 'x', r.roas >= 1 ? 'pos' : 'neg') +
    stat('Net profit', fmtMoney(r.netProfit), r.profitable ? 'pos' : 'neg') +
    stat('Cost per conversion', fmtMoney(r.cpa), '') +
    stat('Break-even CPC', fmtMoney(r.breakEvenCpc), 'wide') +
    stat('Break-even conv. rate', fmt(r.breakEvenCvr, 2) + '%', 'wide');
}

function stat(k, v, cls) {
  return `<div class="stat ${cls}"><div class="k">${k}</div><div class="v ${cls}">${v}</div></div>`;
}

function setModel(m) {
  costModel = m;
  $('mCpc').classList.toggle('active', m === 'cpc');
  $('mCpm').classList.toggle('active', m === 'cpm');
  $('cpcWrap').classList.toggle('hidden', m !== 'cpc');
  $('cpmWrap').classList.toggle('hidden', m !== 'cpm');
  render();
  chrome.storage.local.set({ roiState: { costModel } });
}

document.addEventListener('DOMContentLoaded', async () => {
  // Restore persisted inputs
  const saved = await chrome.storage.local.get(['roiInputs', 'roiState']);
  if (saved.roiInputs) {
    const map = {
      inSpend: 'spend', inCpc: 'cpc', inCpm: 'cpm',
      inCtr: 'ctr', inAov: 'aov', inMargin: 'margin',
    };
    for (const [id, key] of Object.entries(map)) {
      if (saved.roiInputs[key] != null) $(id).value = saved.roiInputs[key];
    }
  }
  setModel(saved.roiState && saved.roiState.costModel === 'cpm' ? 'cpm' : 'cpc');

  $('mCpc').addEventListener('click', () => setModel('cpc'));
  $('mCpm').addEventListener('click', () => setModel('cpm'));

  const inputs = ['inSpend', 'inCpc', 'inCpm', 'inCtr', 'inAov', 'inMargin', 'whatif'];
  for (const id of inputs) {
    $(id).addEventListener('input', () => {
      render();
      chrome.storage.local.set({
        roiInputs: {
          spend: $('inSpend').value, cpc: $('inCpc').value,
          cpm: $('inCpm').value, ctr: $('inCtr').value,
          aov: $('inAov').value, margin: $('inMargin').value,
        },
      });
    });
  }
  render();
});
