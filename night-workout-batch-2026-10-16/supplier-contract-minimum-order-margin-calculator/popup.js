/* MOQ Margin Calculator — pure computation + persistence; no network. */
'use strict';

const $ = id => document.getElementById(id);

/* Compute all contract math from inputs. All values are estimates. */
function compute({ unitCost, moq, freight, fees, sellPrice }) {
  const outlay = unitCost * moq + freight + fees;       // total cash required
  const landed = moq > 0 ? outlay / moq : 0;             // landed cost per unit
  const perUnitMargin = sellPrice - landed;
  const breakEven = perUnitMargin > 0
    ? Math.ceil(outlay / sellPrice)                     // units to cover outlay
    : Infinity;
  return { outlay, landed, perUnitMargin, breakEven };
}

/* Margin at a given sell-through fraction. */
function scenario({ outlay, sellPrice, moq }, fraction) {
  const unitsSold = Math.round(moq * fraction);
  const revenue = unitsSold * sellPrice;
  const profit = revenue - outlay;
  const marginPct = revenue > 0 ? (profit / revenue) * 100 : 0;
  return { unitsSold, revenue, profit, marginPct };
}

const fmt = n => '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function render(res, inputs) {
  $('rLanded').textContent = fmt(res.landed);
  $('rOutlay').textContent = fmt(res.outlay);
  $('rBreak').textContent = Number.isFinite(res.breakEven) ? res.breakEven.toLocaleString() : 'Never';
  $('rMargin').textContent = (res.perUnitMargin >= 0 ? '' : '-') + Math.abs(res.perUnitMargin / (inputs.sellPrice || 1) * 100).toFixed(1) + '%';
  const full = { ...res, sellPrice: inputs.sellPrice, moq: inputs.moq };
  const rows = [[100], [75], [50], [25]].map(([pct]) => {
    const s = scenario(full, pct / 100);
    const cls = s.profit >= 0 ? 'pos' : 'neg';
    return `<div class="row"><span>${pct}% (${s.unitsSold.toLocaleString()}u)</span>` +
      `<span>${fmt(s.profit)}</span><span class="${cls}">${s.marginPct.toFixed(1)}%</span></div>`;
  });
  $('table').innerHTML =
    `<div class="row hd"><span>Sell-through</span><span>Profit</span><span>Margin</span></div>` + rows.join('');
  $('results').hidden = false;
}

async function onCalc() {
  const inputs = {
    unitCost: parseFloat($('unitCost').value) || 0,
    moq: Math.max(1, Math.floor(parseFloat($('moq').value) || 0)),
    freight: parseFloat($('freight').value) || 0,
    fees: parseFloat($('fees').value) || 0,
    sellPrice: parseFloat($('sellPrice').value) || 0,
  };
  render(compute(inputs), inputs);
  await chrome.storage.local.set({ moqLastInputs: inputs });   // remember inputs locally
}

async function restore() {
  const { moqLastInputs } = await chrome.storage.local.get('moqLastInputs');
  if (moqLastInputs) {
    $('unitCost').value = moqLastInputs.unitCost || '';
    $('moq').value = moqLastInputs.moq || '';
    $('freight').value = moqLastInputs.freight || '';
    $('fees').value = moqLastInputs.fees || '';
    $('sellPrice').value = moqLastInputs.sellPrice || '';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  restore();
  $('calc').addEventListener('click', onCalc);
});
