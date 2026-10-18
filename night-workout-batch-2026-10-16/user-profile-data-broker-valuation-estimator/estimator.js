/*
  estimator.js - pure, DOM-free estimation logic for the Data Broker Value Estimator.
  Kept separate from popup.js so the math can be unit-tested in Node.
  All rates are ILLUSTRATIVE reference values, not market prices.
*/

// Bundled reference rate table (approximate, illustrative, editable by the user).
// Values are estimated USD per year per unit of the data category.
const DEFAULT_RATES = {
  identityRecord:   { rate: 0.50, unit: "per online account",    label: "Identity records (name, email, address on file)" },
  purchaseHistory:  { rate: 2.00, unit: "per monthly purchase",  label: "Purchase history & intent signals" },
  locationSharing:  { rate: 15.00, unit: "flat / year",          label: "Precise location sharing" },
  socialProfile:    { rate: 3.00, unit: "per platform / year",   label: "Social media profiles" },
  loyaltyProgram:   { rate: 5.00, unit: "per program / year",    label: "Loyalty & rewards programs" },
  streamingHabits:  { rate: 4.00, unit: "per service / year",    label: "Streaming viewing habits" },
  healthFitness:    { rate: 8.00, unit: "per app / year",        label: "Health & fitness app data" },
  smartHome:        { rate: 6.00, unit: "per device / year",      label: "Smart-home device telemetry" },
  emailNewsletters: { rate: 0.25, unit: "per subscription / year", label: "Email newsletter subscriptions" },
  searchHistory:    { rate: 6.00, unit: "flat / year",           label: "Search history (ad-profiled)" }
};

// Questionnaire definition: key -> { kind: 'number'|'toggle', label, hint, max }
const QUESTIONS = {
  identityRecord:  { kind: "number", label: "Online accounts",            hint: "Shopping, banking, forums, etc.", max: 200 },
  purchaseHistory: { kind: "number", label: "Online purchases / month",   hint: "Average across all stores",        max: 60 },
  locationSharing: { kind: "toggle", label: "Location sharing enabled",   hint: "Apps with precise location access", max: 1 },
  socialProfile:   { kind: "number", label: "Social platforms used",      hint: "Active profiles",                  max: 20 },
  loyaltyProgram:  { kind: "number", label: "Loyalty / rewards programs", hint: "Store cards, airline miles…",      max: 40 },
  streamingHabits: { kind: "number", label: "Streaming services",         hint: "Video, music, podcasts",           max: 20 },
  healthFitness:   { kind: "number", label: "Health / fitness apps",      hint: "Trackers, diet, sleep",            max: 20 },
  smartHome:       { kind: "number", label: "Smart-home devices",         hint: "Speakers, cameras, thermostats",   max: 50 },
  emailNewsletters:{ kind: "number", label: "Newsletter subscriptions",   hint: "Marketing emails you receive",     max: 200 },
  searchHistory:   { kind: "toggle", label: "Personalized ads enabled",   hint: "Ad personalization on search",     max: 1 }
};

/**
 * Clamp a raw answer to a sane non-negative range.
 */
function sanitizeAnswer(key, raw) {
  const q = QUESTIONS[key];
  if (!q) return 0;
  let n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(n, q.max);
}

/**
 * Estimate the annual data value.
 * @param {Object} answers - key -> numeric answer
 * @param {Object} rates - key -> { rate }
 * @returns {{ total: number, lines: Array<{key,label,amount,unit}> }}
 */
function estimateValue(answers, rates) {
  const lines = [];
  let total = 0;
  for (const key of Object.keys(QUESTIONS)) {
    const qty = sanitizeAnswer(key, answers[key]);
    const rate = (rates && rates[key] && Number(rates[key].rate)) || 0;
    const amount = qty * rate;
    total += amount;
    lines.push({ key, label: DEFAULT_RATES[key].label, unit: DEFAULT_RATES[key].unit, qty, rate, amount });
  }
  return { total, lines: lines.sort((a, b) => b.amount - a.amount) };
}

/**
 * Plain-language tier for a yearly total.
 */
function tierFor(total) {
  if (total < 5)   return { name: "Minimal footprint",  blurb: "You share very little marketable data — nice privacy hygiene." };
  if (total < 50)  return { name: "Average footprint",  blurb: "A typical connected consumer. Brokers buy profiles like yours in bulk." };
  if (total < 150) return { name: "Rich footprint",     blurb: "Your combined signals are valuable — expect heavy ad targeting." };
  return { name: "Data goldmine", blurb: "Brokers would love your profile. Consider trimming what you share." };
}

// Export for Node smoke tests; harmless in the popup.
if (typeof module !== "undefined" && module.exports) {
  module.exports = { DEFAULT_RATES, QUESTIONS, sanitizeAnswer, estimateValue, tierFor };
}
