/* SnowFall — snow particle overlay content script.
 * Injected on demand by the popup. All DOM lives in a closed shadow root so
 * page styles/scripts are never touched. Fully self-contained: no imports. */

(function () {
  'use strict';

  // Idempotent: injecting twice must not duplicate anything.
  if (window.__snowfall) return;

  var HOST_ID = '__snowfall_overlay_host__';

  // ----- start/stop -----------------------------------------------------------

  // Options: { density, size, speed, wind, enabled }
  function startSnowfall(opts) {
    stopSnowfall(); // never double-inject

    // Host element in the light DOM, everything else in shadow DOM.
    var host = document.createElement('div');
    host.id = HOST_ID;
    host.setAttribute('aria-hidden', 'true');
    document.documentElement.appendChild(host);

    var shadow = host.attachShadow({ mode: 'open' });

    // Styles for the host itself: fixed, above everything, click-transparent.
    var style = document.createElement('style');
    style.textContent =
      '#' + HOST_ID + ' { position: fixed; inset: 0; z-index: 2147483647; pointer-events: none; }' +
      '#' + HOST_ID + ' canvas { display: block; width: 100%; height: 100%; pointer-events: none; }';
    shadow.appendChild(style);

    var canvas = document.createElement('canvas');
    shadow.appendChild(canvas);

    // Resize canvas to viewport (device-pixel-ratio aware).
    function fitCanvas() {
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(window.innerWidth * dpr);
      canvas.height = Math.floor(window.innerHeight * dpr);
    }
    fitCanvas();

    // ----- particle field ----------------------------------------------------
    var rng = function (a, b) { return a + Math.random() * (b - a); };

    var flakes = [];
    var targetCount = Math.round(opts.density); // 10..300

    function makeFlake(anywhere) {
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      return {
        x: rng(0, canvas.width),
        y: anywhere ? rng(0, canvas.height) : rng(-40, -10),
        // radius scaled by user size (0.5..3) with slight random spread
        r: rng(0.7, 1.6) * opts.size * dpr,
        // fall speed: base * user speed (0.2..3) * radius weight
        vy: rng(0.4, 1.4) * opts.speed,
        // sway phase/amplitude for the sinusoidal drift
        phase: rng(0, Math.PI * 2),
        swayAmp: rng(0.3, 1.6),
        swaySpeed: rng(0.005, 0.02),
        // slight opacity variety
        alpha: rng(0.55, 1)
      };
    }

    for (var i = 0; i < targetCount; i++) flakes.push(makeFlake(true));

    var ctx = canvas.getContext('2d');
    var rafId = 0;
    var running = true;

    // Wind: user value -50..50, maps to horizontal velocity px/frame.
    function windVx() { return (opts.wind / 50) * 1.2; }

    function frame() {
      if (!running) return;
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Keep flake count in sync if density changed mid-run.
      while (flakes.length < targetCount) flakes.push(makeFlake(false));
      if (flakes.length > targetCount) flakes.length = targetCount;

      var vx = windVx();
      for (var k = 0; k < flakes.length; k++) {
        var f = flakes[k];
        f.phase += f.swaySpeed;
        f.x += vx + Math.sin(f.phase) * f.swayAmp * 0.5;
        f.y += f.vy * f.r / (1.2 * dpr) + 0.4 * opts.speed;

        // Wrap around edges (wind can push flakes off the side).
        if (f.y > canvas.height + 20) { Object.assign(f, makeFlake(false)); f.y = rng(-40, -5); }
        if (f.x > canvas.width + 20) f.x = -20;
        if (f.x < -20) f.x = canvas.width + 20;

        ctx.globalAlpha = f.alpha;
        ctx.beginPath();
        ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      rafId = requestAnimationFrame(frame);
    }

    function onResize() { fitCanvas(); }
    window.addEventListener('resize', onResize);

    rafId = requestAnimationFrame(frame);

    // Expose a stop hook on the host so startSnowfall/stopSnowfall can
    // coordinate, and so the popup can query the live state.
    host._snowfallStop = function () {
      running = false;
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', onResize);
      if (host.parentNode) host.parentNode.removeChild(host);
    };
  }

  function stopSnowfall() {
    var host = document.getElementById(HOST_ID);
    if (host && host._snowfallStop) host._snowfallStop();
  }

  function isSnowing() {
    return !!document.getElementById(HOST_ID);
  }

  // ----- message bridge ------------------------------------------------------
  // Popup talks to this script through executeScript world:ISOLATED calls;
  // we also expose window-level hooks so the popup can drive it via
  // chrome.scripting.executeScript({ func: ... }) without messaging.

  window.__snowfall = {
    start: startSnowfall,
    stop: stopSnowfall,
    isActive: isSnowing
  };

  // If this file was injected with an autostart flag (see popup), begin now.
  if (window.__snowfallAutostart) {
    try { startSnowfall(window.__snowfallAutostart); } catch (e) { /* ignore */ }
    window.__snowfallAutostart = undefined;
  }
})();
