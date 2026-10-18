/* ContrastLens — popup logic.
 * The scanner runs inside the page via scripting.executeScript, user-gesture only.
 * scanContrastPage() is fully self-contained (no popup-scope references). */

/**
 * Injected into the active tab. Collects visible text elements, resolves their
 * computed foreground color and nearest opaque background color, computes the
 * WCAG contrast ratio, and returns deduplicated (fg,bg) pairs.
 * Heuristic: background images/gradients and semi-transparent layering are ignored.
 */
function scanContrastPage() {
  // --- color helpers (self-contained) ---
  function parseColor(str) {
    if (!str) return null;
    str = str.trim().toLowerCase();
    let m;
    if ((m = /^#([0-9a-f]{6})$/.exec(str))) {
      return { r: parseInt(m[1].slice(0, 2), 16), g: parseInt(m[1].slice(2, 4), 16), b: parseInt(m[1].slice(4, 6), 16), a: 1 };
    }
    if ((m = /^#([0-9a-f]{3})$/.exec(str))) {
      return { r: parseInt(m[1][0] + m[1][0], 16), g: parseInt(m[1][1] + m[1][1], 16), b: parseInt(m[1][2] + m[1][2], 16), a: 1 };
    }
    if ((m = /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)$/.exec(str))) {
      return { r: +m[1], g: +m[2], b: +m[3], a: m[4] === undefined ? 1 : +m[4] };
    }
    return null;
  }
  function luminance(c) {
    const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
  }
  function ratio(fg, bg) {
    const l1 = luminance(fg), l2 = luminance(bg);
    const hi = Math.max(l1, l2), lo = Math.min(l1, l2);
    return (hi + 0.05) / (lo + 0.05);
  }
  function toHex(c) {
    const h = (v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0');
    return '#' + h(c.r) + h(c.g) + h(c.b);
  }
  // Nearest ancestor with an (almost) opaque background color.
  function effectiveBg(el) {
    let node = el;
    while (node && node.nodeType === 1) {
      const cs = getComputedStyle(node);
      const bg = parseColor(cs.backgroundColor);
      if (bg && bg.a >= 0.95) return bg;
      node = node.parentElement;
    }
    return { r: 255, g: 255, b: 255, a: 1 }; // fallback: white page
  }
  function isVisible(el) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return false;
    const cs = getComputedStyle(el);
    return cs.visibility !== 'hidden' && cs.display !== 'none' && parseFloat(cs.opacity) > 0;
  }
  function hasOwnText(el) {
    for (const n of el.childNodes) {
      if (n.nodeType === 3 && n.textContent.trim().length > 0) return n.textContent.trim().slice(0, 80);
    }
    return null;
  }

  const seen = new Map();
  const els = document.querySelectorAll('p,h1,h2,h3,h4,h5,h6,a,span,button,li,td,th,label,small,strong,em,div');
  let scanned = 0;
  for (const el of els) {
    if (scanned >= 400) break; // cap work on huge pages
    const sample = hasOwnText(el);
    if (!sample || !isVisible(el)) continue;
    scanned++;
    const fg = parseColor(getComputedStyle(el).color);
    if (!fg || fg.a < 0.5) continue;
    const bg = effectiveBg(el);
    const key = toHex(fg) + '|' + toHex(bg);
    if (seen.has(key)) continue;
    seen.set(key, {
      fg: toHex(fg),
      bg: toHex(bg),
      ratio: Math.round(ratio(fg, bg) * 100) / 100,
      tag: el.tagName.toLowerCase(),
      sample
    });
  }
  return { pairs: [...seen.values()], scanned };
}

/* ---------- popup UI ---------- */

const $ = (id) => document.getElementById(id);
const scanBtn = $('scanBtn'), statusEl = $('status'), summaryEl = $('summary'),
      resultsEl = $('results');

function setStatus(msg) {
  statusEl.textContent = msg;
  statusEl.classList.remove('hidden');
}
function clearStatus() { statusEl.classList.add('hidden'); statusEl.textContent = ''; }

function badge(label, pass, kind) {
  return `<span class="badge ${kind}-${pass ? 'pass' : 'fail'}">${label} ${pass ? '✓' : '✗'}</span>`;
}

function suggestion(p) {
  // Which side is easier to fix? Suggest adjusting the lighter/darker side.
  if (p.ratio >= 4.5) return 'Meets AA for normal text.';
  if (p.ratio >= 3) return 'OK for large text only — darken text or lighten bg for body copy.';
  return 'Fails AA — darken the text or lighten the background.';
}

function render(data) {
  const pairs = data.pairs.sort((a, b) => a.ratio - b.ratio);
  const failAA = pairs.filter(p => p.ratio < 4.5).length;
  const failAAA = pairs.filter(p => p.ratio < 7).length;

  $('pairCount').textContent = pairs.length;
  $('failAA').textContent = failAA;
  $('failAAA').textContent = failAAA;
  summaryEl.classList.remove('hidden');

  resultsEl.innerHTML = '';
  if (!pairs.length) {
    setStatus('No text elements found on this page.');
    return;
  }
  for (const p of pairs) {
    const li = document.createElement('li');
    li.className = 'row';
    li.innerHTML =
      `<div class="swatches">
         <span class="sw" style="background:${p.fg}" title="Text ${p.fg}"></span>
         <span class="sw" style="background:${p.bg}" title="Background ${p.bg}"></span>
       </div>
       <div class="meta">
         <div class="ratio">${p.ratio.toFixed(2)} : 1 <span style="color:var(--muted);font-weight:400">· &lt;${p.tag}&gt;</span></div>
         <div class="sample" title="${escapeHtml(p.sample)}">${escapeHtml(p.sample)}</div>
         <div class="tip">${p.fg} on ${p.bg} — ${suggestion(p)}</div>
       </div>
       <div class="badges">
         ${badge('AA', p.ratio >= 4.5, 'aa')}
         ${badge('AAA', p.ratio >= 7, 'aaa')}
       </div>`;
    resultsEl.appendChild(li);
  }
  clearStatus();
  setStatus(`Scanned ${data.scanned} text elements → ${pairs.length} unique color pairs. ` +
    (failAA ? `${failAA} pair${failAA > 1 ? 's' : ''} fail${failAA > 1 ? '' : 's'} WCAG AA (4.5:1) — fix these first.` : 'All pairs meet WCAG AA. 🎉'));
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

scanBtn.addEventListener('click', async () => {
  scanBtn.disabled = true;
  resultsEl.innerHTML = '';
  summaryEl.classList.add('hidden');
  setStatus('Scanning page…');
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id) throw new Error('No active tab.');
    const [res] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: scanContrastPage
    });
    if (!res || !res.result) throw new Error('Scan returned nothing.');
    render(res.result);
  } catch (e) {
    const msg = String((e && e.message) || e);
    setStatus(msg.includes('Cannot access')
      ? 'Cannot scan this page (restricted page such as chrome:// or the Web Store).'
      : 'Scan failed: ' + msg);
  } finally {
    scanBtn.disabled = false;
  }
});
