// Tab Terrarium — popup UI.
// Renders the plant as procedural SVG per growth stage, plus meters and actions.
// Game state lives in background.js (alarms keep it growing with panel closed).

'use strict';

const STAGES = ['Seed', 'Sprout', 'Sapling', 'Budding', 'Bloom'];
const svg = document.getElementById('plantSvg');
const NS = 'http://www.w3.org/2000/svg';

async function bg(msg) { return chrome.runtime.sendMessage(msg); }

function el(tag, attrs) {
  const n = document.createElementNS(NS, tag);
  for (const k in attrs) n.setAttribute(k, attrs[k]);
  return n;
}

/** Draw the pot (always present). */
function drawPot(g) {
  g.appendChild(el('rect', { x: 70, y: 138, width: 60, height: 34, rx: 6, fill: '#8a5a3b' }));
  g.appendChild(el('rect', { x: 64, y: 130, width: 72, height: 12, rx: 4, fill: '#a06b45' }));
  g.appendChild(el('rect', { x: 74, y: 134, width: 52, height: 5, rx: 2, fill: '#5d3d27' })); // soil
}

/** Draw the plant body for a given stage (0–4). */
function drawPlant(g, stage, growth) {
  const green = '#4ade80', dark = '#22c55e';
  if (stage === 0) {
    // seed resting on soil
    g.appendChild(el('ellipse', { cx: 100, cy: 128, rx: 9, ry: 6, fill: '#c9a06a' }));
    return;
  }
  const stemH = [0, 26, 48, 66, 78][stage];
  const top = 132 - stemH;
  g.appendChild(el('path', {
    d: `M100 132 C 98 ${132 - stemH / 2}, 102 ${132 - stemH / 2}, 100 ${top}`,
    stroke: dark, 'stroke-width': 5, fill: 'none', 'stroke-linecap': 'round'
  }));
  const leaf = (x, y, flip) =>
    g.appendChild(el('path', {
      d: `M100 ${y} q ${flip * 26} -14, ${flip * 40} 2 q ${flip * -22} 12, ${flip * -40} -2`,
      fill: green, opacity: 0.95
    }));
  if (stage >= 1) leaf(0, 122, 1);
  if (stage >= 2) { leaf(0, 108, -1); leaf(0, 96, 1); }
  if (stage >= 3) {
    leaf(0, 84, -1);
    // bud
    g.appendChild(el('circle', { cx: 100, cy: top - 4, r: 7, fill: '#f9a8d4' }));
  }
  if (stage >= 4) {
    // full bloom: petals around a golden center
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      g.appendChild(el('ellipse', {
        cx: 100 + Math.cos(a) * 13, cy: top - 8 + Math.sin(a) * 13,
        rx: 8, ry: 5, fill: '#f472b6',
        transform: `rotate(${(a * 180) / Math.PI} 100 ${top - 8})`
      }));
    }
    g.appendChild(el('circle', { cx: 100, cy: top - 8, r: 7, fill: '#fbbf24' }));
  }
  // water droplets when freshly watered (sparkle hint)
  if (growth % 25 < 12 && stage > 0) {
    g.appendChild(el('circle', { cx: 78, cy: 96, r: 2.5, fill: '#7dd3fc', opacity: 0.8 }));
    g.appendChild(el('circle', { cx: 122, cy: 88, r: 2, fill: '#7dd3fc', opacity: 0.6 }));
  }
}

/** Soft sun + fireflies for ambience. */
function drawAmbience(g, stage) {
  g.appendChild(el('circle', { cx: 168, cy: 34, r: 14, fill: '#fde68a', opacity: 0.85 }));
  if (stage >= 3) {
    const t = Date.now() / 900;
    for (let i = 0; i < 3; i++) {
      const x = 40 + i * 55 + Math.sin(t + i * 2) * 8;
      const y = 60 + Math.cos(t * 1.3 + i) * 10;
      g.appendChild(el('circle', { cx: x, cy: y, r: 2, fill: '#fef9c3', opacity: 0.5 + 0.4 * Math.sin(t * 2 + i) }));
    }
  }
}

function render(s) {
  svg.innerHTML = '';
  const g = el('g', {});
  svg.appendChild(g);
  drawAmbience(g, s.stage);
  drawPot(g);
  drawPlant(g, s.stage, s.growth);

  document.getElementById('stageLabel').textContent = STAGES[s.stage];
  const mood = s.water <= 10 ? '🥀 wilted — water me!'
    : s.water < 30 ? '😟 thirsty'
    : s.stage === 4 ? '🌸 thriving!'
    : '😊 happy';
  document.getElementById('moodLabel').textContent = mood;

  document.getElementById('waterFill').style.width = s.water + '%';
  document.getElementById('growthFill').style.width = s.growth + '%';
  document.getElementById('waterNum').textContent = Math.round(s.water);
  document.getElementById('growthNum').textContent = Math.round(s.growth);
  document.getElementById('statWaters').textContent = s.stats.waters;
  document.getElementById('statFeeds').textContent = s.stats.feeds;
  const days = Math.floor((Date.now() - s.stats.plantedAt) / 86400000);
  document.getElementById('statAge').textContent = days + 'd';
}

const toast = document.getElementById('toast');
let toastTimer = null;
function showToast(msg) {
  toast.textContent = msg;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.textContent = ''; }, 2600);
}

document.getElementById('waterBtn').addEventListener('click', async () => {
  const r = await bg({ type: 'water' });
  render(r.state);
  showToast('💧 watered');
});
document.getElementById('feedBtn').addEventListener('click', async () => {
  const r = await bg({ type: 'feed' });
  if (r.ok) { render(r.state); showToast('🌱 fed — growth boost!'); }
  else showToast(r.reason);
});
document.getElementById('replantBtn').addEventListener('click', async () => {
  if (!confirm('Start over with a new seed?')) return;
  const r = await bg({ type: 'replant' });
  render(r.state);
  showToast('🌰 a new seed is planted');
});

(async () => render(await bg({ type: 'getState' })))();
setInterval(async () => render(await bg({ type: 'getState' })), 10000);
