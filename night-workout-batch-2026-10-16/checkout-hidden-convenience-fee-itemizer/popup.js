// FeeLens — on-demand checkout fee scanner.
// Content script (injected on explicit click only) heuristically finds the
// visible order-summary area, extracts label/amount pairs, and classifies them.
// 100% local, read-only: the page is never modified.

'use strict';

/* ---------- heuristic keyword lists (shared with popup rendering) ---------- */
const FEE_PATTERNS = [
  { re: /convenience/i, note: 'A "convenience fee" is an extra charge for the payment method or channel you chose (e.g. paying by card or online). Ask whether an alternative payment avoids it.' },
  { re: /service\s*fee|service\s*charge/i, note: 'A "service fee" is an add-on the merchant keeps on top of the item price. It is not a tip unless labeled as one.' },
  { re: /processing|handling/i, note: '"Processing" or "handling" fees cover the seller\'s cost of taking your payment — often negotiable by switching payment methods.' },
  { re: /booking/i, note: 'A "booking fee" is charged per transaction by ticketing platforms. Buying multiple tickets at once usually spreads it thinner.' },
  { re: /delivery|shipping/i, note: 'Delivery/shipping charges. Check whether a cheaper tier or pickup option exists before accepting the default.' },
  { re: /regulatory|compliance|admin|paper\s*(bill|statement)|misc/i, note: 'Surcharges like "regulatory recovery" or "admin" fees are set by the merchant, not the government. Worth questioning.' },
  { re: /insurance|protection|warranty/i, note: 'Optional add-ons (insurance, protection plans) are sometimes pre-selected. Make sure you actually want them.' },
  { re: /tip|gratuity/i, note: 'A tip or gratuity. Check whether it was pre-filled at a high percentage — you can usually change it.' },
  { re: /surcharge/i, note: 'A generic "surcharge" is an extra charge the merchant chose to add. Ask what it is for.' }
];
const TAX_RE = /tax|vat|gst|hst|pst|duty|duties/i;
const SUBTOTAL_RE = /subtotal|sub-total|items?\s*total|merchandise/i;
const TOTAL_RE = /^(grand\s*)?total|amount\s*due|balance\s*due|order\s*total/i;

function classify(line) {
  const { label } = line;
  if (TOTAL_RE.test(label)) return 'total';
  if (SUBTOTAL_RE.test(label)) return 'subtotal';
  if (TAX_RE.test(label)) return 'tax';
  for (const p of FEE_PATTERNS) {
    if (p.re.test(label)) return { kind: 'fee', note: p.note };
  }
  return 'other';
}

function parseAmount(s) {
  const n = parseFloat(String(s).replace(/[^0-9.\-]/g, ''));
  return isNaN(n) ? 0 : n;
}

/* ---------- popup-side ---------- */
const $ = (id) => document.getElementById(id);
const money = (n) => (n < 0 ? '-$' : '$') + Math.abs(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

async function runScan() {
  const msg = $('scanMsg');
  $('btnScan').disabled = true;
  msg.textContent = 'Scanning the visible checkout area…';
  msg.className = 'msg';
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id) throw new Error('No active tab.');
    const [res] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        // Re-defined inside the page: self-contained serialization.
        const out = { lines: [], error: null };
        try {
          const scopeSel = [
            '[data-testid*="summary"]', '[class*="order-summary"]', '[class*="OrderSummary"]',
            '[id*="order-summary"]', '[class*="cart-summary"]', '[class*="checkout-summary"]',
            '[class*="totals"]', '[class*="summary-total"]', 'aside'
          ];
          let scope = null;
          for (const sel of scopeSel) {
            try {
              const el = document.querySelector(sel);
              if (el && el.innerText && el.innerText.length > 20) { scope = el; break; }
            } catch (e) {}
          }
          if (!scope) scope = document.body;
          const rows = new Map();
          const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT);
          let node;
          const amtRe = /([$€£₹]\s?[\d,]+(?:\.\d{2})?)/;
          while ((node = walker.nextNode())) {
            const t = node.textContent.trim();
            if (!t) continue;
            const m = t.match(amtRe);
            if (m) {
              const label = t.replace(m[0], '').replace(/[:\-–—\s]+$/, '').trim().slice(0, 80);
              if (label.length >= 2) rows.set(label.toLowerCase(), { label, amountText: m[1] });
            }
          }
          for (const v of rows.values()) out.lines.push(v);
        } catch (e) { out.error = String(e && e.message || e); }
        return out;
      }
    });
    const data = res && res.result;
    if (!data || data.error) throw new Error(data && data.error ? data.error : 'Scan returned nothing.');
    if (!data.lines.length) {
      msg.textContent = 'No price lines found. Open a checkout/order-summary page and try again.';
      msg.className = 'msg';
      $('resultsCard').classList.add('hidden');
      return;
    }
    render(data.lines);
    msg.textContent = `Found ${data.lines.length} price line${data.lines.length === 1 ? '' : 's'}.`;
  } catch (e) {
    msg.textContent = 'Scan failed: ' + (e.message || e) + ' (some pages block script injection).';
    msg.className = 'msg err';
  } finally {
    $('btnScan').disabled = false;
  }
}

function render(rawLines) {
  const lines = rawLines.map((l) => {
    const c = classify(l);
    return { ...l, amount: parseAmount(l.amountText), cls: typeof c === 'string' ? c : c.kind, note: typeof c === 'object' ? c.note : null };
  });
  const card = $('resultsCard');
  card.classList.remove('hidden');

  const sub = lines.filter((l) => l.cls === 'subtotal').reduce((s, l) => s + l.amount, 0);
  const fees = lines.filter((l) => l.cls === 'fee').reduce((s, l) => s + l.amount, 0);
  const tax = lines.filter((l) => l.cls === 'tax').reduce((s, l) => s + l.amount, 0);
  const total = lines.filter((l) => l.cls === 'total').reduce((s, l) => s + l.amount, 0);
  $('tSub').textContent = sub ? money(sub) : '—';
  $('tFees').textContent = fees ? money(fees) : '$0.00';
  $('tTax').textContent = tax ? money(tax) : '—';
  $('tTotal').textContent = total ? money(total) : '—';

  const flags = $('flags');
  flags.innerHTML = '';
  const feeLines = lines.filter((l) => l.note);
  if (!feeLines.length) {
    flags.innerHTML = '<p class="msg">No fee-like line items detected. Subtotal, taxes, and total look clean.</p>';
  }
  for (const f of feeLines) {
    const div = document.createElement('div');
    div.className = 'flag';
    div.innerHTML = `
      <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
      <div><strong></strong><p></p><div class="amtline"></div></div>`;
    div.querySelector('strong').textContent = f.label;
    div.querySelector('p').textContent = f.note;
    div.querySelector('.amtline').textContent = 'Charged: ' + money(f.amount);
    flags.appendChild(div);
  }

  const box = $('lines');
  box.innerHTML = '';
  for (const l of lines) {
    const div = document.createElement('div');
    div.className = 'line' + (l.cls === 'fee' ? ' fee' : '');
    div.innerHTML = '<span class="label"></span><span class="amt"></span>';
    div.querySelector('.label').textContent = l.label;
    div.querySelector('.amt').textContent = money(l.amount);
    box.appendChild(div);
  }

  // Persist last scan summary only.
  chrome.storage.local.set({
    'feelens.last': { at: Date.now(), count: lines.length, fees, feeCount: feeLines.length }
  });
}

// Guard DOM init so pure logic stays testable in Node.
if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    $('btnScan').addEventListener('click', runScan);
  });
}

// Exported for Node smoke tests.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { classify, parseAmount, FEE_PATTERNS };
}
