'use strict';
/* RPG Gym Logger — gamified workout logbook.
 * XP rules: each logged set earns XP = 10 + floor(reps/2), plus a weight bonus
 * floor(weightKg/10). Level thresholds grow quadratically: xpForLevel(n) =
 * 100 * n * (n - 1) / 2  (level 1 needs 0, level 2 needs 100, level 3 needs 300…).
 * Stats: the chosen stat (STR/END/AGI) gains +1 per set; the exercise's stat
 * mapping is stored so per-exercise totals can grow later. All local. */

// ---------------------------------------------------------------- engine
// ENGINE-START
/** XP awarded for one set. */
function xpForSet(reps, weightKg) {
  const r = Math.max(0, Math.floor(Number(reps) || 0));
  const w = Math.max(0, Number(weightKg) || 0);
  return 10 + Math.floor(r / 2) + Math.floor(w / 10);
}

/** Cumulative XP required to REACH level n (n >= 1). Level 1 = 0. */
function xpForLevel(n) {
  n = Math.max(1, Math.floor(n));
  return 100 * n * (n - 1) / 2;
}

/** Level for a total XP amount. */
function levelForXp(xp) {
  xp = Math.max(0, Number(xp) || 0);
  let lvl = 1;
  while (xpForLevel(lvl + 1) <= xp) lvl++;
  return lvl;
}

/** Fraction (0..1) of progress from level lvl to lvl+1. */
function levelProgress(xp, lvl) {
  const lo = xpForLevel(lvl), hi = xpForLevel(lvl + 1);
  if (hi <= lo) return 1;
  return Math.min(1, Math.max(0, (xp - lo) / (hi - lo)));
}

/** Badge definitions: id, label, icon key, predicate(state). */
const BADGES = [
  { id: 'first',   label: 'First Set',    check: (s) => s.sets.length >= 1 },
  { id: 'ten',     label: '10 Sets',      check: (s) => s.sets.length >= 10 },
  { id: 'fifty',   label: '50 Sets',      check: (s) => s.sets.length >= 50 },
  { id: 'hundred', label: '100 Sets',     check: (s) => s.sets.length >= 100 },
  { id: 'lvl3',    label: 'Level 3',      check: (s) => levelForXp(s.xp) >= 3 },
  { id: 'lvl5',    label: 'Level 5',      check: (s) => levelForXp(s.xp) >= 5 },
  { id: 'balanced',label: 'Balanced',     check: (s) => s.stats.STR >= 5 && s.stats.END >= 5 && s.stats.AGI >= 5 },
  { id: 'ton',     label: '10t Volume',   check: (s) => totalVolume(s.sets) >= 10000 },
];

/** Total volume (kg × reps) across sets. */
function totalVolume(sets) {
  return sets.reduce((t, s) => t + (Number(s.w) || 0) * (Number(s.r) || 0), 0);
}
// ENGINE-END

const $ = (id) => document.getElementById(id);
const els = {
  avatar: $('avatar'), lvlPill: $('lvlPill'), xpFill: $('xpFill'), xpLabel: $('xpLabel'),
  stStr: $('stStr'), stEnd: $('stEnd'), stAgi: $('stAgi'),
  inEx: $('inEx'), inW: $('inW'), inR: $('inR'), inStat: $('inStat'),
  btnLog: $('btnLog'), levelMsg: $('levelMsg'),
  badges: $('badges'), hist: $('hist'), emptyHist: $('emptyHist'), btnClear: $('btnClear'),
};

const KEY = 'rpgStateV1';
let state = { xp: 0, stats: { STR: 1, END: 1, AGI: 1 }, sets: [], badges: [] };

const BADGE_ICONS = {
  first: '<path d="M12 2l2.9 6.6 7.1.6-5.4 4.7 1.6 7L12 17.3 5.8 20.9l1.6-7L2 9.2l7.1-.6z"/>',
  ten: '<path d="M12 2l2.9 6.6 7.1.6-5.4 4.7 1.6 7L12 17.3 5.8 20.9l1.6-7L2 9.2l7.1-.6z"/>',
  fifty: '<path d="M12 2l2.9 6.6 7.1.6-5.4 4.7 1.6 7L12 17.3 5.8 20.9l1.6-7L2 9.2l7.1-.6z"/>',
  hundred: '<path d="M12 2l2.9 6.6 7.1.6-5.4 4.7 1.6 7L12 17.3 5.8 20.9l1.6-7L2 9.2l7.1-.6z"/>',
  lvl3: '<path d="M12 3v18"/><path d="M5 8l7-5 7 5"/><path d="M5 16l7 5 7-5"/>',
  lvl5: '<path d="M12 3v18"/><path d="M5 8l7-5 7 5"/><path d="M5 16l7 5 7-5"/>',
  balanced: '<circle cx="12" cy="12" r="9"/><path d="M12 3v18"/><path d="M3 12h18"/>',
  ton: '<path d="M6 7v10"/><path d="M18 7v10"/><path d="M6 12h12"/>',
};

async function load() {
  try {
    const v = await chrome.storage.local.get({ [KEY]: null });
    if (v[KEY] && typeof v[KEY] === 'object') state = Object.assign(state, v[KEY]);
    if (!state.stats) state.stats = { STR: 1, END: 1, AGI: 1 };
  } catch (e) { /* storage unavailable — run session-only */ }
  render();
}
async function save() {
  try { await chrome.storage.local.set({ [KEY]: state }); } catch (e) { /* ignore */ }
}

function render() {
  const lvl = levelForXp(state.xp);
  els.avatar.textContent = lvl;
  els.lvlPill.textContent = 'Lv ' + lvl;
  const prog = levelProgress(state.xp, lvl);
  els.xpFill.style.width = Math.round(prog * 100) + '%';
  els.xpLabel.textContent = state.xp + ' / ' + xpForLevel(lvl + 1) + ' XP';
  els.stStr.textContent = state.stats.STR;
  els.stEnd.textContent = state.stats.END;
  els.stAgi.textContent = state.stats.AGI;

  // Badges.
  els.badges.innerHTML = '';
  BADGES.forEach((b) => {
    const on = state.badges.includes(b.id);
    const d = document.createElement('div');
    d.className = 'badge' + (on ? ' on' : '');
    d.title = b.label + (on ? ' — unlocked' : ' — locked');
    d.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
      (BADGE_ICONS[b.id] || '') + '</svg><span>' + b.label + '</span>';
    els.badges.appendChild(d);
  });

  // History (newest first).
  els.hist.innerHTML = '';
  const rev = state.sets.slice().reverse();
  els.emptyHist.style.display = rev.length ? 'none' : '';
  rev.slice(0, 60).forEach((s) => {
    const li = document.createElement('li');
    const date = new Date(s.ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    li.innerHTML = '<span><b>' + escapeHtml(s.ex) + '</b> · ' + s.w + 'kg × ' + s.r +
      ' <span class="st">' + s.stat + '</span></span><span class="mut">' + date +
      '</span><button class="del" title="Delete">×</button>';
    li.querySelector('.del').addEventListener('click', () => {
      const idx = state.sets.findIndex((x) => x.id === s.id);
      if (idx >= 0) { state.sets.splice(idx, 1); save().then(render); }
    });
    els.hist.appendChild(li);
  });
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

els.btnLog.addEventListener('click', async () => {
  const ex = els.inEx.value.trim() || 'Unnamed lift';
  const w = Math.max(0, Number(els.inW.value) || 0);
  const r = Math.max(1, Math.floor(Number(els.inR.value) || 0));
  const stat = ['STR', 'END', 'AGI'].includes(els.inStat.value) ? els.inStat.value : 'STR';
  if (!Number(els.inR.value)) return; // reps required

  const before = levelForXp(state.xp);
  const gained = xpForSet(r, w);
  state.sets.push({ id: Date.now() + '-' + Math.random().toString(36).slice(2), ex, w, r, stat, ts: Date.now() });
  state.xp += gained;
  state.stats[stat] += 1;

  // Check badges.
  const newly = [];
  BADGES.forEach((b) => {
    if (!state.badges.includes(b.id) && b.check(state)) { state.badges.push(b.id); newly.push(b.label); }
  });

  await save();
  const after = levelForXp(state.xp);
  const msg = [];
  if (after > before) msg.push('LEVEL UP! You are now level ' + after);
  newly.forEach((n) => msg.push('Badge unlocked: ' + n));
  if (msg.length) {
    els.levelMsg.textContent = msg.join(' · ');
    els.levelMsg.hidden = false;
  } else {
    els.levelMsg.hidden = true;
  }
  els.inEx.value = ''; els.inW.value = ''; els.inR.value = '';
  render();
});

els.btnClear.addEventListener('click', async () => {
  if (!confirm('Delete all logged sets, XP, stats and badges?')) return;
  state = { xp: 0, stats: { STR: 1, END: 1, AGI: 1 }, sets: [], badges: [] };
  els.levelMsg.hidden = true;
  await save();
  render();
});

load();
