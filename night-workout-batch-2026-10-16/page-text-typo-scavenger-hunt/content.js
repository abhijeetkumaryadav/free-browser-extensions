/* Page Text Typo Scavenger Hunt
 * User-triggered game. Typo candidates are found heuristically against a
 * bundled common-word list (best-effort — it's a game, not a spellchecker).
 * Markers live on a removable fixed overlay; the page DOM is NEVER edited.
 * Esc or Quit removes every trace. 100% local, zero network.
 */
(function () {
  'use strict';

  if (window.__typoHunt) { window.__typoHunt.stop(); }

  /* ---------------- bundled word list (heuristic, local) ---------------- */
  const DICT = new Set((
    'the be to of and a in that have it for not on with he as you do at this but his by from ' +
    'they we say her she or an will my one all would there their what so up out if about who ' +
    'get which go me when make can like time no just him know take people into year your good ' +
    'some could them see other than then now look only come its over think also back after ' +
    'use two how our work first well way even new want because any these give day most us ' +
    'such very through many before down should where each those while might great again ' +
    'against point world high every near add food between own below country plant last school ' +
    'father keep tree never start city earth eyes light thought head under story saw left few ' +
    'while along might close something seem next hard open example begin life always those ' +
    'both paper together got group often run among until children side feet car mile night ' +
    'walk white sea began grow took river four carry state once book hear stop without second ' +
    'later miss idea enough eat face watch far indian real almost let above girl sometimes ' +
    'mountain cut young talk soon list song being leave family its own page should country ' +
    'found answer grow study learn plant cover sun four between state keep eye never last let ' +
    'thought city tree cross farm hard start might story saw far sea draw left late run dont ' +
    'while press close night real life few north open seem together next white children begin ' +
    'got walk example ease paper group always music those both mark often letter until mile ' +
    'river carry state once book hear stop without second later miss idea enough face watch ' +
    'about above across after again against among animal another answer area around away ' +
    'ball base begin below between black boat body book born both bread break bring brown ' +
    'build built carry catch cause center certain change check child children choose city ' +
    'class clean clear climb close color come common cook could count country course cover ' +
    'create cried cross crowd dance dead deal dear death decide deep does done door doubt ' +
    'down dozen draw dream dress drink drive during early earth eight either electric else ' +
    'empty end enemy enjoy enter entire equal even evening event every exact exist expect ' +
    'explain fact fair fall fast father fear feel feet fell felt field fight figure fill ' +
    'final find fine finger finish fire first fish five floor fly follow food force forth ' +
    'forty forward found frame free fresh friend front full funny gave game garden gas ' +
    'gather gave glass globe goes gold gone grade grain grand grant grass great green ' +
    'grew group guard guess guide happy heart heavy hello hill hold hole home horse ' +
    'hot hotel hour house human hundred hurry hurt idea image imagine inner input ' +
    'issue judge join jump just keep kept kick kind knew known label land large ' +
    'laugh learn least leave left legal less level light like likely limit line ' +
    'liquid list little live local long look lose loss lost loud love lovely ' +
    'lower lucky lunch magic major make march match matter maybe mean measure ' +
    'meat meet melt member memory mental metal method middle might minor ' +
    'minus minute model money month moon moral more morning most mother ' +
    'mountain mouth move movie music must name nation nature near nearly ' +
    'never news night noble noise north note nothing notice number nurse ' +
    'object occur ocean offer often older once onion only open order ' +
    'other ought outer owner paint panel paper party peace penny ' +
    'people per perform perhaps phone photo phrase piano pick ' +
    'picture piece place plain plane plant plate point pound ' +
    'power press price pride prime print prize proof proper ' +
    'proud prove queen quick quiet quite radio raise range ' +
    'rapid ratio reach ready refer renew reply right river ' +
    'road roast robot rock roman rough round route royal ' +
    'ruler rural sad said sail scale scene score sense ' +
    'serve seven shall shape share sharp sheet shelf ' +
    'shell shift shine shirt shock shoe shoot shop ' +
    'shore short shout shown sight since sixth ' +
    'sixty sized skill skin sleep slide slim ' +
    'slope small smell smile smoke snake ' +
    'snow sober social soft solar solid ' +
    'solve sorry sound south space spare ' +
    'speak speed spell spend spent ' +
    'spice split spoke sport staff ' +
    'stage stair stand start state ' +
    'steam steel steep stick still ' +
    'stock stone stood store storm ' +
    'story stove straight strange ' +
    'stream street stress stretch ' +
    'strict strike string strip ' +
    'strong struck stuck study ' +
    'stuff style sugar suit ' +
    'summer sunny super sweet ' +
    'table taken talk tall ' +
    'taste teach teeth thank ' +
    'their theme there thick ' +
    'thing think third those ' +
    'though thought thousand ' +
    'three threw throw thumb ' +
    'tiger tight tired title ' +
    'today token tooth top ' +
    'topic total touch tough ' +
    'tower town trace track ' +
    'trade trail train treat ' +
    'trend trial tribe trick ' +
    'troop truck truly trust ' +
    'truth twice under uncle ' +
    'union unite until upper ' +
    'upset urban usual valid ' +
    'value video visit vital ' +
    'voice voter waste watch ' +
    'water weave week weigh ' +
    'weight weird welcome went ' +
    'were whale what wheat ' +
    'wheel where which while ' +
    'white whole whose widen ' +
    'width wife wild will ' +
    'willing wind window wine ' +
    'wing winner winter wire ' +
    'wisdom wise wish with ' +
    'woman women wonder wood ' +
    'wooden word work worker ' +
    'world worry worth would ' +
    'wound write writer wrong ' +
    'wrote yield young youth'
  ).split(' '));

  const SECONDS = (window.__typoHuntOptions && window.__typoHuntOptions.seconds) || 120;
  const MAX_TARGETS = 25;

  /* ---------------- overlay ---------------- */
  const overlay = document.createElement('div');
  overlay.id = 'typo-hunt-overlay';
  overlay.style.cssText =
    'position:fixed;inset:0;z-index:2147483647;pointer-events:none;' +
    'font-family:system-ui,sans-serif;';
  document.documentElement.appendChild(overlay);

  // HUD (pointer-events:auto so its buttons are clickable).
  const hud = document.createElement('div');
  hud.style.cssText =
    'position:fixed;top:12px;right:14px;pointer-events:auto;display:flex;gap:10px;' +
    'align-items:center;background:rgba(20,20,26,.85);border:1px solid #3a3a46;' +
    'border-radius:10px;padding:8px 12px;color:#e8e8f0;font-size:14px;font-weight:600;' +
    'backdrop-filter:blur(12px);';
  hud.innerHTML =
    '<span id="th-score" style="color:#fbbf24">Score 0</span>' +
    '<span id="th-time" style="color:#a8a8bd">' + SECONDS + 's</span>' +
    '<button id="th-hint" style="background:#26262f;color:#e8e8f0;border:1px solid #3a3a46;' +
    'border-radius:8px;padding:4px 10px;cursor:pointer">Hint (3)</button>' +
    '<button id="th-quit" style="background:#26262f;color:#e8e8f0;border:1px solid #3a3a46;' +
    'border-radius:8px;padding:4px 10px;cursor:pointer">Quit (Esc)</button>';
  overlay.appendChild(hud);

  const state = {
    targets: [], // {node, offset, word, el, found}
    score: 0, hints: 3, timeLeft: SECONDS, running: true, timer: null
  };

  /* ---------------- scan for typo candidates ---------------- */
  function isVisible(el) {
    if (!el || el === document.body || el === document.documentElement) return true;
    return !!(el.offsetParent);
  }

  function scan() {
    const seen = new Set();
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const p = node.parentElement;
        if (!p) return NodeFilter.FILTER_REJECT;
        const tag = p.tagName;
        if (/^(SCRIPT|STYLE|TEXTAREA|INPUT|NOSCRIPT|SELECT|OPTION)$/.test(tag)) {
          return NodeFilter.FILTER_REJECT;
        }
        if (!isVisible(p)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    const re = /[A-Za-z]{4,}/g;
    let node;
    while ((node = walker.nextNode()) && state.targets.length < MAX_TARGETS) {
      const text = node.nodeValue;
      let m;
      while ((m = re.exec(text)) && state.targets.length < MAX_TARGETS) {
        const raw = m[0];
        const low = raw.toLowerCase();
        if (DICT.has(low)) continue;             // known word
        if (/^[A-Z]{4,}$/.test(raw)) continue;   // acronyms
        if (seen.has(low)) continue;             // one marker per distinct word
        seen.add(low);
        state.targets.push({ node, offset: m.index, word: raw, el: null, found: false });
      }
    }
  }

  function rectFor(t) {
    try {
      const range = document.createRange();
      range.setStart(t.node, t.offset);
      range.setEnd(t.node, t.offset + t.word.length);
      const rects = range.getClientRects();
      return rects.length ? rects[0] : null;
    } catch (e) { return null; }
  }

  function placeMarkers() {
    state.targets.forEach((t, i) => {
      const chip = document.createElement('button');
      chip.textContent = (i + 1);
      chip.title = 'Click to reveal';
      chip.style.cssText =
        'position:fixed;pointer-events:auto;min-width:26px;height:26px;border-radius:13px;' +
        'background:#fbbf24;color:#1a1206;border:2px solid #fff3;font-weight:700;' +
        'font-size:13px;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.5);' +
        'transition:transform .15s;';
      chip.addEventListener('mouseenter', () => { chip.style.transform = 'scale(1.2)'; });
      chip.addEventListener('mouseleave', () => { chip.style.transform = 'scale(1)'; });
      chip.addEventListener('click', () => reveal(t, chip));
      t.el = chip;
      overlay.appendChild(chip);
    });
    layoutMarkers();
  }

  function layoutMarkers() {
    state.targets.forEach((t) => {
      if (t.found || !t.el) return;
      const r = rectFor(t);
      if (!r) { t.el.style.display = 'none'; return; }
      t.el.style.display = '';
      t.el.style.left = (r.left - 6) + 'px';
      t.el.style.top = (r.top - 20) + 'px';
    });
  }

  function reveal(t, chip) {
    if (t.found || !state.running) return;
    t.found = true;
    state.score += 10;
    hud.querySelector('#th-score').textContent = 'Score ' + state.score;
    chip.style.background = '#34d399';
    chip.style.color = '#0b1512';
    chip.textContent = t.word.length > 10 ? t.word.slice(0, 10) + '…' : t.word;
    chip.style.minWidth = 'auto';
    chip.style.padding = '0 8px';
    chip.style.pointerEvents = 'none';
    setTimeout(() => { if (chip.parentNode) chip.parentNode.removeChild(chip); }, 1200);
    if (state.targets.every(x => x.found)) end(true);
  }

  function hint() {
    if (state.hints <= 0 || !state.running) return;
    const rest = state.targets.filter(t => !t.found && t.el);
    if (!rest.length) return;
    state.hints--;
    hud.querySelector('#th-hint').textContent = 'Hint (' + state.hints + ')';
    const t = rest[Math.floor(Math.random() * rest.length)];
    t.el.animate(
      [{ transform: 'scale(1)' }, { transform: 'scale(1.8)' }, { transform: 'scale(1)' }],
      { duration: 600, iterations: 3 }
    );
  }

  /* ---------------- game flow ---------------- */
  function updateTime() {
    hud.querySelector('#th-time').textContent = state.timeLeft + 's';
  }

  function end(finished) {
    if (!state.running) return;
    state.running = false;
    clearInterval(state.timer);
    const panel = document.createElement('div');
    panel.style.cssText =
      'position:fixed;inset:0;pointer-events:auto;display:flex;align-items:center;justify-content:center;' +
      'background:rgba(5,5,10,.7);';
    const found = state.targets.filter(t => t.found).length;
    panel.innerHTML =
      '<div style="background:rgba(20,20,26,.95);border:1px solid #3a3a46;border-radius:16px;' +
      'padding:28px;text-align:center;color:#e8e8f0;backdrop-filter:blur(12px)">' +
      '<h2 style="margin:0 0 10px">Hunt ' + (finished ? 'complete!' : 'over') + '</h2>' +
      '<p style="font-size:28px;font-weight:700;color:#fbbf24;margin:0 0 6px">Score: ' + state.score + '</p>' +
      '<p style="color:#a8a8bd;margin:0 0 18px">Found ' + found + ' of ' + state.targets.length + ' typos</p>' +
      '<button id="th-close" style="background:#fbbf24;color:#1a1206;border:none;border-radius:10px;' +
      'padding:10px 24px;font-weight:700;cursor:pointer">Close</button></div>';
    overlay.appendChild(panel);
    panel.querySelector('#th-close').addEventListener('click', stop);
    chrome.storage.local.get({ thBest: 0 }, (r) => {
      if (state.score > r.thBest) chrome.storage.local.set({ thBest: state.score });
    });
  }

  function stop() {
    state.running = false;
    clearInterval(state.timer);
    document.removeEventListener('keydown', onKey, true);
    window.removeEventListener('scroll', layoutMarkers, true);
    window.removeEventListener('resize', layoutMarkers);
    if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    if (window.__typoHunt === api) delete window.__typoHunt;
  }

  function onKey(e) {
    if (e.key === 'Escape') stop();
  }

  const api = { stop };
  window.__typoHunt = api;

  /* ---------------- boot ---------------- */
  scan();
  if (!state.targets.length) {
    // Nothing found: show a friendly note, then clean up.
    hud.querySelector('#th-score').textContent = 'No typos found — nice page!';
    setTimeout(stop, 2500);
    return;
  }
  placeMarkers();
  document.addEventListener('keydown', onKey, true);
  window.addEventListener('scroll', layoutMarkers, true);
  window.addEventListener('resize', layoutMarkers);
  hud.querySelector('#th-quit').addEventListener('click', stop);
  hud.querySelector('#th-hint').addEventListener('click', hint);
  state.timer = setInterval(() => {
    state.timeLeft--;
    updateTime();
    if (state.timeLeft <= 0) end(false);
  }, 1000);
})();
