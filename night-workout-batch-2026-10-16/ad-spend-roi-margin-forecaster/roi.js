// ---------------------------------------------------------------------------
// roi.js — dependency-free ROI math. Educational model only — not a prediction.
// ---------------------------------------------------------------------------

'use strict';

/**
 * Compute forecast from inputs.
 * costModel: 'cpc' | 'cpm'
 */
function forecast(o) {
  const spend = Math.max(0, +o.spend || 0);
  const cpc = Math.max(0, +o.cpc || 0);
  const cpm = Math.max(0, +o.cpm || 0);
  const ctr = Math.min(100, Math.max(0, +o.ctr || 0)); // %
  const cvr = Math.min(100, Math.max(0, +o.cvr || 0)); // %
  const aov = Math.max(0, +o.aov || 0);
  const margin = Math.min(100, Math.max(0, +o.margin || 0)); // %
  const model = o.costModel === 'cpm' ? 'cpm' : 'cpc';

  let clicks, impressions;
  if (model === 'cpm') {
    impressions = cpm > 0 ? (spend / cpm) * 1000 : 0;
    clicks = (impressions * ctr) / 100;
  } else {
    clicks = cpc > 0 ? spend / cpc : 0;
    impressions = ctr > 0 ? (clicks / ctr) * 100 : 0;
  }

  const conversions = (clicks * cvr) / 100;
  const revenue = conversions * aov;
  const grossProfit = (revenue * margin) / 100;
  const netProfit = grossProfit - spend;
  const roas = spend > 0 ? revenue / spend : 0;
  const cpa = conversions > 0 ? spend / conversions : 0;

  // Break-even CPC: max CPC where gross profit covers spend (CPC model).
  // revenue margin per click = cvr/100 * aov * margin/100 → breakEvenCpc = that value.
  const breakEvenCpc = (cvr / 100) * aov * (margin / 100);
  // Break-even conversion rate for current CPC: cvr% = spend-equivalent.
  const breakEvenCvr = cpc > 0 && aov > 0 && margin > 0
    ? (cpc / (aov * (margin / 100))) * 100
    : 0;

  return {
    clicks, impressions, conversions, revenue, grossProfit,
    netProfit, roas, cpa, breakEvenCpc, breakEvenCvr,
    profitable: netProfit > 0,
  };
}

function fmt(n, dec) {
  return (+n).toLocaleString(undefined, {
    minimumFractionDigits: dec, maximumFractionDigits: dec,
  });
}

function fmtMoney(n) {
  return '$' + fmt(Math.round(n * 100) / 100, 2);
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { forecast, fmt, fmtMoney };
}
