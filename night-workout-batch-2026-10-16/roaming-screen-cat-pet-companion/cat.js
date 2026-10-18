/* =========================================================================
 * Screen Cat — content script (injected on demand via chrome.scripting)
 * Exposes: window.summonScreenCat(prefs), window.dismissScreenCat()
 *
 * A cute SVG cat that roams the bottom of the page: walks, sits, grooms,
 * naps (with floating Zzz), and chases the cursor. All rendering lives in
 * a Shadow DOM so page styles can never interfere. 100% local, no network.
 * ========================================================================= */

(function () {
  'use strict';

  var ROOT_ID = 'screen-cat-root';

  /* ------------------------------------------------------------------ */
  /* Styles (injected into the shadow root)                              */
  /* ------------------------------------------------------------------ */
  function buildStyle(prefs) {
    return `
      :host { all: initial; }
      .sc-wrap {
        position: fixed; left: 60px; bottom: 14px;
        width: 140px; height: 112px;
        z-index: 2147483647; pointer-events: none;
        --fur: ${prefs.color};
        --fur-dark: ${prefs.color};
        transform: scale(${prefs.size});
        transform-origin: bottom left;
      }
      .sc-svg { width: 100%; height: 100%; overflow: visible; }
      .sc-svg.facing-left { transform: scaleX(-1); }
      .sc-dark { filter: brightness(0.78); }

      /* Tail wag */
      .sc-tail { transform-box: fill-box; transform-origin: 85% 90%; animation: sc-tailwag 1.6s ease-in-out infinite; }
      @keyframes sc-tailwag { 0%,100% { transform: rotate(-8deg); } 50% { transform: rotate(14deg); } }

      /* Walking legs */
      .sc-wrap[data-state="walk"] .sc-leg.fl, .sc-wrap[data-state="chase"] .sc-leg.fl,
      .sc-wrap[data-state="walk"] .sc-leg.br, .sc-wrap[data-state="chase"] .sc-leg.br { animation: sc-step 0.42s ease-in-out infinite; }
      .sc-wrap[data-state="walk"] .sc-leg.fr, .sc-wrap[data-state="chase"] .sc-leg.fr,
      .sc-wrap[data-state="walk"] .sc-leg.bl, .sc-wrap[data-state="chase"] .sc-leg.bl { animation: sc-step 0.42s ease-in-out -0.21s infinite; }
      .sc-wrap[data-state="chase"] .sc-leg { animation-duration: 0.26s !important; }
      @keyframes sc-step { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-9px); } }

      /* Body bob while moving */
      .sc-wrap[data-state="walk"] .sc-bod, .sc-wrap[data-state="chase"] .sc-bod { animation: sc-bob 0.42s ease-in-out infinite; }
      @keyframes sc-bob { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-3px); } }

      /* Blinking */
      .sc-eye { transform-box: fill-box; transform-origin: center; animation: sc-blink 4.2s ease-in-out infinite; }
      @keyframes sc-blink { 0%, 93%, 100% { transform: scaleY(1); } 95.5% { transform: scaleY(0.08); } }

      /* Sleeping pose */
      .sc-eyes-closed, .sc-zzz { display: none; }
      .sc-wrap[data-state="sleep"] .sc-eyes-open { display: none; }
      .sc-wrap[data-state="sleep"] .sc-eyes-closed { display: block; }
      .sc-wrap[data-state="sleep"] .sc-legs { opacity: 0.25; }
      .sc-wrap[data-state="sleep"] .sc-bod { animation: sc-breathe 2.6s ease-in-out infinite; }
      @keyframes sc-breathe { 0%,100% { transform: scaleY(1); } 50% { transform: scaleY(1.045); } }
      .sc-wrap[data-state="sleep"] .sc-zzz { display: block; animation: sc-zfloat 2.8s ease-in infinite; fill: #c4b5fd; font: 700 15px sans-serif; }
      .sc-wrap[data-state="sleep"] .sc-zzz.z2 { animation-delay: 1.4s; }
      @keyframes sc-zfloat { 0% { opacity: 0; transform: translateY(6px); } 25% { opacity: 1; } 100% { opacity: 0; transform: translateY(-26px); } }

      /* Sitting pose */
      .sc-wrap[data-state="sit"] .sc-legs { transform: translateY(4px); }

      /* Grooming: head tilts toward paw */
      .sc-wrap[data-state="groom"] .sc-head { transform-box: fill-box; transform-origin: 30% 80%; animation: sc-groom 1.1s ease-in-out infinite; }
      @keyframes sc-groom { 0%,100% { transform: rotate(0deg) translateY(0); } 50% { transform: rotate(-16deg) translateY(7px); } }

      /* Pounce squash (brief, set from JS) */
      .sc-wrap.pounce .sc-svg { animation: sc-pounce 0.45s ease-out; }
      @keyframes sc-pounce { 0% { transform: scaleY(0.72); } 45% { transform: scaleY(1.12) translateY(-14px); } 100% { transform: none; } }

      @media (prefers-reduced-motion: reduce) {
        .sc-tail, .sc-leg, .sc-bod, .sc-eye, .sc-head { animation: none !important; }
      }
    `;
  }

  /* ------------------------------------------------------------------ */
  /* Cat markup                                                          */
  /* ------------------------------------------------------------------ */
  function buildSVG() {
    return `
    <svg class="sc-svg" viewBox="0 0 140 112" aria-hidden="true">
      <path class="sc-tail" d="M30 80 C 10 76, 6 54, 20 40"
            stroke="var(--fur)" stroke-width="10" fill="none" stroke-linecap="round"/>
      <g class="sc-legs">
        <g class="sc-legs-back">
          <rect class="sc-leg bl sc-dark" x="44" y="80" width="11" height="24" rx="5" fill="var(--fur)"/>
          <rect class="sc-leg br sc-dark" x="88" y="80" width="11" height="24" rx="5" fill="var(--fur)"/>
        </g>
        <ellipse class="sc-bod" cx="70" cy="68" rx="40" ry="27" fill="var(--fur)"/>
        <ellipse cx="70" cy="77" rx="23" ry="15" fill="#ffffff" opacity="0.22"/>
        <g class="sc-legs-front">
          <rect class="sc-leg fl" x="57" y="82" width="11" height="22" rx="5" fill="var(--fur)"/>
          <rect class="sc-leg fr" x="75" y="82" width="11" height="22" rx="5" fill="var(--fur)"/>
        </g>
      </g>
      <g class="sc-head">
        <polygon points="92,36 100,12 113,31" fill="var(--fur)"/>
        <polygon points="117,31 129,12 133,37" fill="var(--fur)"/>
        <polygon points="98,29 102,19 109,28" fill="#f9a8d4"/>
        <polygon points="120,28 125,19 129,29" fill="#f9a8d4"/>
        <circle cx="112" cy="47" r="21" fill="var(--fur)"/>
        <g class="sc-eyes-open">
          <ellipse class="sc-eye" cx="106" cy="45" rx="3.4" ry="4.6" fill="#1c1917"/>
          <ellipse class="sc-eye" cx="121" cy="45" rx="3.4" ry="4.6" fill="#1c1917"/>
          <circle cx="107" cy="43.5" r="1.1" fill="#fff"/>
          <circle cx="122" cy="43.5" r="1.1" fill="#fff"/>
        </g>
        <g class="sc-eyes-closed" stroke="#1c1917" stroke-width="2" stroke-linecap="round">
          <path d="M102 45 q 4 3 8 0"/>
          <path d="M117 45 q 4 3 8 0"/>
        </g>
        <polygon points="111,55 116,55 113.5,58.5" fill="#f9a8d4"/>
        <path d="M113.5 58.5 q -3 4 -7.5 2 M113.5 58.5 q 3 4 7.5 2"
              stroke="#1c1917" fill="none" stroke-width="1.6" stroke-linecap="round"/>
        <g stroke="#ffffff" stroke-width="1.2" opacity="0.75" stroke-linecap="round">
          <line x1="93" y1="51" x2="79" y2="47"/><line x1="93" y1="56" x2="80" y2="57"/>
          <line x1="131" y1="51" x2="144" y2="47"/><line x1="131" y1="56" x2="144" y2="57"/>
        </g>
      </g>
      <text class="sc-zzz z1" x="130" y="26">Z</text>
      <text class="sc-zzz z2" x="140" y="14">Z</text>
    </svg>`;
  }

  /* ------------------------------------------------------------------ */
  /* Summon / dismiss                                                    */
  /* ------------------------------------------------------------------ */
  window.summonScreenCat = function (prefs) {
    if (document.getElementById(ROOT_ID)) return 'already-present';
    prefs = Object.assign({ color: '#f59e0b', size: 1, chase: true }, prefs || {});

    var root = document.createElement('div');
    root.id = ROOT_ID;
    var shadow = root.attachShadow({ mode: 'open' });

    var style = document.createElement('style');
    style.textContent = buildStyle(prefs);
    var wrap = document.createElement('div');
    wrap.className = 'sc-wrap';
    wrap.dataset.state = 'walk';
    wrap.innerHTML = buildSVG();
    shadow.appendChild(style);
    shadow.appendChild(wrap);
    document.documentElement.appendChild(root);

    var svg = wrap.querySelector('.sc-svg');

    /* --- movement + behaviour state machine --- */
    var x = 60 + Math.random() * 120;
    var dir = Math.random() < 0.5 ? -1 : 1;
    var state = 'walk';
    var stateUntil = performance.now() + 2500;
    var mouseX = null;
    var lastT = performance.now();

    document.addEventListener('mousemove', function (e) { mouseX = e.clientX; });

    function setState(next, ms) {
      state = next;
      wrap.dataset.state = next;
      svg.classList.toggle('facing-left', dir < 0);
      stateUntil = performance.now() + ms;
    }

    function pickState() {
      var r = Math.random();
      var chaseOk = prefs.chase && mouseX !== null && Math.abs(mouseX - x) > 90;
      if (chaseOk && r < 0.38) {
        setState('chase', 3500 + Math.random() * 4000);
      } else if (r < 0.58) {
        setState('walk', 3000 + Math.random() * 5000);
      } else if (r < 0.72) {
        setState('sit', 2200 + Math.random() * 2800);
      } else if (r < 0.86) {
        setState('groom', 2400 + Math.random() * 2400);
      } else {
        setState('sleep', 6000 + Math.random() * 7000);
      }
      /* Occasional playful pounce while walking */
      if ((state === 'walk' || state === 'chase') && Math.random() < 0.3) {
        wrap.classList.remove('pounce');
        void wrap.offsetWidth; /* restart animation */
        wrap.classList.add('pounce');
      }
    }

    function frame(t) {
      if (!document.getElementById(ROOT_ID)) return; /* dismissed */
      var dt = Math.min(0.05, (t - lastT) / 1000);
      lastT = t;

      if (t > stateUntil) pickState();

      var maxX = Math.max(10, window.innerWidth - 170 * prefs.size);
      if (state === 'chase' && mouseX !== null) {
        dir = mouseX > x + 70 ? 1 : -1;
        x += dir * 165 * dt;
        if (Math.abs(mouseX - (x + 70)) < 24) pickState(); /* caught it */
      } else if (state === 'walk') {
        x += dir * 62 * dt;
      }
      if (x < 8) { x = 8; dir = 1; }
      if (x > maxX) { x = maxX; dir = -1; }

      wrap.style.left = x + 'px';
      svg.classList.toggle('facing-left', dir < 0);
      requestAnimationFrame(frame);
    }

    wrap.style.left = x + 'px';
    requestAnimationFrame(frame);
    return 'summoned';
  };

  window.dismissScreenCat = function () {
    var el = document.getElementById(ROOT_ID);
    if (el) el.remove();
    return 'dismissed';
  };
})();
