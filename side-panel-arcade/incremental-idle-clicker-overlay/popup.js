/* ClickIdle — idle clicker game logic.
 * All state lives in chrome.storage.local; offline earnings are computed
 * from the saved timestamp whenever the popup opens. No network access. */
'use strict';

/* ---------- Upgrade catalogue ----------
 * kind: 'click'  -> adds flat shards per manual tap
 * kind: 'auto'   -> adds shards/sec
 * kind: 'mult'   -> multiplies ALL earnings (one-shot tiers) */
const UPGRADES = [
  {
    id: 'click1', name: 'Sturdy Cursor', desc: '+1 shard per tap', kind: 'click',
    amount: 1, baseCost: 15, growth: 1.6, max: 50,
    icon: '<path d="M4 4l7 17 2.5-7L21 11.5z"/>'
  },
  {
    id: 'click2', name: 'Golden Finger', desc: '+5 shards per tap', kind: 'click',
    amount: 5, baseCost: 250, growth: 1.7, max: 30,
    icon: '<path d="M7 11V6a1.5 1.5 0 0 1 3 0v4m0-1.5a1.5 1.5 0 0 1 3 0V11m0-0.5a1.5 1.5 0 0 1 3 0V13c0 3-2 6-5.5 6S5 16.5 4 14l-1.5-3c-.5-1 .5-2 1.5-1.5z"/>'
  },
  {
    id: 'auto1', name: 'Shard Drone', desc: '+1 shard / sec', kind: 'auto',
    amount: 1, baseCost: 50, growth: 1.55, max: 100,
    icon: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3m0 14v3M2 12h3m14 0h3M5 5l2 2m10 10 2 2m0-14-2 2M7 17l-2 2"/>'
  },
  {
    id: 'auto2', name: 'Auto Forge', desc: '+8 shards / sec', kind: 'auto',
    amount: 8, baseCost: 1200, growth: 1.6, max: 60,
    icon: '<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.6 2.6-2.5-2.5z"/>'
  },
  {
    id: 'mult1', name: 'Amplify I', desc: '×2 all earnings', kind: 'mult',
    amount: 2, baseCost: 500, growth: 6, max: 4,
    icon: '<path d="M13 2 4 14h6l-1 8 9-12h-6z"/>'
  }
];

const OFFLINE_RATE = 0.25;      // offline earnings at 25% of rate, capped below
const OFFLINE_CAP_HOURS = 8;
const PRESTIGE_COST = 250000;   // shards needed to prestige
const SAVE_KEY = 'clickidle_save_v1';

/* ---------- State ---------- */
function freshState() {
  return {
    balance: 0, totalEarned: 0, clicks: 0,
    upgrades: {},            // id -> owned count
    prestigeCount: 0, prestigeMult: 1,
    playSeconds: 0, lastSeen: Date.now()
  };
}
let S = freshState();

/* ---------- Derived values ---------- */
const owned = id => S.upgrades[id] || 0;
function upgradeCost(u) {
  return Math.floor(u.baseCost * Math.pow(u.growth, owned(u.id)));
}
function clickPower() {
  let p = 1;
  for (const u of UPGRADES) if (u.kind === 'click') p += u.amount * owned(u.id);
  return p * S.prestigeMult;
}
function autoRate() {
  let r = 0;
  for (const u of UPGRADES) if (u.kind === 'auto') r += u.amount * owned(u.id);
  return r * S.prestigeMult;
}
function multBonus() {
  let m = 1;
  for (const u of UPGRADES) if (u.kind === 'mult') m *= Math.pow(u.amount, owned(u.id));
  return m;
}
/* Note: click/auto already include prestigeMult; multBonus is folded in via
 * prestige-aware purchase application below — earnings use clickPower/autoRate. */
function fmt(n) {
  if (n < 1000) return Math.floor(n).toString();
  const units = ['K', 'M', 'B', 'T', 'Qa'];
  let v = n, i = -1;
  while (v >= 1000 && i < units.length - 1) { v /= 1000; i++; }
  return v.toFixed(v < 10 ? 2 : 1) + units[i];
}
function fmtTime(sec) {
  if (sec < 3600) return Math.floor(sec / 60) + 'm';
  const h = Math.floor(sec / 3600);
  return h + 'h ' + Math.floor((sec % 3600) / 60) + 'm';
}

/* ---------- Persistence ---------- */
async function save() {
  S.lastSeen = Date.now();
  await chrome.storage.local.set({ [SAVE_KEY]: S });
}
async function load() {
  const data = await chrome.storage.local.get(SAVE_KEY);
  if (data[SAVE_KEY]) S = Object.assign(freshState(), data[SAVE_KEY]);
  // Offline earnings (25% rate, max 8h)
  const awaySec = Math.min((Date.now() - (S.lastSeen || Date.now())) / 1000, OFFLINE_CAP_HOURS * 3600);
  const gain = autoRate() * multBonus() * awaySec * OFFLINE_RATE;
  if (gain >= 1) {
    S.balance += gain; S.totalEarned += gain;
    flashOffline(gain, awaySec);
  }
}

/* ---------- Rendering ---------- */
const $ = id => document.getElementById(id);
const svg = inner => `<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;

function render() {
  $('balance').textContent = fmt(S.balance) + ' shards';
  $('rateLine').textContent = `+${fmt(autoRate() * multBonus())} /sec · tap ${fmt(clickPower() * multBonus())}`;
  $('clickGain').textContent = '+' + fmt(clickPower() * multBonus());
  $('prestigeChip').textContent = '×' + (S.prestigeMult * multBonus()).toFixed(2);

  // Upgrades
  const list = $('upgradeList');
  list.innerHTML = '';
  for (const u of UPGRADES) {
    const n = owned(u.id);
    const maxed = n >= u.max;
    const cost = maxed ? null : upgradeCost(u);
    const btn = document.createElement('button');
    btn.className = 'upgrade' + (maxed ? ' maxed' : '');
    btn.disabled = maxed || S.balance < cost;
    btn.innerHTML =
      `<span class="u-ico">${svg(u.icon)}</span>` +
      `<span class="u-body"><div class="u-name">${u.name}</div><div class="u-desc">${u.desc}</div></span>` +
      (maxed ? `<span class="u-count">MAX</span>` :
        `<span class="u-count">${n}</span><span class="u-cost">${fmt(cost)}</span>`);
    if (!maxed) btn.addEventListener('click', () => buy(u));
    list.appendChild(btn);
  }

  // Prestige
  const canPrestige = S.totalEarned >= PRESTIGE_COST;
  $('prestigeReq').textContent = canPrestige
    ? `+${Math.floor(S.totalEarned / PRESTIGE_COST)} boost`
    : `needs ${fmt(PRESTIGE_COST)} lifetime`;
  $('prestigeBtn').disabled = !canPrestige;
}

function renderStats() {
  $('stEarned').textContent = fmt(S.totalEarned);
  $('stClicks').textContent = S.clicks.toLocaleString();
  $('stTime').textContent = fmtTime(S.playSeconds);
  $('stPrestige').textContent = S.prestigeCount;
  $('stMult').textContent = '×' + (S.prestigeMult * multBonus()).toFixed(2);
}

/* ---------- Actions ---------- */
function earn(amount) {
  S.balance += amount;
  S.totalEarned += amount;
}
function buy(u) {
  const cost = upgradeCost(u);
  if (S.balance < cost || owned(u.id) >= u.max) return;
  S.balance -= cost;
  S.upgrades[u.id] = owned(u.id) + 1;
  save(); render();
}
function doPrestige() {
  const gained = Math.floor(S.totalEarned / PRESTIGE_COST);
  if (gained < 1) return;
  if (!confirm(`Prestige now? Your progress resets, but you gain a permanent ×${(1 + gained * 0.25).toFixed(2)} multiplier.`)) return;
  S.prestigeCount += 1;
  S.prestigeMult = +(S.prestigeMult * (1 + gained * 0.25)).toFixed(3);
  S.balance = 0; S.totalEarned = 0; S.clicks = 0; S.upgrades = {};
  save(); render();
}
function floatText(txt) {
  const el = document.createElement('span');
  el.className = 'floater';
  el.textContent = txt;
  el.style.marginLeft = (Math.random() * 60 - 30) + 'px';
  $('floaters').appendChild(el);
  setTimeout(() => el.remove(), 850);
}
function flashOffline(gain, sec) {
  setTimeout(() => {
    const el = document.createElement('div');
    el.className = 'card';
    el.style.cssText = 'border-color:rgba(245,158,11,.5);font-size:12.5px;color:var(--accent);font-weight:700;text-align:center;';
    el.textContent = `Welcome back! +${fmt(gain)} shards earned while away (${fmtTime(sec)}).`;
    document.querySelector('.app').prepend(el);
    setTimeout(() => el.remove(), 6000);
  }, 50);
}

/* ---------- Wiring ---------- */
function setIcons() {
  $('brandMark').innerHTML = svg('<path d="M13 2 4 14h6l-1 8 9-12h-6z"/>');
  $('shardIco').innerHTML = svg('<path d="M12 2 3 9l9 13 9-13z"/><path d="M3 9h18M12 2l-4 7 4 13 4-13z"/>');
  $('prestigeIco').innerHTML = svg('<path d="M12 3v18M3 12h18"/><circle cx="12" cy="12" r="9"/>');
  $('statsBtn').innerHTML = svg('<path d="M3 3v18h18"/><path d="M7 15v3M12 10v8M17 6v12"/>');
}

document.addEventListener('DOMContentLoaded', async () => {
  setIcons();
  await load();
  render();

  $('clickBtn').addEventListener('click', () => {
    const gain = clickPower() * multBonus();
    earn(gain);
    S.clicks++;
    floatText('+' + fmt(gain));
    save(); render();
  });

  $('prestigeBtn').addEventListener('click', doPrestige);

  $('statsBtn').addEventListener('click', () => {
    renderStats();
    $('gameView').hidden = true; $('statsView').hidden = false;
  });
  $('backBtn').addEventListener('click', () => {
    $('statsView').hidden = true; $('gameView').hidden = false; render();
  });
  $('resetBtn').addEventListener('click', async () => {
    if (confirm('Reset ALL ClickIdle progress? This cannot be undone.')) {
      S = freshState();
      await save(); render();
      $('statsView').hidden = true; $('gameView').hidden = false;
    }
  });

  // Tick: auto earnings + playtime, 1/sec
  setInterval(() => {
    const gain = autoRate() * multBonus();
    if (gain > 0) earn(gain);
    S.playSeconds += 1;
    render();
    if (S.playSeconds % 10 === 0) save();   // persist every 10s
  }, 1000);

  // Save on close
  window.addEventListener('pagehide', save);
});
