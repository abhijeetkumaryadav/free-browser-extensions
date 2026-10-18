/* ===== Calisthenics Progression Tree — interactive unlock grid =====
   Honest scope: tracks YOUR progress. Not coaching — progress at your own pace. */

'use strict';

// ---------- Data ----------
// PATHS-START
/** Progression paths, ordered easiest → hardest. */
const PATHS = [
  {
    id: 'push',
    name: 'Push',
    icon: '<path d="M12 5v14"/><path d="m5 12 7 7 7-7"/>',
    steps: [
      'Wall Push-up', 'Incline Push-up', 'Knee Push-up', 'Push-up',
      'Wide Push-up', 'Diamond Push-up', 'Archer Push-up', 'One-Arm Push-up'
    ]
  },
  {
    id: 'pull',
    name: 'Pull',
    icon: '<path d="M12 19V5"/><path d="m5 12 7-7 7 7"/>',
    steps: [
      'Dead Hang', 'Scapular Pull', 'Negative Pull-up', 'Band-Assisted Pull-up',
      'Pull-up', 'Chest-to-Bar', 'Weighted Pull-up', 'Muscle-Up'
    ]
  },
  {
    id: 'legs',
    name: 'Legs',
    icon: '<path d="M5 12h14"/><path d="M12 5v14"/>',
    steps: [
      'Assisted Squat', 'Bodyweight Squat', 'Split Squat', 'Bulgarian Split Squat',
      'Shrimp Squat (assisted)', 'Pistol Squat (assisted)', 'Pistol Squat', 'Weighted Pistol'
    ]
  },
  {
    id: 'core',
    name: 'Core',
    icon: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/>',
    steps: [
      'Dead Bug', 'Knee Tuck', 'Lying Leg Raise', 'Hanging Knee Raise',
      'Hanging Leg Raise', 'Toes to Bar', 'L-Sit (tuck)', 'Full L-Sit'
    ]
  }
];
// PATHS-END

// ---------- Engine (pure logic, testable) ----------
// ENGINE-START
/**
 * Progress summary for a path.
 * @param {string[]} steps
 * @param {Set<string>} unlockedIds ids like "push-3"
 * @param {string} pathId
 * @returns {{done:number, total:number, pct:number}}
 */
function pathProgress(steps, unlockedIds, pathId) {
  let done = 0;
  steps.forEach((_, i) => { if (unlockedIds.has(pathId + '-' + i)) done++; });
  const total = steps.length;
  return { done, total, pct: total ? Math.round((done / total) * 100) : 0 };
}

/** Toggle an id in a Set; returns a NEW Set (no mutation). */
function toggleId(unlockedIds, id) {
  const next = new Set(unlockedIds);
  if (next.has(id)) next.delete(id); else next.add(id);
  return next;
}
// ENGINE-END

// ---------- UI ----------
const $ = (sel) => document.querySelector(sel);

let unlocked = new Set();   // ids like "push-3"
let activePath = 'push';

async function load() {
  const r = await chrome.storage.local.get(['calUnlocked', 'calActivePath']);
  unlocked = new Set(r.calUnlocked || []);
  if (r.calActivePath && PATHS.some(p => p.id === r.calActivePath)) activePath = r.calActivePath;
}

async function save() {
  await chrome.storage.local.set({
    calUnlocked: [...unlocked],
    calActivePath: activePath
  });
}

const CHECK_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>';

function renderTabs() {
  const nav = $('#tabs');
  nav.innerHTML = '';
  for (const p of PATHS) {
    const b = document.createElement('button');
    b.className = 'tab' + (p.id === activePath ? ' active' : '');
    b.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${p.icon}</svg><span>${p.name}</span>`;
    b.addEventListener('click', async () => {
      activePath = p.id;
      await save();
      render();
    });
    nav.appendChild(b);
  }
}

function renderGrid() {
  const path = PATHS.find(p => p.id === activePath);
  $('#path-name').textContent = path.name + ' path';
  const prog = pathProgress(path.steps, unlocked, path.id);
  $('#path-count').textContent = `${prog.done} / ${prog.total} unlocked`;
  $('#progress-fill').style.width = prog.pct + '%';

  const grid = $('#grid');
  grid.innerHTML = '';
  path.steps.forEach((name, i) => {
    const id = `${path.id}-${i}`;
    const isUp = unlocked.has(id);
    const card = document.createElement('div');
    card.className = 'step' + (isUp ? ' unlocked' : '');
    card.setAttribute('role', 'button');
    card.setAttribute('tabindex', '0');
    card.title = isUp ? 'Click to unmark' : 'Click to mark unlocked';
    card.innerHTML =
      '<span class="lvl">Level ' + (i + 1) + '</span>' +
      '<span class="name"></span>' +
      '<span class="check">' + CHECK_SVG + '</span>';
    card.querySelector('.name').textContent = name;
    const toggle = async () => {
      unlocked = toggleId(unlocked, id);
      await save();
      render();
    };
    card.addEventListener('click', toggle);
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); }
    });
    grid.appendChild(card);
  });
}

function render() {
  renderTabs();
  renderGrid();
}

// ---------- Init ----------
document.addEventListener('DOMContentLoaded', async () => {
  await load();
  render();
  $('#reset-path').addEventListener('click', async () => {
    const prefix = activePath + '-';
    unlocked = new Set([...unlocked].filter(id => !id.startsWith(prefix)));
    await save();
    render();
  });
});
