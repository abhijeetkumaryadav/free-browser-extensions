'use strict';
/* ============================================================
 * Server Rack Visualizer — cosmetic canvas doodle of your sites.
 * Fully local. No network. Nothing measures servers or domains.
 * ============================================================ */

// ENGINE-START — pure functions, unit-tested headlessly.
// All layout numbers in canvas CSS pixels (canvas is 324 x dynamic).

const MAX_SITES = 50;
const RACK = {
  x: 62,            // left edge of the rack frame
  width: 200,       // rack frame width
  topPad: 14,       // padding above first unit
  unitH: 44,        // height of one rack unit
  unitGap: 6,       // gap between units
  emptyH: 56        // canvas height when there are no sites
};

function cleanUrl(raw) {
  if (typeof raw !== 'string') return null;
  const s = raw.trim();
  if (!s) return null;
  let u = s;
  if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(u)) u = 'https://' + u;
  try {
    const p = new URL(u);
    if (p.protocol !== 'http:' && p.protocol !== 'https:') return null;
    return p.href;
  } catch { return null; }
}

function makeSite(name, url) {
  const n = typeof name === 'string' ? name.trim() : '';
  const u = cleanUrl(url);
  if (!n || n.length > 40 || !u) return null;
  return {
    id: 's' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
    name: n, url: u, addedAt: Date.now()
  };
}

// Lay out rack units vertically. Returns {units:[{site,y,h}], height}.
function rackLayout(sites) {
  const list = Array.isArray(sites) ? sites : [];
  const units = [];
  let y = RACK.topPad;
  for (const site of list) {
    units.push({ site, y, h: RACK.unitH });
    y += RACK.unitH + RACK.unitGap;
  }
  const height = list.length ? y - RACK.unitGap + RACK.topPad : RACK.emptyH;
  return { units, height };
}

// Hit test: which site (if any) is at canvas y coordinate?
function siteAtY(layout, y) {
  if (!layout || typeof y !== 'number') return null;
  for (const u of layout.units) {
    if (y >= u.y && y <= u.y + u.h) return u.site;
  }
  return null;
}

// LED blink phase for a unit: deterministic wobble from id + time.
function ledOn(siteId, ledIdx, t) {
  let h = 0;
  const s = String(siteId);
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  const phase = ((h + ledIdx * 97) % 2000) / 2000 * Math.PI * 2;
  return Math.sin(t / 420 + phase) > 0;
}

// Escape for HTML injection safety in the list UI.
function esc(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

// ENGINE-END

// ---- popup wiring (browser only) ----

if (typeof document !== 'undefined') {
  const $ = id => document.getElementById(id);
  const canvas = $('rack'), ctx = canvas.getContext('2d');
  let sites = [];
  let layout = rackLayout([]);

  async function load() {
    try {
      const r = await chrome.storage.local.get('sites');
      sites = Array.isArray(r.sites) ? r.sites.slice(0, MAX_SITES) : [];
    } catch { sites = []; }
    renderList(); draw(0);
  }
  async function save() {
    try { await chrome.storage.local.set({ sites }); } catch {}
  }

  function renderList() {
    const ul = $('siteList');
    if (!sites.length) { ul.innerHTML = '<li class="empty">No sites yet — add one above.</li>'; return; }
    ul.innerHTML = sites.map(s =>
      `<li><span class="nm">${esc(s.name)}</span><span class="url">${esc(hostOf(s.url))}</span><button data-del="${esc(s.id)}" title="Remove">×</button></li>`
    ).join('');
    ul.querySelectorAll('button[data-del]').forEach(b =>
      b.addEventListener('click', async () => {
        sites = sites.filter(s => s.id !== b.dataset.del);
        await save(); renderList(); layout = rackLayout(sites); fitCanvas();
      }));
  }

  function hostOf(u) { try { return new URL(u).host; } catch { return u; } }

  function fitCanvas() {
    layout = rackLayout(sites);
    canvas.height = Math.min(600, layout.height);
    canvas.style.height = Math.min(600, layout.height) + 'px';
  }

  // Draw the rack frame + units with blinking LEDs.
  function draw(t) {
    fitCanvasOnlyHeight();
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#0a0a0e';
    ctx.fillRect(0, 0, W, H);
    // rack frame
    ctx.strokeStyle = 'rgba(255,255,255,.14)';
    ctx.lineWidth = 3;
    roundRect(RACK.x - 8, 4, RACK.width + 16, H - 8, 8);
    ctx.stroke();
    if (!layout.units.length) {
      ctx.fillStyle = '#6b6b7a'; ctx.font = '12px system-ui'; ctx.textAlign = 'center';
      ctx.fillText('Rack is empty — add a site', W / 2, H / 2);
    } else {
      layout.units.forEach((u, i) => {
        const y = u.y;
        // unit body
        ctx.fillStyle = '#17171e';
        roundRect(RACK.x, y, RACK.width, u.h, 5); ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,.1)'; ctx.lineWidth = 1;
        roundRect(RACK.x, y, RACK.width, u.h, 5); ctx.stroke();
        // vent lines
        ctx.strokeStyle = 'rgba(255,255,255,.06)';
        for (let v = 0; v < 4; v++) {
          ctx.beginPath();
          ctx.moveTo(RACK.x + 34 + v * 9, y + 8);
          ctx.lineTo(RACK.x + 34 + v * 9, y + u.h - 8);
          ctx.stroke();
        }
        // label
        ctx.fillStyle = '#e7e7ee'; ctx.font = '11px system-ui'; ctx.textAlign = 'left';
        const label = u.site.name.length > 20 ? u.site.name.slice(0, 19) + '…' : u.site.name;
        ctx.fillText((i + 1) + ' · ' + label, RACK.x + 70, y + u.h / 2 + 4);
        // LEDs
        for (let l = 0; l < 3; l++) {
          const on = ledOn(u.site.id, l, t);
          ctx.fillStyle = on ? (l === 2 ? '#10b981' : '#34d399') : 'rgba(16,185,129,.18)';
          ctx.beginPath();
          ctx.arc(RACK.x + 14 + l * 10, y + u.h / 2, 3.4, 0, Math.PI * 2);
          ctx.fill();
        }
      });
    }
    requestAnimationFrame(draw);
  }

  function fitCanvasOnlyHeight() {
    // recompute only when the site count changed (cheap guard)
    if (layout.units.length !== sites.length) {
      layout = rackLayout(sites);
      canvas.height = Math.min(600, layout.height);
      canvas.style.height = Math.min(600, layout.height) + 'px';
    }
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

  canvas.addEventListener('click', ev => {
    const rect = canvas.getBoundingClientRect();
    const scaleY = canvas.height / rect.height;
    const y = (ev.clientY - rect.top) * scaleY;
    const site = siteAtY(layout, y);
    if (site) chrome.tabs.create({ url: site.url });
  });

  $('add').addEventListener('click', async () => {
    const err = $('addErr');
    err.hidden = true;
    if (sites.length >= MAX_SITES) {
      err.textContent = 'Rack is full (50 sites max).';
      err.hidden = false; return;
    }
    const site = makeSite($('inName').value, $('inUrl').value);
    if (!site) {
      err.textContent = 'Enter a name and a valid http(s) URL.';
      err.hidden = false; return;
    }
    sites.push(site);
    $('inName').value = ''; $('inUrl').value = '';
    await save(); renderList(); layout = rackLayout(sites); fitCanvas();
  });

  load();
}
