/* Tab vs Tab Fighter — content script.
   A user-triggered 2-player arena overlay. Both tabs run this script; the
   two fighters sync through chrome.storage.local (same browser only —
   no network, no online multiplayer). Closing the panel removes every
   trace; the page itself is never modified.
   NOTE: runs in the page's isolated world; must be self-contained. */

(() => {
  // Toggle: close if already open.
  const existing = document.getElementById('__ttf_arena');
  if (existing) {
    window.dispatchEvent(new Event('__ttf_leave'));
    return;
  }

  const KEY = 'fighterArena';
  const ARENA_W = 740, ARENA_H = 420, GROUND = 340;
  const P1_COLOR = '#38bdf8', P2_COLOR = '#f87171';
  const storage = (typeof chrome !== 'undefined' && chrome.storage) ? chrome.storage.local : null;

  let role = 'p1'; // decided by the popup; read below.

  // ---- Shared-state helpers (the cross-tab "bus") ----
  const emptyFighter = (x) => ({ x, y: GROUND, vy: 0, hp: 100, dir: 1, action: 'idle', seq: 0, blocking: false });
  const defaultState = () => ({
    p1: { ...emptyFighter(200), dir: 1 },
    p2: { ...emptyFighter(540), dir: -1 },
    roundOver: false, winner: null,
  });

  function readState(cb) {
    if (!storage) return cb(defaultState());
    storage.get({ [KEY]: null }, (s) => cb(s[KEY] ? JSON.parse(JSON.stringify(s[KEY])) : defaultState()));
  }
  function writeState(state) { if (storage) storage.set({ [KEY]: state }); }

  // ---- Build the arena panel (draggable header) ----
  const panel = document.createElement('div');
  panel.id = '__ttf_arena';
  panel.style.cssText = [
    'position:fixed', 'top:36px', 'left:50%', 'transform:translateX(-50%)',
    'z-index:2147483647', 'width:' + (ARENA_W + 32) + 'px',
    'border-radius:16px', 'overflow:hidden',
    'background:rgba(20,20,26,0.92)', 'backdrop-filter:blur(12px)',
    'border:1px solid rgba(255,255,255,0.12)',
    'box-shadow:0 12px 40px rgba(0,0,0,0.6)',
    'font-family:"Segoe UI",system-ui,sans-serif', 'color:#f3f4f6',
  ].join(';');
  panel.innerHTML = `
    <div id="__ttf_head" style="display:flex;align-items:center;justify-content:space-between;padding:10px 14px;cursor:move;border-bottom:1px solid rgba(255,255,255,0.08);">
      <div style="display:flex;align-items:center;gap:8px;font-weight:650;font-size:14px;">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M14 9V5a2 2 0 0 0-4 0v8L7.6 10.6a2 2 0 0 0-2.8 2.8L10 18.6A6 6 0 0 0 14.3 20H15a5 5 0 0 0 5-5v-4a2 2 0 0 0-4 0"/>
        </svg>
        <span>Tab vs Tab Fighter — <span id="__ttf_role" style="color:#fbbf24">…</span></span>
      </div>
      <div style="display:flex;gap:8px;">
        <button id="__ttf_round" style="background:rgba(251,191,36,0.12);border:1px solid rgba(251,191,36,0.4);color:#fbbf24;border-radius:8px;padding:5px 10px;cursor:pointer;font-size:12px;">New round (R)</button>
        <button id="__ttf_close" style="background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);color:#f3f4f6;border-radius:8px;width:28px;height:28px;cursor:pointer;font-size:15px;line-height:1;">&#10005;</button>
      </div>
    </div>
    <div style="text-align:center;font-size:12px;color:#9ca3af;padding:6px 10px;">
      <strong style="color:#fbbf24;">Same browser only — NOT online.</strong>
      Both players: open the popup in another tab and join as the other side.
    </div>
    <canvas id="__ttf_canvas" width="${ARENA_W}" height="${ARENA_H}" style="display:block;margin:0 auto 12px;border-radius:10px;"></canvas>
  `;
  document.body.appendChild(panel);
  const canvas = panel.querySelector('#__ttf_canvas');
  const ctx = canvas.getContext('2d');
  const roleEl = panel.querySelector('#__ttf_role');

  // Draggable header.
  (() => {
    const head = panel.querySelector('#__ttf_head');
    let sx, sy, ox, oy, dragging = false;
    head.addEventListener('mousedown', (e) => {
      dragging = true; sx = e.clientX; sy = e.clientY;
      const r = panel.getBoundingClientRect(); ox = r.left; oy = r.top;
      panel.style.transform = 'none'; panel.style.left = ox + 'px'; panel.style.top = oy + 'px';
    });
    window.addEventListener('mousemove', (e) => {
      if (!dragging) return;
      panel.style.left = Math.max(0, ox + e.clientX - sx) + 'px';
      panel.style.top = Math.max(0, oy + e.clientY - sy) + 'px';
    });
    window.addEventListener('mouseup', () => { dragging = false; });
  })();

  // ---- Local game state ----
  const me = { x: 0, y: GROUND, vy: 0, hp: 100, dir: 1, action: 'idle', actionT: 0, seq: 0, blocking: false, wins: 0 };
  let foe = { x: 540, y: GROUND, hp: 100, dir: -1, action: 'idle', blocking: false, wins: 0 };
  let roundOver = false, winner = null;
  let projectiles = [];   // {x, y, vx, owner}
  let particles = [];     // {x, y, vx, vy, life, color}
  let keys = {};
  let lastAttack = { punch: 0, kick: 0, fire: 0 };
  let alive = true, raf = 0, publishTimer = 0;
  const other = () => (role === 'p1' ? 'p2' : 'p1');

  function applyDamage(targetRole, amount) {
    readState((state) => {
      const t = state[targetRole];
      const real = t.blocking ? Math.ceil(amount / 2) : amount;
      t.hp = Math.max(0, t.hp - real);
      burst(t.x, t.y - 40, t.blocking ? '#9ca3af' : '#f87171');
      if (t.hp <= 0 && !state.roundOver) {
        state.roundOver = true;
        state.winner = other(); // the attacker (me) wins
        const w = state[other()];
        w.wins = (w.wins || 0) + 1;
        writeState(state);
        // publish wins locally too
        me.wins = state[role].wins || me.wins;
        return;
      }
      writeState(state);
    });
  }

  function resetRound() {
    readState((state) => {
      state.p1 = { ...emptyFighter(200), dir: 1, wins: state.p1.wins || 0 };
      state.p2 = { ...emptyFighter(540), dir: -1, wins: state.p2.wins || 0 };
      state.roundOver = false; state.winner = null;
      writeState(state);
    });
    projectiles = [];
    me.hp = 100; me.x = role === 'p1' ? 200 : 540;
    me.y = GROUND; me.vy = 0; me.action = 'idle';
    foe.hp = 100;
    roundOver = false; winner = null;
  }

  function burst(x, y, color) {
    for (let i = 0; i < 14; i++) {
      const a = Math.random() * Math.PI * 2, sp = 1 + Math.random() * 3;
      particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 1, life: 26, color });
    }
  }

  // Opponent updates arrive through the storage bus.
  const onChanged = (changes, area) => {
    if (area !== 'local' || !changes[KEY]) return;
    const state = changes[KEY].newValue;
    if (!state) return;
    const f = state[other()];
    if (f && f.seq >= (foe.seq || 0)) foe = { ...foe, ...f };
    roundOver = state.roundOver;
    winner = state.winner;
    const mine = state[role];
    if (mine) {
      if (typeof mine.wins === 'number') me.wins = mine.wins;
      if (typeof mine.hp === 'number') me.hp = mine.hp; // damage applied by foe
    }
  };
  if (storage) storage.onChanged.addListener(onChanged);

  // ---- Combat ----
  function tryPunch() {
    const now = performance.now();
    if (now - lastAttack.punch < 350 || roundOver) return;
    lastAttack.punch = now;
    me.action = 'punch'; me.actionT = now;
    const reach = 70;
    if (Math.abs(foe.x - me.x) < reach && Math.abs(foe.y - me.y) < 90) {
      applyDamage(other(), 8);
    }
  }
  function tryKick() {
    const now = performance.now();
    if (now - lastAttack.kick < 600 || roundOver) return;
    lastAttack.kick = now;
    me.action = 'kick'; me.actionT = now;
    const reach = 92;
    if (Math.abs(foe.x - me.x) < reach && Math.abs(foe.y - me.y) < 90) {
      applyDamage(other(), 14);
    }
  }
  function tryFire() {
    const now = performance.now();
    if (now - lastAttack.fire < 900 || roundOver) return;
    lastAttack.fire = now;
    me.action = 'fire'; me.actionT = now;
    projectiles.push({ x: me.x + me.dir * 26, y: me.y - 52, vx: me.dir * 6, owner: role });
  }

  // ---- Physics + rendering ----
  function step() {
    if (roundOver) return;
    // Movement.
    const speed = 4;
    me.blocking = !!keys['s'];
    if (!me.blocking) {
      if (keys['a']) { me.x -= speed; me.dir = -1; }
      if (keys['d']) { me.x += speed; me.dir = 1; }
      if (keys['w'] && me.y >= GROUND) me.vy = -11;
    }
    me.x = Math.max(24, Math.min(ARENA_W - 24, me.x));
    me.vy += 0.6;
    me.y = Math.min(GROUND, me.y + me.vy);
    if (me.y >= GROUND) { me.y = GROUND; me.vy = 0; }
    if (me.action !== 'idle' && performance.now() - me.actionT > 240) me.action = 'idle';

    // Projectiles (mine only; foe's arrive as damage events).
    for (const p of projectiles) {
      p.x += p.vx;
      if (Math.abs(foe.x - p.x) < 26 && Math.abs(foe.y - 52 - p.y) < 60) {
        p.dead = true;
        applyDamage(other(), 10);
      }
      if (p.x < -20 || p.x > ARENA_W + 20) p.dead = true;
    }
    projectiles = projectiles.filter((p) => !p.dead);

    // Particles.
    for (const q of particles) { q.x += q.vx; q.y += q.vy; q.vy += 0.15; q.life--; }
    particles = particles.filter((q) => q.life > 0);

    // Publish my slice (throttled).
    const now = performance.now();
    if (storage && now - publishTimer > 80) {
      publishTimer = now;
      readState((state) => {
        state[role] = {
          x: me.x, y: me.y, vy: me.vy, hp: me.hp, dir: me.dir,
          action: me.action, seq: ++me.seq, blocking: me.blocking,
          wins: me.wins,
        };
        // Carry round flags from local view (only set by damage writer).
        state.roundOver = roundOver; state.winner = winner;
        writeState(state);
      });
    }
  }

  function drawFighter(f, color, name) {
    const h = 76, w = 34;
    const x = f.x - w / 2, y = f.y - h;
    // Shadow.
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath(); ctx.ellipse(f.x, GROUND + 8, 20, 5, 0, 0, Math.PI * 2); ctx.fill();
    // Body.
    ctx.fillStyle = color;
    ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 2;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x, y, w, h, 9); else ctx.rect(x, y, w, h);
    ctx.fill(); ctx.stroke();
    // Head.
    ctx.fillStyle = '#f3f4f6';
    ctx.beginPath(); ctx.arc(f.x, y - 10, 12, 0, Math.PI * 2); ctx.fill();
    ctx.stroke();
    // Eyes (face the fight direction).
    ctx.fillStyle = '#111';
    ctx.beginPath(); ctx.arc(f.x + f.dir * 5 - 3, y - 12, 2.2, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(f.x + f.dir * 5 + 4, y - 12, 2.2, 0, Math.PI * 2); ctx.fill();
    // Attack arm.
    if (f.action === 'punch' || f.action === 'kick') {
      ctx.strokeStyle = color; ctx.lineWidth = 8; ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(f.x, y + 24);
      ctx.lineTo(f.x + f.dir * (f.action === 'punch' ? 44 : 56), y + (f.action === 'punch' ? 24 : 48));
      ctx.stroke();
    }
    // Block shield.
    if (f.blocking) {
      ctx.strokeStyle = '#9ca3af'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(f.x, y + 30, 26, 0, Math.PI * 2); ctx.stroke();
    }
    // Name + HP bar.
    ctx.fillStyle = '#e5e7eb'; ctx.font = '600 12px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(name, f.x, 18);
    const bw = 120;
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fillRect(f.x - bw / 2, 26, bw, 10);
    const hpW = Math.max(0, (f.hp / 100) * bw);
    ctx.fillStyle = f.hp > 50 ? '#34d399' : f.hp > 25 ? '#fbbf24' : '#f87171';
    ctx.fillRect(f.x - bw / 2, 26, hpW, 10);
  }

  function draw() {
    // Arena background.
    const g = ctx.createLinearGradient(0, 0, 0, ARENA_H);
    g.addColorStop(0, '#15151d'); g.addColorStop(1, '#0d0d13');
    ctx.fillStyle = g; ctx.fillRect(0, 0, ARENA_W, ARENA_H);
    ctx.fillStyle = '#1c1c26'; ctx.fillRect(0, GROUND + 12, ARENA_W, ARENA_H - GROUND - 12);
    ctx.strokeStyle = 'rgba(251,191,36,0.35)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, GROUND + 12); ctx.lineTo(ARENA_W, GROUND + 12); ctx.stroke();

    // Foe's projectiles are invisible to me (their damage lands as events);
    // mine are drawn here.
    for (const p of projectiles) {
      ctx.fillStyle = role === 'p1' ? P1_COLOR : P2_COLOR;
      ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 12;
      ctx.beginPath(); ctx.arc(p.x, p.y, 8, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
    }
    for (const q of particles) {
      ctx.globalAlpha = Math.max(0, q.life / 26);
      ctx.fillStyle = q.color;
      ctx.fillRect(q.x - 2, q.y - 2, 4, 4);
      ctx.globalAlpha = 1;
    }

    const mine = { x: me.x, y: me.y, dir: me.dir, action: me.action, hp: me.hp, blocking: me.blocking };
    const theirs = { x: foe.x, y: foe.y, dir: foe.dir, action: foe.action, hp: foe.hp, blocking: foe.blocking };
    if (role === 'p1') {
      drawFighter(mine, P1_COLOR, 'P1 — You (' + me.wins + ' wins)');
      drawFighter(theirs, P2_COLOR, 'P2 — Foe (' + (foe.wins || 0) + ' wins)');
    } else {
      drawFighter(theirs, P1_COLOR, 'P1 — Foe (' + (foe.wins || 0) + ' wins)');
      drawFighter(mine, P2_COLOR, 'P2 — You (' + me.wins + ' wins)');
    }

    if (roundOver) {
      ctx.fillStyle = 'rgba(0,0,0,0.65)';
      ctx.fillRect(0, 0, ARENA_W, ARENA_H);
      ctx.fillStyle = '#fbbf24'; ctx.font = '700 30px sans-serif'; ctx.textAlign = 'center';
      const iWon = winner === role;
      ctx.fillText(iWon ? 'YOU WIN THE ROUND!' : 'FOE WINS THE ROUND', ARENA_W / 2, ARENA_H / 2 - 8);
      ctx.fillStyle = '#9ca3af'; ctx.font = '14px sans-serif';
      ctx.fillText('Press R or click "New round"', ARENA_W / 2, ARENA_H / 2 + 24);
    }
  }

  // ---- Input ----
  const onKeyDown = (e) => {
    const k = e.key.toLowerCase();
    if (['a', 'd', 'w', 's'].includes(k)) { keys[k] = true; e.preventDefault(); }
    else if (k === 'j') { tryPunch(); e.preventDefault(); }
    else if (k === 'k') { tryKick(); e.preventDefault(); }
    else if (k === 'l') { tryFire(); e.preventDefault(); }
    else if (k === 'r') { resetRound(); e.preventDefault(); }
    else if (k === 'escape') { leave(); }
  };
  const onKeyUp = (e) => { keys[e.key.toLowerCase()] = false; };
  window.addEventListener('keydown', onKeyDown, true);
  window.addEventListener('keyup', onKeyUp, true);

  panel.querySelector('#__ttf_round').addEventListener('click', resetRound);

  function leave() {
    cleanup();
    const p = document.getElementById('__ttf_arena');
    if (p) p.remove();
  }
  panel.querySelector('#__ttf_close').addEventListener('click', leave);

  function cleanup() {
    alive = false;
    cancelAnimationFrame(raf);
    window.removeEventListener('keydown', onKeyDown, true);
    window.removeEventListener('keyup', onKeyUp, true);
    window.removeEventListener('__ttf_leave', onLeave);
    if (storage) storage.onChanged.removeListener(onChanged);
  }
  function onLeave() { leave(); }
  window.addEventListener('__ttf_leave', onLeave);

  function loop() {
    if (!alive) return;
    step();
    draw();
    raf = requestAnimationFrame(loop);
  }

  // ---- Boot: learn our role, then start. ----
  const boot = (r) => {
    role = r === 'p2' ? 'p2' : 'p1';
    roleEl.textContent = role === 'p1' ? 'Player 1 (blue)' : 'Player 2 (red)';
    readState((state) => {
      const mine = state[role];
      me.x = mine.x; me.y = mine.y; me.hp = mine.hp; me.wins = mine.wins || 0;
      const f = state[other()];
      foe = { ...foe, ...f };
      roundOver = state.roundOver; winner = state.winner;
      // Announce presence.
      me.seq = (mine.seq || 0);
      writeState({ ...state, [role]: { ...mine, seq: me.seq } });
      loop();
    });
  };
  if (storage) storage.get({ role: 'p1' }, (s) => boot(s.role));
  else boot('p1');
})();
