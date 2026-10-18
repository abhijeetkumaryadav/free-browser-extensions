/* ============================================================
   Page Number Styler
   popup.js — UI wiring around a pure layout engine (below).
   Images only — never touches PDFs. All local, zero network.
   ============================================================ */

// ENGINE-START
const MAX_FILES = 60;        // cap on pages in one set
const MAX_FILE_BYTES = 15 * 1024 * 1024;

/**
 * Format a page label.
 * @param {number} n        1-based page number
 * @param {number} total    total pages
 * @param {string} format   plain | dash | page | pagenof
 * @returns {string}
 */
function formatLabel(n, format, total) {
  switch (format) {
    case 'dash':    return '– ' + n + ' –';
    case 'page':    return 'Page ' + n;
    case 'pagenof': return 'Page ' + n + ' of ' + total;
    case 'plain':
    default:        return String(n);
  }
}

/**
 * Compute the stamp box for a page number on a WxH canvas.
 * Size and margin are given as fractions of the smaller canvas side.
 * @returns {{x:number,y:number,w:number,h:number,font:number,align:string}}
 *          x,y = pill top-left; font = px font size; align = textAlign value
 */
function stampBox(W, H, position, sizeFrac, marginFrac) {
  sizeFrac = Math.min(0.25, Math.max(0.01, sizeFrac));
  marginFrac = Math.min(0.2, Math.max(0, marginFrac));
  const S = Math.min(W, H);
  const font = Math.round(S * sizeFrac);
  // Pill is sized generously from font metrics: width ~= 4.2 * font, height ~= 1.9 * font.
  const pillH = Math.round(font * 1.9);
  const pillW = Math.round(font * 4.2);
  const m = Math.round(S * marginFrac);
  let x, align;
  if (position.includes('left'))        { x = m;               align = 'left';   }
  else if (position.includes('center')) { x = Math.round((W - pillW) / 2); align = 'center'; }
  else                                  { x = W - m - pillW;   align = 'right';  }
  const y = position.startsWith('top') ? m : H - m - pillH;
  // Guarantee the box never leaves the canvas, even when the pill is
  // wider than the canvas itself (pathological tiny canvases).
  const w = Math.min(pillW, W);
  const h = Math.min(pillH, H);
  return { x: Math.min(Math.max(0, x), Math.max(0, W - w)),
           y: Math.min(Math.max(0, y), Math.max(0, H - h)),
           w, h, font, align };
}

/**
 * Scaled display size of a natural WxH image fit into a max box.
 * @returns {{w:number,h:number,scale:number}}
 */
function fitBox(W, H, maxW, maxH) {
  if (!W || !H) return { w: 0, h: 0, scale: 1 };
  const scale = Math.min(maxW / W, maxH / H, 1);
  return { w: Math.round(W * scale), h: Math.round(H * scale), scale };
}

/**
 * Clamp page numbers to a safe start/count.
 * @param {number} start  raw start value
 * @param {number} count  number of pages
 * @returns {{start:number, numbers:number[]}}
 */
function pageNumbers(start, count) {
  start = Math.floor(Number(start));
  if (!isFinite(start)) start = 1;
  start = Math.min(9999, Math.max(0, start));
  count = Math.max(0, Math.floor(count));
  const numbers = [];
  for (let i = 0; i < count; i++) numbers.push(start + i);
  return { start, numbers };
}
// ENGINE-END

/* ---------- DOM wiring ---------- */
const $ = id => document.getElementById(id);
const pages = []; // {name, url, w, h} — object URLs, revoked on removal
let style = null; // persisted style options

function defaultStyle() {
  return { enabled: true, start: 1, position: 'bottom-right',
           fontPct: 5, marginPct: 4, fg: '#ffffff', bg: '#000000',
           pill: true, format: 'plain' };
}

function readStyle() {
  return {
    enabled: $('enabled').checked,
    start: parseInt($('startnum').value, 10),
    position: $('position').value,
    fontPct: parseFloat($('fontsize').value),
    marginPct: parseFloat($('margin').value),
    fg: $('fg').value, bg: $('bg').value,
    pill: $('pill').checked,
    format: $('format').value
  };
}

function applyStyle(s) {
  $('enabled').checked = s.enabled;
  $('startnum').value = s.start;
  $('position').value = s.position;
  $('fontsize').value = s.fontPct;
  $('margin').value = s.marginPct;
  $('fg').value = s.fg; $('bg').value = s.bg;
  $('pill').checked = s.pill;
  $('format').value = s.format;
  $('sizeval').textContent = s.fontPct + '%';
  $('marginval').textContent = s.marginPct + '%';
}

function saveStyle() {
  style = readStyle();
  chrome.storage.local.set({ pnsStyle: style });
}

function refreshList() {
  const list = $('list');
  list.innerHTML = '';
  if (!pages.length) {
    list.innerHTML = '<p class="meta empty">No images yet. Add image files to begin.</p>';
  } else {
    const { numbers } = pageNumbers(style.start, pages.length);
    pages.forEach((p, i) => {
      const div = document.createElement('div');
      div.className = 'item';
      const label = style.enabled ? formatLabel(numbers[i], style.format, pages.length) : '—';
      div.innerHTML =
        '<img alt="">' +
        '<span class="nm"></span>' +
        '<span class="num"></span>' +
        '<button class="ibtn" data-a="up" title="Move up" ' + (i === 0 ? 'disabled' : '') + '>↑</button>' +
        '<button class="ibtn" data-a="dn" title="Move down" ' + (i === pages.length - 1 ? 'disabled' : '') + '>↓</button>' +
        '<button class="ibtn danger" data-a="rm" title="Remove">✕</button>';
      div.querySelector('img').src = p.url;
      div.querySelector('.nm').textContent = p.name;
      div.querySelector('.num').textContent = label;
      div.querySelectorAll('.ibtn').forEach(b =>
        b.addEventListener('click', () => movePage(i, b.dataset.a)));
      list.appendChild(div);
    });
  }
  $('download').disabled = !pages.length;
  $('clearall').disabled = !pages.length;
  $('pageinfo').textContent = pages.length
    ? pages.length + ' page' + (pages.length === 1 ? '' : 's') : '—';
  renderPreview();
}

function movePage(i, action) {
  if (action === 'rm') { URL.revokeObjectURL(pages[i].url); pages.splice(i, 1); }
  else if (action === 'up' && i > 0) { [pages[i - 1], pages[i]] = [pages[i], pages[i - 1]]; }
  else if (action === 'dn' && i < pages.length - 1) { [pages[i + 1], pages[i]] = [pages[i], pages[i + 1]]; }
  else return;
  refreshList();
}

/* Preview: draw the first page with its stamp, fit into 348x200 */
function renderPreview() {
  const c = $('preview');
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, c.width, c.height);
  ctx.fillStyle = '#101016';
  ctx.fillRect(0, 0, c.width, c.height);
  if (!pages.length) {
    ctx.fillStyle = '#9aa0b4';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Preview appears here', c.width / 2, c.height / 2);
    $('pagelabel').textContent = '';
    return;
  }
  const img = new Image();
  img.onload = () => {
    const fit = fitBox(img.naturalWidth, img.naturalHeight, c.width, c.height);
    const dx = (c.width - fit.w) / 2, dy = (c.height - fit.h) / 2;
    ctx.drawImage(img, dx, dy, fit.w, fit.h);
    const { numbers } = pageNumbers(style.start, pages.length);
    if (style.enabled) {
      drawStamp(ctx, fit.w, fit.h, dx, dy,
        formatLabel(numbers[0], style.format, pages.length),
        style.position, style.fontPct / 100, style.marginPct / 100,
        style.fg, style.bg, style.pill);
    }
    $('pagelabel').textContent = 'Preview: page ' + numbers[0];
  };
  img.src = pages[0].url;
}

/**
 * Draw one stamp. Canvas ctx is already translated so the image occupies
 * (ox, oy, w, h). Shared with download rendering.
 */
function drawStamp(ctx, w, h, ox, oy, label, position, sizeFrac, marginFrac, fg, bg, pill) {
  const box = stampBox(w, h, position, sizeFrac, marginFrac);
  ctx.save();
  ctx.translate(ox, oy);
  if (pill) {
    ctx.fillStyle = bg;
    ctx.globalAlpha = 0.72;
    const r = box.h / 2;
    ctx.beginPath();
    ctx.roundRect(box.x, box.y, box.w, box.h, r);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  ctx.fillStyle = fg;
  ctx.font = '700 ' + box.font + 'px -apple-system, "Segoe UI", sans-serif';
  ctx.textBaseline = 'middle';
  const tx = box.align === 'left' ? box.x + box.h * 0.55
           : box.align === 'center' ? box.x + box.w / 2
           : box.x + box.w - box.h * 0.55;
  ctx.textAlign = box.align;
  ctx.fillText(label, tx, box.y + box.h / 2 + 1);
  ctx.restore();
}

/* Download: render every page at natural size with its stamp, zip-free —
   downloads are saved as individual PNGs with numbered names via
   sequential downloads (one per page). */
function downloadAll() {
  const { numbers } = pageNumbers(style.start, pages.length);
  let i = 0;
  const next = () => {
    if (i >= pages.length) return;
    const p = pages[i];
    const n = numbers[i];
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = img.naturalWidth; c.height = img.naturalHeight;
      const ctx = c.getContext('2d');
      ctx.drawImage(img, 0, 0);
      if (style.enabled) {
        drawStamp(ctx, c.width, c.height, 0, 0,
          formatLabel(n, style.format, pages.length),
          style.position, style.fontPct / 100, style.marginPct / 100,
          style.fg, style.bg, style.pill);
      }
      c.toBlob(blob => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'page-' + String(n).padStart(3, '0') + '.png';
        document.body.appendChild(a);
        a.click();
        setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
        i++;
        next();
      }, 'image/png');
    };
    img.src = p.url;
  };
  next();
}

/* Events */
$('files').addEventListener('change', e => {
  const files = Array.from(e.target.files || []);
  for (const f of files) {
    if (pages.length >= MAX_FILES) break;
    if (!f.type.startsWith('image/')) continue;
    if (f.size > MAX_FILE_BYTES) continue;
    pages.push({ name: f.name, url: URL.createObjectURL(f), w: 0, h: 0 });
  }
  e.target.value = '';
  refreshList();
});

$('download').addEventListener('click', downloadAll);
$('clearall').addEventListener('click', () => {
  pages.forEach(p => URL.revokeObjectURL(p.url));
  pages.length = 0;
  refreshList();
});

['enabled', 'startnum', 'position', 'fontsize', 'margin', 'fg', 'bg', 'pill', 'format']
  .forEach(id => $(id).addEventListener('input', () => {
    $('sizeval').textContent = $('fontsize').value + '%';
    $('marginval').textContent = $('margin').value + '%';
    saveStyle();
    refreshList();
  }));

/* Restore style */
chrome.storage.local.get('pnsStyle', data => {
  style = Object.assign(defaultStyle(), data.pnsStyle || {});
  applyStyle(style);
  refreshList();
});
