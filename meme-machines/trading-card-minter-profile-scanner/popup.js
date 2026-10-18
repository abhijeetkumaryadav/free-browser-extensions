/* CardForge — Trading Card Minter
 * Builds a canvas-rendered trading card from user input, original bundled
 * PIL-generated art, and a rarity frame. Download via anchor (no downloads
 * permission needed). All data stays on-device.
 */

const ART_STYLES = [
  { id: 'cosmic', label: 'Cosmic', file: 'art/cosmic.png' },
  { id: 'forest', label: 'Forest', file: 'art/forest.png' },
  { id: 'ember',  label: 'Ember',  file: 'art/ember.png' },
];
const RARITIES = [
  { id: 'common',    label: 'Common',    color: '#9ca3af', foil: false },
  { id: 'rare',      label: 'Rare',      color: '#38bdf8', foil: false },
  { id: 'epic',      label: 'Epic',      color: '#a855f7', foil: true  },
  { id: 'legendary', label: 'Legendary', color: '#f5b301', foil: true  },
];

const $ = (id) => document.getElementById(id);
const canvas = $('cardCanvas'), ctx = canvas.getContext('2d');
const nameInput = $('nameInput'), titleInput = $('titleInput'), flavorInput = $('flavorInput');
const hpInput = $('hpInput'), atkInput = $('atkInput'), defInput = $('defInput');
const artRow = $('artRow'), rarityRow = $('rarityRow');

let artStyle = 'cosmic';
let rarityId = 'rare';
let artImages = {};   // style id -> HTMLImageElement

/* ---------- state ---------- */
async function loadState() {
  const d = await chrome.storage.local.get(['card']);
  if (d.card && typeof d.card === 'object') {
    nameInput.value = d.card.name || '';
    titleInput.value = d.card.title || '';
    flavorInput.value = d.card.flavor || '';
    hpInput.value = d.card.hp ?? 80;
    atkInput.value = d.card.atk ?? 60;
    defInput.value = d.card.def ?? 55;
    if (ART_STYLES.some((a) => a.id === d.card.art)) artStyle = d.card.art;
    if (RARITIES.some((r) => r.id === d.card.rarity)) rarityId = d.card.rarity;
  }
}
async function saveState() {
  await chrome.storage.local.set({ card: {
    name: nameInput.value, title: titleInput.value, flavor: flavorInput.value,
    hp: hpInput.value, atk: atkInput.value, def: defInput.value,
    art: artStyle, rarity: rarityId,
  }});
}

/* ---------- art + rarity pickers ---------- */
function renderPickers() {
  artRow.innerHTML = '';
  for (const a of ART_STYLES) {
    const b = document.createElement('button');
    b.className = 'art-pick' + (a.id === artStyle ? ' selected' : '');
    b.title = a.label;
    const img = document.createElement('img');
    img.src = a.file;
    img.alt = a.label + ' art';
    b.appendChild(img);
    b.addEventListener('click', () => { artStyle = a.id; renderPickers(); drawCard(); saveState(); });
    artRow.appendChild(b);
  }
  rarityRow.innerHTML = '';
  for (const r of RARITIES) {
    const b = document.createElement('button');
    b.className = 'rarity-pick' + (r.id === rarityId ? ' selected' : '');
    b.style.borderColor = r.id === rarityId ? r.color : '';
    const dot = document.createElement('span');
    dot.className = 'dot';
    dot.style.background = r.color;
    b.appendChild(dot);
    b.appendChild(document.createTextNode(r.label));
    b.addEventListener('click', () => { rarityId = r.id; renderPickers(); drawCard(); saveState(); });
    rarityRow.appendChild(b);
  }
}

function loadArtImages() {
  return Promise.all(ART_STYLES.map((a) => new Promise((resolve) => {
    const img = new Image();
    img.onload = () => { artImages[a.id] = img; resolve(); };
    img.onerror = () => resolve();  // drawCard tolerates a missing image
    img.src = a.file;
  })));
}

/* ---------- card renderer ---------- */
function rarity() { return RARITIES.find((r) => r.id === rarityId) || RARITIES[0]; }

function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function fitText(text, maxWidth, baseSize, weight) {
  let size = baseSize;
  ctx.font = `${weight} ${size}px -apple-system, "Segoe UI", Roboto, sans-serif`;
  while (ctx.measureText(text).width > maxWidth && size > 10) {
    size -= 1;
    ctx.font = `${weight} ${size}px -apple-system, "Segoe UI", Roboto, sans-serif`;
  }
  return size;
}

function drawCard() {
  const W = canvas.width, H = canvas.height;
  const r = rarity();

  // Background: deep dark.
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#17171f');
  bg.addColorStop(1, '#0c0c12');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Outer rarity frame.
  ctx.lineWidth = 14;
  ctx.strokeStyle = r.color;
  roundRect(14, 14, W - 28, H - 28, 26);
  ctx.stroke();

  // Foil shimmer for epic/legendary: diagonal translucent band.
  if (r.foil) {
    ctx.save();
    roundRect(22, 22, W - 44, H - 44, 20);
    ctx.clip();
    const sheen = ctx.createLinearGradient(0, 0, W, H);
    sheen.addColorStop(0.42, 'rgba(255,255,255,0)');
    sheen.addColorStop(0.5, 'rgba(255,255,255,0.10)');
    sheen.addColorStop(0.58, 'rgba(255,255,255,0)');
    ctx.fillStyle = sheen;
    ctx.fillRect(22, 22, W - 44, H - 44);
    ctx.restore();
  }

  // Art window.
  const ax = 44, ay = 108, aw = W - 88, ah = 360;
  const art = artImages[artStyle];
  if (art) {
    ctx.save();
    roundRect(ax, ay, aw, ah, 14);
    ctx.clip();
    // cover-fit the square art into the window
    const scale = Math.max(aw / art.width, ah / art.height);
    const dw = art.width * scale, dh = art.height * scale;
    ctx.drawImage(art, ax + (aw - dw) / 2, ay + (ah - dh) / 2, dw, dh);
    ctx.restore();
  } else {
    ctx.fillStyle = '#1c1c26';
    roundRect(ax, ay, aw, ah, 14);
    ctx.fill();
  }
  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgba(255,255,255,0.14)';
  roundRect(ax, ay, aw, ah, 14);
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.fillStyle = '#f4f4f6';

  // Name plate.
  const name = (nameInput.value || 'Unnamed Hero').slice(0, 28);
  ctx.font = '700 40px -apple-system, "Segoe UI", Roboto, sans-serif';
  fitText(name, W - 120, 40, 700);
  ctx.fillText(name, W / 2, 78);

  // Title / epithet.
  const title = (titleInput.value || 'Wanderer of the Web').slice(0, 40);
  ctx.fillStyle = r.color;
  ctx.font = '600 22px -apple-system, "Segoe UI", Roboto, sans-serif';
  fitText(title, W - 140, 22, 600);
  ctx.fillText(title, W / 2, ay + ah + 44);
  ctx.fillStyle = '#f4f4f6';

  // Stats row: HP / ATK / DEF.
  const stats = [
    ['HP', clampNum(hpInput.value, 999)],
    ['ATK', clampNum(atkInput.value, 999)],
    ['DEF', clampNum(defInput.value, 999)],
  ];
  const sy = ay + ah + 84, sw = (W - 140) / 3;
  stats.forEach(([label, val], i) => {
    const cxp = 70 + sw * i + sw / 2;
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    roundRect(70 + sw * i, sy, sw - 12, 96, 12);
    ctx.fill();
    ctx.fillStyle = '#9a9aa6';
    ctx.font = '600 18px -apple-system, "Segoe UI", Roboto, sans-serif';
    ctx.fillText(label, cxp - 6, sy + 32);
    ctx.fillStyle = '#f4f4f6';
    ctx.font = '800 34px -apple-system, "Segoe UI", Roboto, sans-serif';
    ctx.fillText(String(val), cxp - 6, sy + 72);
  });

  // Flavor text.
  const flavor = (flavorInput.value || '“Every legend starts with a single click.”').slice(0, 80);
  ctx.fillStyle = '#b9b9c4';
  ctx.font = 'italic 20px -apple-system, "Segoe UI", Georgia, serif';
  wrapText(flavor, W / 2, sy + 140, W - 140, 28);

  // Rarity gem + label at bottom.
  const by = H - 56;
  ctx.beginPath();
  ctx.arc(W / 2 - 90, by - 8, 10, 0, Math.PI * 2);
  ctx.fillStyle = r.color;
  ctx.fill();
  ctx.fillStyle = '#e6e6ec';
  ctx.font = '700 20px -apple-system, "Segoe UI", Roboto, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(r.label.toUpperCase(), W / 2 - 68, by);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#6d6d78';
  ctx.font = '500 15px -apple-system, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('CARDFORGE · ORIGINAL ART', W / 2, H - 30);
}

function clampNum(v, max) {
  const n = parseInt(v, 10);
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(max, n));
}

function wrapText(text, x, y, maxWidth, lineHeight) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (ctx.measureText(test).width > maxWidth && line) { lines.push(line); line = w; }
    else line = test;
  }
  if (line) lines.push(line);
  lines.slice(0, 3).forEach((l, i) => ctx.fillText(l, x, y + i * lineHeight));
}

/* ---------- actions ---------- */
async function pullFromTab() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.title) {
      nameInput.value = tab.title.slice(0, 28);
      drawCard();
      saveState();
    }
  } catch (e) { /* permission denied */ }
}

function randomizeStats() {
  hpInput.value = 40 + Math.floor(Math.random() * 160);
  atkInput.value = 20 + Math.floor(Math.random() * 160);
  defInput.value = 20 + Math.floor(Math.random() * 140);
  drawCard();
  saveState();
}

function downloadCard() {
  const name = (nameInput.value || 'card').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'card';
  const a = document.createElement('a');
  a.href = canvas.toDataURL('image/png');
  a.download = `cardforge-${name}.png`;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/* ---------- init ---------- */
[nameInput, titleInput, flavorInput, hpInput, atkInput, defInput].forEach((el) => {
  el.addEventListener('input', () => { drawCard(); saveState(); });
});
$('tabBtn').addEventListener('click', pullFromTab);
$('diceBtn').addEventListener('click', randomizeStats);
$('downloadBtn').addEventListener('click', downloadCard);

(async () => {
  await loadState();
  renderPickers();
  await loadArtImages();
  drawCard();
})();
