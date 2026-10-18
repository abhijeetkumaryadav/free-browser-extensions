// Dropshipping Saturation Checker — popup logic.
// detectProduct() is injected into the page; it must stay self-contained
// (no references to anything outside itself).

'use strict';

/* ---------------- configuration (named constants, one place) ---------------- */

const WEIGHTS = {
  origin: 25,       // is the page itself on a wholesale / mass-sourcing marketplace?
  title: 20,        // generic, keyword-stuffed dropship-style title?
  brand: 15,        // missing / placeholder / throwaway brand?
  imagery: 15,      // supplier-CDN images, stock-photo reuse markers?
  social: 15,       // inflated review / sold counters?
  boilerplate: 10,  // supplier-facing copy ("dropshipping welcome", "MOQ"...)?
};

const WHOLESALE_HOSTS = [
  'aliexpress', 'alibaba', '1688.com', 'dhgate', 'temu', 'wish.com',
  'made-in-china', 'banggood', 'gearbest', 'lightinthebox', 'shein', 'joom',
];

const RETAIL_MARKETPLACES = [
  'amazon', 'ebay', 'walmart', 'etsy', 'shopee', 'lazada', 'flipkart',
  'mercadolibre', 'rakuten', 'coupang', 'target', 'bestbuy', 'noon',
];

const TITLE_BUZZWORDS = [
  'best', 'top', 'hot sale', 'new arrival', '2024', '2025', '2026', 'premium',
  'luxury', 'amazing', 'awesome', 'perfect', 'ultimate', 'pro', 'deluxe',
  'magic', 'smart', 'mini', 'portable', 'wireless', 'multifunction',
  'multifunctional', 'waterproof', 'rechargeable', 'free shipping',
  'high quality', 'factory', 'wholesale', 'dropshipping', 'limited',
  'exclusive', 'trending', 'viral', 'must have', 'must-have', 'gadget',
  'original', 'creative', 'cute', 'fashion', 'stylish', 'hot', 'sale',
];

const BOILERPLATE_PHRASES = [
  'dropshipping', 'dropship', 'wholesale price', 'ships from china',
  'ship within', 'welcome to our store', 'oem', 'odm', 'custom logo',
  'moq', 'factory direct', 'bulk order', 'reseller', 'supplier',
];

const GENERIC_BRAND_RE = /^(generic|unbranded|no[\s-]?brand|oem|odm|wholesale|n\/a|none)$/i;

const SUPPLIER_CDN_MARKERS = [
  'alicdn', 'alibaba', 'temuimage', 'wishmedia', 'dhresource',
  'made-in-china', 'banggood', 'gearbest',
];

const RING_CIRCUMFERENCE = 326.7; // 2 * PI * 52
const STORE_KEY = 'saturationScans';
const MAX_HISTORY = 40;

/* ---------------- page detection (injected into the tab) ---------------- */

function detectProduct() {
  function meta(prop) {
    const el = document.querySelector(
      'meta[property="' + prop + '"], meta[name="' + prop + '"]'
    );
    return el ? el.getAttribute('content') : null;
  }

  const out = {
    host: location.hostname.replace(/^www\./, ''),
    title: null,
    brand: null,
    price: null,
    listPrice: null,
    currency: null,
    rating: null,
    reviewCount: null,
    soldCount: null,
    imageCount: 0,
    imageHosts: [],
    altMissingRatio: 0,
    bodySample: '',
  };

  // JSON-LD Product blocks (most structured product pages have one).
  try {
    const scripts = document.querySelectorAll('script[type="application/ld+json"]');
    outer: for (const s of scripts) {
      const data = JSON.parse(s.textContent);
      const items = Array.isArray(data) ? data : [data];
      for (const it of items) {
        const graph = it['@graph'] || [it];
        for (const n of Array.isArray(graph) ? graph : [graph]) {
          if (!n || !/Product/i.test(n['@type'] || '')) continue;
          if (!out.title && n.name) out.title = String(n.name);
          const brand = n.brand;
          if (!out.brand && brand) {
            out.brand = typeof brand === 'string' ? brand : brand.name || null;
          }
          const offers = n.offers
            ? (Array.isArray(n.offers) ? n.offers[0] : n.offers)
            : null;
          if (offers) {
            if (out.price == null && offers.price != null) out.price = String(offers.price);
            if (offers.highPrice != null) out.listPrice = String(offers.highPrice);
            if (offers.priceCurrency) out.currency = String(offers.priceCurrency);
          }
          const agg = n.aggregateRating;
          if (agg) {
            if (out.rating == null && agg.ratingValue != null) out.rating = parseFloat(agg.ratingValue);
            if (out.reviewCount == null && agg.reviewCount != null) {
              out.reviewCount = parseInt(String(agg.reviewCount).replace(/[^\d]/g, ''), 10) || null;
            }
          }
          break outer;
        }
      }
    }
  } catch (e) { /* malformed JSON-LD — fall through to meta/DOM */ }

  if (!out.title) out.title = meta('og:title') || (document.title || '').split(/[|–—]/)[0].trim();
  if (!out.brand) out.brand = meta('product:brand') || meta('og:brand');
  if (out.price == null) {
    out.price = meta('product:price:amount') ||
      (document.querySelector('[itemprop="price"]') || {}).content || null;
  }
  if (!out.currency) out.currency = meta('product:price:currency');

  // DOM fallback for rating / review count.
  if (out.rating == null || out.reviewCount == null) {
    const body = (document.body && document.body.innerText) || '';
    const rm = body.match(/(\d(?:\.\d)?)\s*(?:out of|\/)\s*5\s*(?:stars?)?/i);
    if (out.rating == null && rm) out.rating = parseFloat(rm[1]);
    const cm = body.match(/([\d,]+)\s*(?:ratings?|reviews?)/i);
    if (out.reviewCount == null && cm) {
      out.reviewCount = parseInt(cm[1].replace(/[^\d]/g, ''), 10) || null;
    }
  }

  const bodyText = ((document.body && document.body.innerText) || '').slice(0, 60000);

  // "X sold / X orders" counters typical of mass marketplaces.
  let sold = null;
  const soldRe = /([\d,.]+)\s*(?:\+)?\s*(sold|orders?|bought|purchases?)/gi;
  let m;
  while ((m = soldRe.exec(bodyText)) !== null) {
    const n = parseInt(m[1].replace(/[^\d]/g, ''), 10);
    if (!isNaN(n) && (sold == null || n > sold)) sold = n;
  }
  out.soldCount = sold;

  // Image reuse markers: supplier CDN hosts + missing alt text.
  const imgs = Array.from(document.querySelectorAll('img')).slice(0, 40);
  const hosts = new Set();
  let altMissing = 0;
  for (const img of imgs) {
    const src = img.currentSrc || img.src || '';
    try {
      const h = new URL(src, location.href).hostname.replace(/^www\./, '');
      if (h && h !== out.host) hosts.add(h);
    } catch (e) { /* relative/invalid src */ }
    if (!img.alt) altMissing++;
  }
  out.imageCount = imgs.length;
  out.imageHosts = Array.from(hosts).slice(0, 20);
  out.altMissingRatio = imgs.length ? altMissing / imgs.length : 0;

  out.bodySample = bodyText.toLowerCase().slice(0, 40000);
  return out;
}

/* ---------------- scoring (pure, testable) ---------------- */

function hostMatches(host, list) {
  const h = (host || '').toLowerCase();
  return list.some((frag) => h === frag || h.endsWith('.' + frag) || h.includes(frag));
}

function countHits(text, phrases) {
  const found = [];
  for (const p of phrases) {
    if (text.includes(p)) found.push(p);
  }
  return found;
}

function scoreSaturation(sig) {
  const evidence = [];
  const factors = [];

  // 1. Origin source — the single strongest mass-listing tell.
  let originPts = 5;
  let originDetail = 'Independent storefront — saturation varies by niche.';
  if (hostMatches(sig.host, WHOLESALE_HOSTS)) {
    originPts = WEIGHTS.origin;
    originDetail = 'Listed on ' + sig.host + ' — a wholesale/mass-sourcing marketplace.';
    evidence.push('Wholesale source: ' + sig.host);
  } else if (hostMatches(sig.host, RETAIL_MARKETPLACES)) {
    originPts = 14;
    originDetail = sig.host + ' is a retail marketplace where mass-listed products cluster.';
    evidence.push('Retail marketplace: ' + sig.host);
  }
  factors.push({ key: 'origin', label: 'Source origin', points: originPts, max: WEIGHTS.origin, detail: originDetail });

  // 2. Title genericness — dropship titles are keyword-stuffed hype strings.
  const title = (sig.title || '').toLowerCase();
  const buzzHits = countHits(title, TITLE_BUZZWORDS);
  let titlePts = Math.min(WEIGHTS.title, buzzHits.length * 3);
  const seps = (sig.title || '').split(/[|•\-–—/:]/).length - 1;
  if (seps >= 3) { titlePts = Math.min(WEIGHTS.title, titlePts + 4); }
  const caps = ((sig.title || '').match(/\b[A-Z]{3,}\b/g) || []).length;
  if (caps >= 2) { titlePts = Math.min(WEIGHTS.title, titlePts + 4); }
  const titleDetail = buzzHits.length
    ? 'Generic hype markers: ' + buzzHits.slice(0, 5).join(', ') + (buzzHits.length > 5 ? ' +' + (buzzHits.length - 5) + ' more' : '')
    : 'No obvious keyword-stuffing detected in the title.';
  if (buzzHits.length) evidence.push(buzzHits.length + ' generic title buzzwords');
  factors.push({ key: 'title', label: 'Title genericness', points: titlePts, max: WEIGHTS.title, detail: titleDetail });

  // 3. Brand weakness — no defensible brand = copyable commodity.
  const brand = (sig.brand || '').trim();
  let brandPts = 3;
  let brandDetail = 'Branded product ("' + brand + '") — harder to copy 1:1.';
  if (!brand) {
    brandPts = WEIGHTS.brand;
    brandDetail = 'No brand identified — likely unbranded or generic.';
    evidence.push('No brand found');
  } else if (GENERIC_BRAND_RE.test(brand)) {
    brandPts = WEIGHTS.brand;
    brandDetail = 'Placeholder brand ("' + brand + '") — effectively unbranded.';
    evidence.push('Placeholder brand: ' + brand);
  } else if (/^[a-z0-9]{1,4}$/.test(brand) || brand.length <= 3) {
    brandPts = 10;
    brandDetail = 'Throwaway-style brand token ("' + brand + '").';
    evidence.push('Weak brand token: ' + brand);
  }
  factors.push({ key: 'brand', label: 'Brand weakness', points: brandPts, max: WEIGHTS.brand, detail: brandDetail });

  // 4. Image reuse — supplier CDN imagery means lifted supplier photos.
  let imgPts = 0;
  const supplierImgs = sig.imageHosts.filter((h) =>
    SUPPLIER_CDN_MARKERS.some((mk) => h.toLowerCase().includes(mk))
  );
  if (supplierImgs.length) {
    imgPts += 9;
    evidence.push('Supplier-CDN imagery: ' + supplierImgs.slice(0, 2).join(', '));
  }
  if (sig.imageCount < 3) imgPts += 3;
  else if (sig.imageCount >= 8) imgPts += 2; // bulk supplier photo dumps
  if (sig.altMissingRatio > 0.6 && sig.imageCount > 0) imgPts += 2;
  imgPts = Math.min(WEIGHTS.imagery, imgPts);
  const imgDetail = supplierImgs.length
    ? 'Images served from supplier CDNs — lifted supplier photos.'
    : (sig.imageCount < 3 ? 'Very few product images — low-effort listing.' : 'No supplier-CDN reuse markers found.');
  factors.push({ key: 'imagery', label: 'Image reuse', points: imgPts, max: WEIGHTS.imagery, detail: imgDetail });

  // 5. Social-proof inflation — huge counters signal mass-market commodity.
  let socPts = 0;
  const rc = sig.reviewCount || 0;
  const sc = sig.soldCount || 0;
  if (rc > 5000) { socPts += 8; evidence.push(rc.toLocaleString() + ' reviews'); }
  else if (rc > 1000) { socPts += 5; evidence.push(rc.toLocaleString() + ' reviews'); }
  else if (rc > 200) socPts += 2;
  if (sc > 10000) { socPts += 7; evidence.push(sc.toLocaleString() + '+ sold'); }
  else if (sc > 2000) { socPts += 4; evidence.push(sc.toLocaleString() + '+ sold'); }
  else if (sc > 200) socPts += 2;
  if (rc > 1000 && sig.rating != null && sig.rating < 4.2) {
    socPts += 3;
    evidence.push('High volume, mediocre rating (' + sig.rating + '★)');
  }
  socPts = Math.min(WEIGHTS.social, socPts);
  const socDetail = (rc || sc)
    ? 'Review/sold counters suggest mass-market volume.'
    : 'No inflated review or sold counters detected.';
  factors.push({ key: 'social', label: 'Social-proof inflation', points: socPts, max: WEIGHTS.social, detail: socDetail });

  // 6. Supplier boilerplate — copy written for resellers, not buyers.
  const boilerHits = countHits(sig.bodySample || '', BOILERPLATE_PHRASES);
  const boilerPts = Math.min(WEIGHTS.boilerplate, boilerHits.length * 3);
  const boilerDetail = boilerHits.length
    ? 'Supplier-facing copy: ' + boilerHits.slice(0, 4).join(', ')
    : 'No supplier-facing boilerplate detected.';
  if (boilerHits.length) evidence.push('Boilerplate: ' + boilerHits.slice(0, 3).join(', '));
  factors.push({ key: 'boilerplate', label: 'Supplier boilerplate', points: boilerPts, max: WEIGHTS.boilerplate, detail: boilerDetail });

  const score = factors.reduce((sum, f) => sum + f.points, 0);
  return { score: Math.min(100, Math.round(score)), factors, evidence };
}

function verdictFor(score) {
  if (score >= 76) {
    return {
      key: 'saturated', label: 'SATURATED',
      blurb: 'Over-sold. Skip unless you have a defensible edge.',
      tips: [
        'Do not launch this product as-is — ad costs will eat the margin.',
        'If you still want it, you need a real moat: bundle, rebrand, or a new angle/creative.',
        'Pivot to adjacent, less-listed variants of the same problem it solves.',
      ],
    };
  }
  if (score >= 56) {
    return {
      key: 'heating', label: 'HEATING UP',
      blurb: 'Crowded. Only enter with a clear differentiator.',
      tips: [
        'Check 5–10 competitor listings: if creatives look identical, the niche is commoditized.',
        'Enter only with a unique angle — better bundle, premium packaging, or a sub-niche audience.',
        'Test with a small budget and kill fast if CPA is above target.',
      ],
    };
  }
  if (score >= 34) {
    return {
      key: 'warming', label: 'WARMING UP',
      blurb: 'Circulating. Verify competition before committing.',
      tips: [
        'Search the product name on 2–3 marketplaces and count near-identical listings.',
        'Look for gaps: weak reviews, bad creatives, or underserved sub-audiences.',
        'Move quickly if you enter — this band tips into HEATING UP fast.',
      ],
    };
  }
  return {
    key: 'fresh', label: 'FRESH',
    blurb: 'Low saturation. Worth testing.',
    tips: [
      'Low mass-listing signals — validate demand with a small test budget.',
      'Secure a reliable supplier and confirm shipping times before scaling.',
      'Build branded creatives early; fresh products get copied within weeks.',
    ],
  };
}

/* ---------------- storage ---------------- */

async function loadHistory() {
  const data = await chrome.storage.local.get(STORE_KEY);
  return Array.isArray(data[STORE_KEY]) ? data[STORE_KEY] : [];
}

async function saveHistory(list) {
  await chrome.storage.local.set({ [STORE_KEY]: list.slice(0, MAX_HISTORY) });
}

/* ---------------- ui ---------------- */

const $ = (id) => document.getElementById(id);

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function renderReport(sig, result) {
  const verdict = verdictFor(result.score);

  $('prodTitle').textContent = sig.title || '(untitled product)';
  $('report').hidden = false;
  $('empty').style.display = 'none';

  // Animated ring.
  const fill = $('ringFill');
  fill.style.strokeDashoffset = RING_CIRCUMFERENCE;
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      fill.style.strokeDashoffset = String(
        RING_CIRCUMFERENCE * (1 - result.score / 100)
      );
    });
  });

  // Count-up number.
  const numEl = $('scoreNum');
  const start = performance.now();
  const DUR = 700;
  function tick(now) {
    const p = Math.min(1, (now - start) / DUR);
    numEl.textContent = String(Math.round(result.score * p));
    if (p < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);

  const vEl = $('verdict');
  vEl.className = 'verdict ' + verdict.key;
  vEl.innerHTML = esc(verdict.label) + '<small>' + esc(verdict.blurb) + '</small>';

  $('factors').innerHTML = result.factors.map((f) => (
    '<div class="factor">' +
      '<div class="fl"><span>' + esc(f.label) + '</span><span>' +
        f.points + ' / ' + f.max + '</span></div>' +
      '<div class="bar"><i data-w="' + Math.round((f.points / f.max) * 100) + '"></i></div>' +
      '<div class="fd">' + esc(f.detail) + '</div>' +
    '</div>'
  )).join('');
  requestAnimationFrame(() => requestAnimationFrame(() => {
    document.querySelectorAll('#factors .bar i').forEach((el) => {
      el.style.width = el.dataset.w + '%';
    });
  }));

  $('evidence').innerHTML = result.evidence.length
    ? result.evidence.map((e) => '<span class="chip">' + esc(e) + '</span>').join('')
    : '<span class="chip none">No strong saturation markers on this page.</span>';

  $('tips').innerHTML = verdict.tips.map((t) => '<li>' + esc(t) + '</li>').join('');

  // Wire one-shot actions for this scan.
  $('saveScan').onclick = () => saveCurrentScan(sig, result, verdict);
  $('copySum').onclick = () => copySummary(sig, result, verdict);
}

function summaryText(sig, result, verdict) {
  const lines = [
    'Saturation: ' + result.score + '/100 — ' + verdict.label,
    'Product: ' + (sig.title || 'unknown'),
    'Source: ' + (sig.host || 'unknown'),
  ];
  for (const f of result.factors) {
    lines.push('- ' + f.label + ': ' + f.points + '/' + f.max + ' — ' + f.detail);
  }
  if (result.evidence.length) lines.push('Evidence: ' + result.evidence.join('; '));
  lines.push('Note: heuristic on-device scan, not a guarantee of market conditions.');
  return lines.join('\n');
}

async function copySummary(sig, result, verdict) {
  const text = summaryText(sig, result, verdict);
  try {
    await navigator.clipboard.writeText(text);
    flashButton($('copySum'), 'Copied!');
  } catch (e) {
    // Clipboard may be blocked: fall back to a prompt-free textarea copy.
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); flashButton($('copySum'), 'Copied!'); }
    catch (err) { flashButton($('copySum'), 'Copy failed'); }
    ta.remove();
  }
}

function flashButton(btn, label) {
  const orig = btn.textContent;
  btn.textContent = label;
  setTimeout(() => { btn.textContent = orig; }, 1400);
}

async function saveCurrentScan(sig, result, verdict) {
  const history = await loadHistory();
  history.unshift({
    id: Date.now(),
    date: new Date().toLocaleDateString(),
    title: sig.title || '(untitled)',
    host: sig.host || '',
    score: result.score,
    verdict: verdict.label,
  });
  await saveHistory(history);
  renderHistory(history);
  flashButton($('saveScan'), 'Saved!');
}

async function renderHistory(history) {
  const list = history == null ? await loadHistory() : history;
  const card = $('histCard');
  const box = $('history');
  if (!list.length) { card.hidden = true; return; }
  card.hidden = false;
  box.innerHTML = '';
  for (const h of list) {
    const row = document.createElement('div');
    row.className = 'hist-row';
    const t = document.createElement('div');
    t.className = 't';
    const b = document.createElement('b');
    b.textContent = h.title;
    b.title = h.title;
    const span = document.createElement('span');
    span.textContent = h.host + ' · ' + h.date + ' · ' + h.verdict;
    t.appendChild(b); t.appendChild(span);
    const s = document.createElement('div');
    s.className = 's';
    s.textContent = h.score;
    const x = document.createElement('button');
    x.className = 'x';
    x.textContent = '×';
    x.title = 'Delete';
    x.onclick = async () => {
      await saveHistory((await loadHistory()).filter((it) => it.id !== h.id));
      renderHistory();
    };
    row.appendChild(t); row.appendChild(s); row.appendChild(x);
    box.appendChild(row);
  }
}

/* ---------------- scan flow ---------------- */

async function runScan() {
  const btn = $('scan');
  btn.disabled = true;
  btn.textContent = 'Scanning…';
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || tab.id == null) throw new Error('no active tab');
    $('pageHost').textContent = new URL(tab.url).hostname.replace(/^www\./, '');

    const injected = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: detectProduct,
    });
    const sig = injected && injected[0] && injected[0].result;
    if (!sig || !sig.title) {
      $('empty').style.display = '';
      $('empty').innerHTML = 'Couldn’t detect a product on this page. Try a real product page.';
      return;
    }
    const result = scoreSaturation(sig);
    renderReport(sig, result);
  } catch (e) {
    $('empty').style.display = '';
    $('empty').innerHTML = 'Scan failed: ' + esc(e.message || e) +
      '. Reload the page and try again.';
  } finally {
    btn.disabled = false;
    btn.textContent = 'Scan page';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  $('scan').addEventListener('click', runScan);
  chrome.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
    if (tab && tab.url) {
      try { $('pageHost').textContent = new URL(tab.url).hostname.replace(/^www\./, ''); }
      catch (e) { /* non-URL tab */ }
    }
  });
  renderHistory();
  const note = document.createElement('div');
  note.className = 'note';
  note.textContent = 'Heuristic on-device analysis — directional, not a market guarantee.';
  document.querySelector('main').appendChild(note);
});
