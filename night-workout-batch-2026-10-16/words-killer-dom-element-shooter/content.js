/* Word Killer — DOM Element Shooter (content script).
 * Injected ONLY on explicit user click via chrome.scripting.
 * Everything renders inside ONE removable overlay; the page's own DOM
 * content is never modified. Esc / Close removes every trace.
 */
(() => {
  if (window.__wkBooted) return; // injected once per page
  window.__wkBooted = true;

  let stopCurrent = null;

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg && msg.type === 'WK_START') {
      if (stopCurrent) stopCurrent();
      stopCurrent = startGame(msg.difficulty || 'normal');
    }
  });

  /* Bundled word pools — no network, no remote data. */
  const WORDS = {
    easy: ['cat','dog','sun','code','web','node','pixel','mouse','tab','icon',
           'link','data','cache','font','grid','hover','input','key','menu',
           'page','query','radio','scroll','style','theme','token','video',
           'window','zoom','byte','chip','cloud','debug'],
    normal: ['browser','cursor','button','canvas','cookie','domain','element',
             'frame','header','image','script','server','socket','syntax',
             'table','widget','alert','badge','card','chart','modal','panel',
             'popup','slider','toast','tooltip','banner','footer','sidebar',
             'https','cache','regex','pixel'],
    hard: ['javascript','typescript','stylesheet','animation','asynchronous',
           'callback','closure','debounce','framework','function','interface',
           'iterator','keyboard','library','promise','responsive','sandbox',
           'shadow','template','throttle','variable','viewport','worker',
           'margin','padding','zindex','webpack']
  };
  const TAGS = ['div','span','p','a','img','btn','nav','li','h1','code','ul','td'];

  function escHtml(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function startGame(difficulty) {
    const CFG = {
      easy:   { speed: 45,  spawnMs: 1700, lives: 5, maxItems: 5, pool: WORDS.easy },
      normal: { speed: 75,  spawnMs: 1250, lives: 3, maxItems: 7, pool: WORDS.normal },
      hard:   { speed: 120, spawnMs: 900,  lives: 3, maxItems: 9, pool: WORDS.hard }
    }[difficulty] || { speed: 75, spawnMs: 1250, lives: 3, maxItems: 7, pool: WORDS.normal };

    /* ---- state ---- */
    let running = true, dead = false;
    let score = 0, lives = CFG.lives, streak = 0, bestStreak = 0, kills = 0;
    let typed = '', charsTyped = 0, startTime = 0;
    let items = []; // {el, wordEl, word, x, y, vy}
    let rafId = 0, lastT = 0, lastSpawn = 0, wpmInt = 0;
    let cleaned = false;

    /* ---- overlay DOM ---- */
    const style = document.createElement('style');
    style.textContent = `
.wk-overlay{position:fixed;inset:0;z-index:2147483647;display:flex;flex-direction:column;
  background:rgba(8,8,14,.84);backdrop-filter:blur(6px);
  font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:#f4f4f5;}
.wk-hud{display:flex;align-items:center;gap:16px;padding:10px 14px;
  background:rgba(244,114,182,.08);border-bottom:1px solid rgba(244,114,182,.35);}
.wk-stat{display:flex;flex-direction:column;font-size:10px;color:#a1a1aa;
  text-transform:uppercase;letter-spacing:.6px;}
.wk-stat b{font-size:16px;color:#fff;font-weight:700;}
.wk-stat b.wk-lives{color:#f472b6;letter-spacing:2px;}
.wk-quit{margin-left:auto;background:transparent;border:1px solid rgba(255,255,255,.2);
  color:#fff;border-radius:8px;width:32px;height:32px;cursor:pointer;font-size:14px;}
.wk-quit:hover{border-color:#f472b6;color:#f472b6;}
.wk-field{position:relative;flex:1;overflow:hidden;}
.wk-item{position:absolute;top:0;left:0;display:flex;flex-direction:column;align-items:center;
  padding:6px 12px 8px;background:rgba(244,114,182,.10);
  border:1px solid rgba(244,114,182,.55);border-radius:10px;
  box-shadow:0 4px 18px rgba(244,114,182,.15);will-change:transform;}
.wk-item.target{border-color:#f472b6;
  box-shadow:0 0 0 2px rgba(244,114,182,.55),0 4px 18px rgba(244,114,182,.30);}
.wk-tag{font-size:9px;color:#f472b6;font-family:ui-monospace,Menlo,Consolas,monospace;}
.wk-word{font-size:17px;font-weight:700;font-family:ui-monospace,Menlo,Consolas,monospace;
  letter-spacing:.5px;white-space:nowrap;}
.wk-hit{color:#f472b6;}
.wk-item.pop{animation:wkpop .18s ease-out forwards;}
@keyframes wkpop{to{transform:scale(1.7);opacity:0;}}
.wk-typed{min-height:46px;display:flex;align-items:center;justify-content:center;
  font-size:24px;font-weight:800;font-family:ui-monospace,Menlo,Consolas,monospace;
  color:#f472b6;border-top:1px solid rgba(244,114,182,.25);padding:8px;}
.wk-typed:empty::after{content:'start typing…';color:#52525b;font-size:14px;font-weight:400;}
.wk-typed.wk-err{animation:wkflash .25s;}
@keyframes wkflash{50%{color:#f87171;}}
.wk-banner{text-align:center;font-size:11px;color:#a1a1aa;padding:6px 6px 10px;}
.wk-over{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;
  justify-content:center;gap:10px;background:rgba(8,8,14,.92);z-index:2;}
.wk-over.hidden{display:none;}
.wk-over h2{font-size:26px;color:#f472b6;}
.wk-over p{font-size:14px;color:#d4d4d8;}
.wk-over p b{color:#f472b6;}
.wk-btns{display:flex;gap:10px;margin-top:6px;}
.wk-btns button{padding:10px 20px;font-size:14px;font-weight:700;border-radius:10px;
  cursor:pointer;border:1px solid rgba(244,114,182,.5);
  background:rgba(244,114,182,.12);color:#fff;}
.wk-btns button:hover{background:#f472b6;color:#141414;}`;

    const overlay = document.createElement('div');
    overlay.className = 'wk-overlay';
    overlay.innerHTML = `
      <div class="wk-hud">
        <div class="wk-stat"><span>Score</span><b class="js-score">0</b></div>
        <div class="wk-stat"><span>Lives</span><b class="wk-lives js-lives"></b></div>
        <div class="wk-stat"><span>Streak</span><b class="js-streak">0</b></div>
        <div class="wk-stat"><span>WPM</span><b class="js-wpm">0</b></div>
        <div class="wk-stat"><span>Best</span><b class="js-best">0</b></div>
        <button class="wk-quit" title="Quit (Esc)">✕</button>
      </div>
      <div class="wk-field"></div>
      <div class="wk-typed"></div>
      <div class="wk-banner">WORD KILLER · type the falling words to shoot them · Esc quits</div>
      <div class="wk-over hidden">
        <h2>Game Over</h2>
        <p>Score <b class="js-final">0</b> · WPM <b class="js-final-wpm">0</b> ·
           Best streak <b class="js-final-streak">0</b> · Words shot <b class="js-final-kills">0</b></p>
        <div class="wk-btns">
          <button class="js-again">Play again</button>
          <button class="js-close">Close</button>
        </div>
      </div>`;

    document.documentElement.appendChild(style);
    document.documentElement.appendChild(overlay);

    const field = overlay.querySelector('.wk-field');
    const typedEl = overlay.querySelector('.wk-typed');
    const qs = (sel) => overlay.querySelector(sel);

    /* ---- HUD ---- */
    function renderHud() {
      qs('.js-score').textContent = score;
      qs('.js-lives').textContent = '♥'.repeat(Math.max(0, lives));
      qs('.js-streak').textContent = streak;
    }
    function renderWpm() {
      if (!startTime) return;
      const mins = (performance.now() - startTime) / 60000;
      qs('.js-wpm').textContent = mins > 0 ? Math.round((charsTyped / 5) / mins) : 0;
    }

    /* ---- words ---- */
    function spawn() {
      const word = CFG.pool[(Math.random() * CFG.pool.length) | 0];
      const tag = TAGS[(Math.random() * TAGS.length) | 0];
      const el = document.createElement('div');
      el.className = 'wk-item';
      const tagEl = document.createElement('span');
      tagEl.className = 'wk-tag';
      tagEl.textContent = `<${tag}>`;
      const wordEl = document.createElement('span');
      wordEl.className = 'wk-word';
      wordEl.textContent = word;
      el.appendChild(tagEl);
      el.appendChild(wordEl);
      field.appendChild(el);
      const fw = field.clientWidth || window.innerWidth;
      items.push({
        el, wordEl, word,
        x: 8 + Math.random() * Math.max(40, fw - 170),
        y: -70,
        vy: CFG.speed * (0.85 + Math.random() * 0.35)
      });
      paintTargets();
    }

    function removeItem(it, animClass) {
      const i = items.indexOf(it);
      if (i >= 0) items.splice(i, 1);
      if (animClass) {
        it.el.classList.add(animClass);
        setTimeout(() => it.el.remove(), 200);
      } else {
        it.el.remove();
      }
    }

    function kill(it) {
      removeItem(it, 'pop');
      score += it.word.length * 10 + streak * 5;
      streak += 1;
      bestStreak = Math.max(bestStreak, streak);
      kills += 1;
      typed = '';
      typedEl.textContent = '';
      renderHud();
      paintTargets();
    }

    function miss(it) {
      removeItem(it, null);
      lives -= 1;
      streak = 0;
      typed = '';
      typedEl.textContent = '';
      renderHud();
      paintTargets();
      if (lives <= 0) gameOver();
    }

    /* ---- targeting / typing ---- */
    function candidates() {
      return items.filter((it) => it.word.startsWith(typed));
    }
    function pickTarget() {
      const c = candidates();
      if (!c.length) return null;
      c.sort((a, b) => b.y - a.y); // nearest the bottom first
      return c[0];
    }
    function paintTargets() {
      const target = typed ? pickTarget() : null;
      items.forEach((it) => {
        if (typed && it.word.startsWith(typed)) {
          it.wordEl.innerHTML =
            `<span class="wk-hit">${escHtml(typed)}</span>${escHtml(it.word.slice(typed.length))}`;
          it.el.classList.toggle('target', it === target);
        } else {
          it.wordEl.textContent = it.word;
          it.el.classList.remove('target');
        }
      });
    }

    function onKey(e) {
      if (e.key === 'Escape') {
        e.preventDefault(); e.stopPropagation();
        stop();
        return;
      }
      if (!running || dead || e.key.length !== 1) return;
      e.preventDefault(); e.stopPropagation();
      if (!startTime) startTime = performance.now();
      typed += e.key.toLowerCase();
      charsTyped += 1;
      const target = pickTarget();
      if (!target) {
        // wrong key: reset buffer, break streak
        typed = '';
        streak = 0;
        typedEl.classList.remove('wk-err');
        void typedEl.offsetWidth; // restart animation
        typedEl.classList.add('wk-err');
      } else if (target.word === typed) {
        kill(target);
        typedEl.textContent = '';
        return;
      }
      typedEl.textContent = typed;
      renderHud();
      paintTargets();
    }

    /* ---- main loop ---- */
    function loop(t) {
      if (!running) return;
      const dt = Math.min(0.05, lastT ? (t - lastT) / 1000 : 0.016);
      lastT = t;
      if (t - lastSpawn > CFG.spawnMs && items.length < CFG.maxItems) {
        spawn();
        lastSpawn = t;
      }
      const fh = field.clientHeight || window.innerHeight;
      for (const it of items) {
        it.y += it.vy * dt;
        it.el.style.transform = `translate(${it.x.toFixed(1)}px, ${it.y.toFixed(1)}px)`;
      }
      for (let i = items.length - 1; i >= 0; i--) {
        if (items[i].y > fh - 20) miss(items[i]);
      }
      rafId = requestAnimationFrame(loop);
    }

    /* ---- game over / stop ---- */
    async function gameOver() {
      dead = true;
      const mins = startTime ? (performance.now() - startTime) / 60000 : 0;
      const wpm = mins > 0 ? Math.round((charsTyped / 5) / mins) : 0;
      qs('.js-final').textContent = score;
      qs('.js-final-wpm').textContent = wpm;
      qs('.js-final-streak').textContent = bestStreak;
      qs('.js-final-kills').textContent = kills;
      qs('.wk-over').classList.remove('hidden');
      try {
        const st = await chrome.storage.local.get({ wkHigh: 0 });
        if (score > st.wkHigh) {
          await chrome.storage.local.set({ wkHigh: score });
          qs('.js-best').textContent = score;
        }
      } catch (_) { /* storage unavailable — ignore */ }
    }

    function stop() {
      if (cleaned) return;
      cleaned = true;
      running = false;
      cancelAnimationFrame(rafId);
      clearInterval(wpmInt);
      window.removeEventListener('keydown', onKey, true);
      overlay.remove();
      style.remove();
      if (stopCurrent === cleanup) stopCurrent = null;
    }
    function cleanup() { stop(); }

    /* ---- wire up ---- */
    overlay.querySelector('.wk-quit').addEventListener('click', stop);
    overlay.querySelector('.js-close').addEventListener('click', stop);
    overlay.querySelector('.js-again').addEventListener('click', () => {
      stop();
      stopCurrent = startGame(difficulty);
    });
    window.addEventListener('keydown', onKey, true);

    chrome.storage.local.get({ wkHigh: 0 }).then((st) => {
      qs('.js-best').textContent = st.wkHigh || 0;
    }).catch(() => {});

    renderHud();
    wpmInt = setInterval(renderWpm, 500);
    rafId = requestAnimationFrame(loop);
    return cleanup;
  }
})();
