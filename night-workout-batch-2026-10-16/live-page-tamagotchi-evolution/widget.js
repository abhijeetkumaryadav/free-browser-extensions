/* =========================================================================
 * TamaBloom — on-page mini widget (injected on demand via chrome.scripting)
 * Exposes: window.summonTamaWidget(state)
 *
 * A small draggable floating card showing the pet + its weakest meter.
 * Refreshes from chrome.storage every minute. Shadow-DOM isolated.
 * ========================================================================= */

(function () {
  'use strict';

  var ROOT_ID = 'tama-widget-root';
  var STAGE_NAMES = ['Egg', 'Baby', 'Child', 'Teen', 'Adult'];
  var HUES = ['#fbbf24', '#f472b6', '#a78bfa', '#60a5fa', '#34d399'];

  /* Compact pet drawing (independent of popup.js so the widget is standalone). */
  function miniSVG(stage, mood) {
    var c = HUES[stage];
    var ink = '#292524';
    var face;
    if (mood === 'happy') {
      face = '<path d="M44 60 q6 -7 12 0 M64 60 q6 -7 12 0" stroke="' + ink + '" stroke-width="3.4" fill="none" stroke-linecap="round"/>' +
             '<path d="M54 72 q6 6 12 0" stroke="' + ink + '" stroke-width="3" fill="none" stroke-linecap="round"/>';
    } else if (mood === 'sleepy') {
      face = '<path d="M44 60 q6 5 12 0 M64 60 q6 5 12 0" stroke="' + ink + '" stroke-width="3.4" fill="none" stroke-linecap="round"/>' +
             '<text x="86" y="46" font-size="15" fill="#c4b5fd" font-weight="700">z</text>';
    } else if (mood === 'sad' || mood === 'grumpy') {
      face = '<circle cx="50" cy="60" r="4" fill="' + ink + '"/><circle cx="70" cy="60" r="4" fill="' + ink + '"/>' +
             '<path d="M54 76 q6 -5 12 0" stroke="' + ink + '" stroke-width="3" fill="none" stroke-linecap="round"/>';
    } else {
      face = '<circle cx="50" cy="60" r="4.2" fill="' + ink + '"/><circle cx="70" cy="60" r="4.2" fill="' + ink + '"/>' +
             '<path d="M55 72 q5 3 10 0" stroke="' + ink + '" stroke-width="2.6" fill="none" stroke-linecap="round"/>';
    }
    var extras = '';
    if (stage >= 2) extras += '<circle cx="26" cy="34" r="8" fill="' + c + '"/><circle cx="94" cy="34" r="8" fill="' + c + '"/>';
    if (stage >= 3) extras += '<path d="M94 78 q24 6 18 -16" stroke="' + c + '" stroke-width="10" fill="none" stroke-linecap="round"/>';
    return '<svg viewBox="0 0 120 112" style="width:64px;height:60px">' + extras +
      '<ellipse cx="60" cy="64" rx="36" ry="38" fill="' + c + '"/>' +
      '<ellipse cx="60" cy="78" rx="20" ry="18" fill="#fff" opacity="0.28"/>' + face + '</svg>';
  }

  window.summonTamaWidget = function (initial) {
    if (document.getElementById(ROOT_ID)) { window.dismissTamaWidget(); return 'toggled-off'; }

    var root = document.createElement('div');
    root.id = ROOT_ID;
    var shadow = root.attachShadow({ mode: 'open' });
    shadow.innerHTML = `
      <style>
        :host { all: initial; }
        .tw {
          position: fixed; right: 14px; bottom: 14px; z-index: 2147483647;
          width: 118px; padding: 8px; border-radius: 14px;
          background: rgba(20,20,26,0.82); backdrop-filter: blur(10px);
          border: 1px solid rgba(255,255,255,0.12); color: #f4f4f5;
          font: 11px -apple-system, "Segoe UI", sans-serif; text-align: center;
          cursor: grab; user-select: none; box-shadow: 0 8px 24px rgba(0,0,0,0.45);
        }
        .tw:active { cursor: grabbing; }
        .tw .nm { font-weight: 700; font-size: 11.5px; margin-top: 2px;
                  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .tw .st { color: #a78bfa; font-size: 10px; }
        .tw .bar { height: 6px; border-radius: 99px; background: rgba(255,255,255,0.1); margin-top: 6px; overflow: hidden; }
        .tw .fill { height: 100%; border-radius: 99px; background: linear-gradient(90deg,#f59e0b,#fbbf24); transition: width .5s; }
        .tw .x { position: absolute; top: 2px; right: 7px; cursor: pointer; color: #a1a1aa; font-size: 13px; }
        .tw .x:hover { color: #fff; }
        @keyframes tw-bob { 0%,100% { transform: translateY(0);} 50% { transform: translateY(-4px);} }
        .tw .pet { animation: tw-bob 3s ease-in-out infinite; }
      </style>
      <div class="tw" id="twCard">
        <span class="x" id="twClose" title="Hide mini-pet">×</span>
        <div class="pet" id="twPet"></div>
        <div class="nm" id="twName">Pixel</div>
        <div class="st" id="twStage">Egg</div>
        <div class="bar"><div class="fill" id="twFill"></div></div>
      </div>`;
    document.documentElement.appendChild(root);

    var card = shadow.getElementById('twCard');

    function paint(s) {
      if (!s) return;
      shadow.getElementById('twPet').innerHTML = miniSVG(s.stage, s.mood);
      shadow.getElementById('twName').textContent = s.name || 'Pixel';
      shadow.getElementById('twStage').textContent = STAGE_NAMES[s.stage] + ' · ' + s.mood;
      var weakest = Math.min(s.hunger, s.happiness, s.energy);
      shadow.getElementById('twFill').style.width = weakest + '%';
    }
    paint(initial);

    /* Pull fresh state every minute (background keeps decaying it). */
    var timer = setInterval(async function () {
      try {
        var res = await chrome.runtime.sendMessage({ type: 'getState' });
        if (res && res.ok) paint(res.state);
      } catch (e) { /* popup SW may be asleep; try again later */ }
    }, 60000);

    /* Drag to reposition */
    var drag = null;
    card.addEventListener('mousedown', function (e) {
      if (e.target.id === 'twClose') return;
      drag = { x: e.clientX - card.getBoundingClientRect().left, y: e.clientY - card.getBoundingClientRect().top };
      e.preventDefault();
    });
    document.addEventListener('mousemove', function (e) {
      if (!drag) return;
      card.style.left = (e.clientX - drag.x) + 'px';
      card.style.top = (e.clientY - drag.y) + 'px';
      card.style.right = 'auto'; card.style.bottom = 'auto';
    });
    document.addEventListener('mouseup', function () { drag = null; });

    shadow.getElementById('twClose').addEventListener('click', function () {
      window.dismissTamaWidget();
    });

    root._timer = timer;
    return 'summoned';
  };

  window.dismissTamaWidget = function () {
    var el = document.getElementById(ROOT_ID);
    if (el) { clearInterval(el._timer); el.remove(); }
    return 'dismissed';
  };
})();
