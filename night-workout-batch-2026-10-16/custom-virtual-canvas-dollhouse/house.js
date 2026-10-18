// Canvas Dollhouse — interactive room decorator.
// Rooms keep their own wall color, light state and furniture layout in
// chrome.storage.local. Furniture is draggable; layouts persist per room.

'use strict';

// --- furniture catalog: simple flat SVG drawings, no external assets ---
const FURNITURE = {
  sofa:   { name: 'Sofa', w: 110, h: 60, rooms: ['living'],
    svg: `<svg viewBox="0 0 110 60"><rect x="8" y="18" width="94" height="30" rx="8" fill="#7c5cd6"/><rect x="2" y="10" width="16" height="34" rx="7" fill="#6a4fc4"/><rect x="92" y="10" width="16" height="34" rx="7" fill="#6a4fc4"/><rect x="8" y="48" width="10" height="8" fill="#4a3a2a"/><rect x="92" y="48" width="10" height="8" fill="#4a3a2a"/></svg>` },
  armchair: { name: 'Armchair', w: 62, h: 58, rooms: ['living', 'bedroom'],
    svg: `<svg viewBox="0 0 62 58"><rect x="12" y="16" width="38" height="30" rx="8" fill="#e07856"/><rect x="6" y="10" width="12" height="32" rx="6" fill="#c96444"/><rect x="44" y="10" width="12" height="32" rx="6" fill="#c96444"/></svg>` },
  table:  { name: 'Coffee table', w: 90, h: 40, rooms: ['living'],
    svg: `<svg viewBox="0 0 90 40"><rect x="4" y="8" width="82" height="12" rx="4" fill="#8a5a33"/><rect x="10" y="20" width="6" height="16" fill="#6e4525"/><rect x="74" y="20" width="6" height="16" fill="#6e4525"/></svg>` },
  lamp:   { name: 'Floor lamp', w: 40, h: 90, rooms: ['living', 'bedroom'],
    svg: `<svg viewBox="0 0 40 90"><rect x="18" y="30" width="4" height="54" fill="#555"/><ellipse cx="20" cy="86" rx="12" ry="3" fill="#444"/><path d="M8 30 L32 30 L26 8 L14 8 Z" fill="#ffd166"/></svg>` },
  plant:  { name: 'Plant', w: 44, h: 70, rooms: ['living', 'bedroom', 'kitchen'],
    svg: `<svg viewBox="0 0 44 70"><path d="M12 62 L32 62 L28 44 L16 44 Z" fill="#b5654d"/><path d="M22 44 C10 34 8 20 14 8 C22 16 26 28 22 44 Z" fill="#3fa34d"/><path d="M22 44 C34 34 36 20 30 8 C22 16 18 28 22 44 Z" fill="#2e7d3a"/></svg>` },
  tv:     { name: 'TV', w: 96, h: 62, rooms: ['living', 'bedroom'],
    svg: `<svg viewBox="0 0 96 62"><rect x="6" y="4" width="84" height="46" rx="4" fill="#1c1c22"/><rect x="12" y="10" width="72" height="34" rx="2" fill="#2b3a67"/><rect x="40" y="50" width="16" height="8" fill="#333"/><rect x="28" y="58" width="40" height="3" fill="#333"/></svg>` },
  rug:    { name: 'Rug', w: 130, h: 60, rooms: ['living', 'bedroom'],
    svg: `<svg viewBox="0 0 130 60"><ellipse cx="65" cy="30" rx="62" ry="27" fill="#a8443f"/><ellipse cx="65" cy="30" rx="46" ry="19" fill="#c96f4a"/><ellipse cx="65" cy="30" rx="30" ry="12" fill="#a8443f"/></svg>` },
  bed:    { name: 'Bed', w: 120, h: 80, rooms: ['bedroom'],
    svg: `<svg viewBox="0 0 120 80"><rect x="4" y="20" width="14" height="56" rx="4" fill="#6e4525"/><rect x="18" y="34" width="98" height="34" rx="6" fill="#8a5a33"/><rect x="22" y="26" width="90" height="16" rx="6" fill="#e8e4da"/><rect x="26" y="28" width="26" height="12" rx="4" fill="#c084fc"/></svg>` },
  wardrobe: { name: 'Wardrobe', w: 70, h: 96, rooms: ['bedroom'],
    svg: `<svg viewBox="0 0 70 96"><rect x="6" y="4" width="58" height="88" rx="4" fill="#7a4f2c"/><line x1="35" y1="10" x2="35" y2="86" stroke="#5c3a1f" stroke-width="3"/><circle cx="30" cy="50" r="2.5" fill="#ddd"/><circle cx="40" cy="50" r="2.5" fill="#ddd"/></svg>` },
  desk:   { name: 'Desk', w: 96, h: 56, rooms: ['bedroom'],
    svg: `<svg viewBox="0 0 96 56"><rect x="4" y="10" width="88" height="10" rx="3" fill="#8a5a33"/><rect x="10" y="20" width="7" height="32" fill="#6e4525"/><rect x="79" y="20" width="7" height="32" fill="#6e4525"/><rect x="34" y="2" width="28" height="18" rx="2" fill="#2b3a67"/></svg>` },
  fridge: { name: 'Fridge', w: 60, h: 100, rooms: ['kitchen'],
    svg: `<svg viewBox="0 0 60 100"><rect x="6" y="4" width="48" height="92" rx="6" fill="#cfd6dd"/><line x1="8" y1="40" x2="52" y2="40" stroke="#9aa3ab" stroke-width="2"/><rect x="44" y="12" width="4" height="16" rx="2" fill="#7a828a"/><rect x="44" y="48" width="4" height="16" rx="2" fill="#7a828a"/></svg>` },
  stove:  { name: 'Stove', w: 76, h: 70, rooms: ['kitchen'],
    svg: `<svg viewBox="0 0 76 70"><rect x="4" y="10" width="68" height="56" rx="4" fill="#3a3a42"/><rect x="10" y="4" width="56" height="12" rx="3" fill="#55555e"/><circle cx="24" cy="32" r="8" fill="#222"/><circle cx="52" cy="32" r="8" fill="#222"/><circle cx="24" cy="52" r="8" fill="#222"/><circle cx="52" cy="52" r="8" fill="#222"/></svg>` },
  sink:   { name: 'Sink', w: 80, h: 56, rooms: ['kitchen'],
    svg: `<svg viewBox="0 0 80 56"><rect x="4" y="14" width="72" height="38" rx="6" fill="#9fb3c8"/><ellipse cx="40" cy="30" rx="24" ry="10" fill="#6e8296"/><path d="M36 14 q4 -10 8 0" stroke="#cfd6dd" stroke-width="4" fill="none"/></svg>` },
};

const ROOMS = ['living', 'bedroom', 'kitchen'];
const DEFAULTS = {
  living:  { wall: '#3a3f5c', lights: true,  items: [] },
  bedroom: { wall: '#4c3a5e', lights: true,  items: [] },
  kitchen: { wall: '#2f4f4a', lights: true,  items: [] },
};

let currentRoom = 'living';
let house = null;

const stage = document.getElementById('stage');
const dim = document.getElementById('dim');
const palette = document.getElementById('palette');
const wallColor = document.getElementById('wallColor');
const lightsBtn = document.getElementById('lightsBtn');

async function load() {
  const s = await chrome.storage.local.get({ dollhouse: null });
  house = s.dollhouse || structuredClone(DEFAULTS);
  for (const r of ROOMS) house[r] = { ...structuredClone(DEFAULTS[r]), ...(house[r] || {}) };
}
async function save() {
  await chrome.storage.local.set({ dollhouse: house });
}

// --- rendering ---
function renderRoom() {
  const room = house[currentRoom];
  stage.style.background = room.wall;
  wallColor.value = room.wall;
  lightsBtn.setAttribute('aria-pressed', String(room.lights));
  dim.classList.toggle('off', !room.lights);
  stage.querySelectorAll('.item').forEach(el => el.remove());
  room.items.forEach(it => addItemEl(it));
  renderPalette();
}

function renderPalette() {
  palette.innerHTML = '';
  Object.entries(FURNITURE)
    .filter(([, f]) => f.rooms.includes(currentRoom))
    .forEach(([id, f]) => {
      const b = document.createElement('button');
      b.className = 'furn-btn';
      b.innerHTML = `${f.svg}<span>${f.name}</span>`;
      b.title = 'Add ' + f.name;
      b.addEventListener('click', () => {
        const it = { uid: 'i' + Date.now() + Math.random().toString(16).slice(2), id, x: 40, y: 40 };
        house[currentRoom].items.push(it);
        addItemEl(it);
        save();
      });
      palette.appendChild(b);
    });
}

function addItemEl(it) {
  const f = FURNITURE[it.id];
  if (!f) return;
  const el = document.createElement('div');
  el.className = 'item';
  el.style.left = it.x + 'px';
  el.style.top = it.y + 'px';
  el.style.width = f.w + 'px';
  el.style.height = f.h + 'px';
  el.innerHTML = `${f.svg}<button class="del" title="Remove">✕</button>`;
  el.querySelector('.del').addEventListener('click', (e) => {
    e.stopPropagation();
    house[currentRoom].items = house[currentRoom].items.filter(i => i.uid !== it.uid);
    el.remove();
    save();
  });
  el.addEventListener('pointerdown', (e) => {
    if (e.target.classList.contains('del')) return;
    document.querySelectorAll('.item.selected').forEach(x => x.classList.remove('selected'));
    el.classList.add('selected');
    el.setPointerCapture(e.pointerId);
    const move = (ev) => {
      const r = stage.getBoundingClientRect();
      it.x = Math.max(0, Math.min(r.width - f.w, ev.clientX - r.left - offX));
      it.y = Math.max(0, Math.min(r.height - f.h, ev.clientY - r.top - offY));
      el.style.left = it.x + 'px';
      el.style.top = it.y + 'px';
    };
    const offX = e.clientX - stage.getBoundingClientRect().left - it.x;
    const offY = e.clientY - stage.getBoundingClientRect().top - it.y;
    const up = () => {
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      save();
    };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
  });
  stage.appendChild(el);
}

// --- wiring ---
document.querySelectorAll('.room-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.room-tab').forEach(t => {
      t.classList.remove('active');
      t.setAttribute('aria-selected', 'false');
    });
    tab.classList.add('active');
    tab.setAttribute('aria-selected', 'true');
    currentRoom = tab.dataset.room;
    renderRoom();
  });
});

wallColor.addEventListener('input', () => {
  house[currentRoom].wall = wallColor.value;
  stage.style.background = wallColor.value;
  save();
});

lightsBtn.addEventListener('click', () => {
  const room = house[currentRoom];
  room.lights = !room.lights;
  lightsBtn.setAttribute('aria-pressed', String(room.lights));
  dim.classList.toggle('off', !room.lights);
  save();
});

document.getElementById('resetBtn').addEventListener('click', () => {
  house[currentRoom] = structuredClone(DEFAULTS[currentRoom]);
  renderRoom();
  save();
});

stage.addEventListener('pointerdown', (e) => {
  if (e.target === stage) document.querySelectorAll('.item.selected').forEach(x => x.classList.remove('selected'));
});

load().then(renderRoom);
