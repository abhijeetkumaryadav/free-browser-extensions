'use strict';
/* ============================================================
 * Tab Constellation Map — cosmetic canvas map of your open tabs.
 * Tabs are never modified, closed, or rearranged. Fully local.
 * ============================================================ */

// ENGINE-START — pure functions, unit-tested headlessly.

const STAR_RADIUS = 11;   // click radius in canvas px
const PALETTE = ['#22d3ee', '#a78bfa', '#f472b6', '#fbbf24', '#34d399', '#f87171', '#60a5fa', '#f97316'];

function hostOf(url) {
  try {
    const u = new URL(String(url));
    let h = u.hostname || '';
    if (u.protocol === 'chrome:' || u.protocol === 'edge:' || u.protocol === 'about:') {
      h = u.hostname || u.pathname.replace(/\//g, '') || 'internal';
    }
    if (h.startsWith('www.')) h = h.slice(4);
    return h || 'unknown';
  } catch { return 'unknown'; }
}

// Group tabs by domain; groups sorted largest-first (stable by host).
function groupByDomain(tabs) {
  const map = new Map();
  for (const tab of (Array.isArray(tabs) ? tabs : [])) {
    const host = hostOf(tab.url);
    if (!map.has(host)) map.set(host, { host, tabs: [] });
    map.get(host).tabs.push(tab);
  }
  return [...map.values()].sort((a, b) =>
    b.tabs.length - a.tabs.length || (a.host < b.host ? -1 : 1));
}

function domainColor(host) {
  let h = 0;
  const s = String(host);
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

// Deterministic star positions: groups get regions, tabs laid out in a spiral.
function starPositions(groups, W, H) {
  const stars = [];
  const n = groups.length;
  groups.forEach((g, gi) => {
    const cx = W * (0.5 + 0.38 * Math.cos((gi / Math.max(n, 1)) * Math.PI * 2 - Math.PI / 2));
    const cy = H * (0.5 + 0.36 * Math.sin((gi / Math.max(n, 1)) * Math.PI * 2 - Math.PI / 2));
    const R = Math.min(W, H) * 0.16;
    g.tabs.forEach((tab, ti) => {
      const ang = ti * 2.399963;             // golden angle spiral
      const r = R * Math.sqrt((ti + 0.6) / Math.max(g.tabs.length, 1));
      let x = cx + r * Math.cos(ang);
      let y = cy + r * Math.sin(ang);
      x = Math.min(Math.max(x, 12), W - 12);
      y = Math.min(Math.max(y, 12), H - 12);
      stars.push({ x, y, tab, host: g.host, color: domainColor(g.host), groupIndex: gi, tabIndex: ti });
    });
  });
  return stars;
}

// Hit test: nearest star within STAR_RADIUS of (x,y), else null.
function starAt(stars, x, y) {
  let best = null, bestD = STAR_RADIUS;
  for (const s of stars) {
    const d = Math.hypot(s.x - x, s.y - y);
    if (d <= bestD) { best = s; bestD = d; }
  }
  return best;
}

function esc2(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

// ENGINE-END

// ---- popup wiring (browser only) ----

if (typeof document !== 'undefined') {
  const $ = id => document.getElementById(id);
  const canvas = $('sky'), ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  let stars = [], groups = [];
  let hoverStar = null;

  async function load() {
    let tabs = [];
    try {
      tabs = await chrome.tabs.query({ currentWindow: true });
    } catch { tabs = []; }
    tabs = tabs.filter(t => t && typeof t.id === 'number');
    groups = groupByDomain(tabs);
    stars = starPositions(groups, W, H);
    renderLegend();
    draw(0);
  }

  function renderLegend() {
    const lg = $('legend');
    const shown = groups.slice(0, 8);
    lg.innerHTML = shown.map(g =>
      `<span><i class="dot" style="background:${domainColor(g.host)}"></i>${esc2(g.host)} (${g.tabs.length})</span>`
    ).join('') + (groups.length > 8 ? `<span>+${groups.length - 8} more</span>` : '');
  }

  function drawStar(x, y, r, color, glow) {
    if (glow) {
      const gr = ctx.createRadialGradient(x, y, 0, x, y, r * 3);
      gr.addColorStop(0, color + '55');
      gr.addColorStop(1, color + '00');
      ctx.fillStyle = gr;
      ctx.beginPath(); ctx.arc(x, y, r * 3, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = color;
    ctx.beginPath();
    // 5-point star path
    for (let i = 0; i < 10; i++) {
      const rr = i % 2 === 0 ? r : r * 0.45;
      const a = -Math.PI / 2 + i * Math.PI / 5;
      const px = x + rr * Math.cos(a), py = y + rr * Math.sin(a);
      i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    }
    ctx.closePath(); ctx.fill();
  }

  function draw(t) {
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#07070d'; ctx.fillRect(0, 0, W, H);
    // background starfield (deterministic pseudo-random)
    ctx.fillStyle = 'rgba(255,255,255,.28)';
    for (let i = 0; i < 70; i++) {
      const bx = ((i * 97.3) % W + W) % W;
      const by = ((i * 57.7) % H + H) % H;
      ctx.fillRect(bx, by, 1.4, 1.4);
    }
    // constellation links: connect same-group stars in layout order
    const byGroup = new Map();
    for (const s of stars) {
      if (!byGroup.has(s.groupIndex)) byGroup.set(s.groupIndex, []);
      byGroup.get(s.groupIndex).push(s);
    }
    for (const list of byGroup.values()) {
      if (list.length < 2) continue;
      ctx.strokeStyle = list[0].color + '44';
      ctx.lineWidth = 1;
      ctx.beginPath();
      list.forEach((s, i) => i === 0 ? ctx.moveTo(s.x, s.y) : ctx.lineTo(s.x, s.y));
      ctx.stroke();
    }
    // stars
    for (const s of stars) {
      const tw = 3.2 + Math.sin(t / 500 + s.x + s.y) * 0.8;
      drawStar(s.x, s.y, tw, s.color, true);
    }
    // hover tooltip
    if (hoverStar) {
      const label = (hoverStar.tab.title || hoverStar.host).slice(0, 42);
      ctx.font = '11px system-ui';
      const wpx = ctx.measureText(label).width + 14;
      let lx = Math.min(Math.max(hoverStar.x - wpx / 2, 4), W - wpx - 4);
      let ly = hoverStar.y - 34;
      if (ly < 4) ly = hoverStar.y + 16;
      ctx.fillStyle = 'rgba(20,20,26,.92)';
      ctx.strokeStyle = hoverStar.color;
      ctx.lineWidth = 1;
      roundRect(lx, ly, wpx, 22, 6); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#f4f4f6'; ctx.textAlign = 'left';
      ctx.fillText(label, lx + 7, ly + 15);
    }
    requestAnimationFrame(draw);
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function canvasPos(ev) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (ev.clientX - rect.left) * (W / rect.width),
      y: (ev.clientY - rect.top) * (H / rect.height)
    };
  }

  canvas.addEventListener('mousemove', ev => {
    const p = canvasPos(ev);
    const s = starAt(stars, p.x, p.y);
    hoverStar = s;
    canvas.style.cursor = s ? 'pointer' : 'default';
  });
  canvas.addEventListener('mouseleave', () => { hoverStar = null; });
  canvas.addEventListener('click', ev => {
    const p = canvasPos(ev);
    const s = starAt(stars, p.x, p.y);
    if (s) {
      chrome.tabs.update(s.tab.id, { active: true });
      chrome.windows.update(s.tab.windowId, { focused: true });
    }
  });

  $('refresh').addEventListener('click', load);
  load();
}
