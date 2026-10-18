/* Geocities Rewind — apply script (injected on user click).
 * Self-contained: restyles the page like a 1999 Geocities site and adds
 * removable banner, starry overlay, rainbow dividers and a visitor counter.
 * All additions use the gr-geo-el / gr-geo markers so restore-geo.js can
 * remove them cleanly. */
(() => {
  'use strict';

  // Idempotent: clear any previous application first.
  document.querySelectorAll('.gr-geo-el, #gr-style').forEach((el) => el.remove());
  document.body.classList.remove('gr-geo');

  // --- 1. Stylesheet -------------------------------------------------------
  const css = `
    body.gr-geo {
      background: #000011 !important;
      color: #ffff00 !important;
      font-family: "Times New Roman", Times, serif !important;
    }
    body.gr-geo h1, body.gr-geo h2, body.gr-geo h3,
    body.gr-geo h4, body.gr-geo h5, body.gr-geo h6 {
      color: #00ff00 !important;
      text-decoration: underline !important;
      animation: gr-blink 1.1s steps(2, start) infinite;
    }
    body.gr-geo p, body.gr-geo div, body.gr-geo span, body.gr-geo li,
    body.gr-geo td, body.gr-geo th {
      color: #ffff00 !important;
      font-family: "Times New Roman", Times, serif !important;
    }
    body.gr-geo a { color: #00ffff !important; }
    body.gr-geo a:visited { color: #ff00ff !important; }
    body.gr-geo img {
      border: 6px ridge #ff00ff !important;
      image-rendering: pixelated;
    }
    @keyframes gr-blink { 50% { opacity: 0; } }
    .gr-stars {
      position: fixed !important; inset: 0 !important;
      pointer-events: none !important; z-index: 2147483000 !important;
      background-image:
        radial-gradient(1px 1px at 10% 20%, #ffffff 60%, transparent 61%),
        radial-gradient(1.5px 1.5px at 80% 10%, #ffffaa 60%, transparent 61%),
        radial-gradient(1px 1px at 40% 70%, #ffffff 60%, transparent 61%),
        radial-gradient(1.5px 1.5px at 90% 85%, #ffffff 60%, transparent 61%),
        radial-gradient(1px 1px at 60% 40%, #ffffff 60%, transparent 61%),
        radial-gradient(1px 1px at 25% 90%, #aaffff 60%, transparent 61%);
      background-size: 140px 140px;
      background-repeat: repeat;
    }
    .gr-banner {
      position: fixed; top: 0; left: 0; right: 0; z-index: 2147483001;
      background: #000; border-bottom: 4px solid #ff00ff;
      color: #ffff00; font-family: "Times New Roman", Times, serif;
      text-align: center; padding: 10px; font-size: 20px;
      font-weight: bold; letter-spacing: 2px;
    }
    .gr-banner .gr-blink {
      animation: gr-blink 1s steps(2, start) infinite; color: #ff3333;
    }
    .gr-rainbow {
      height: 10px !important; border: 0 !important; margin: 12px 0 !important;
      background: linear-gradient(90deg, #ff0000, #ff7f00, #ffff00, #00ff00, #0000ff, #8b00ff) !important;
    }
    .gr-counter {
      position: fixed; bottom: 12px; right: 12px; z-index: 2147483001;
      background: #000; border: 3px outset #00ff00; color: #00ff00;
      font-family: "Courier New", monospace; font-size: 14px; padding: 8px 12px;
    }
    .gr-spacer { height: 62px; }
  `;
  const style = document.createElement('style');
  style.id = 'gr-style';
  style.textContent = css;
  document.head.appendChild(style);

  // --- 2. Body hook --------------------------------------------------------
  document.body.classList.add('gr-geo');

  // --- 3. Starry tile overlay ----------------------------------------------
  const stars = document.createElement('div');
  stars.className = 'gr-stars gr-geo-el';
  document.body.appendChild(stars);

  // --- 4. "Under construction" banner + spacer ------------------------------
  const banner = document.createElement('div');
  banner.className = 'gr-banner gr-geo-el';
  banner.innerHTML =
    '<span class="gr-blink">*** UNDER CONSTRUCTION ***</span><br>' +
    '<span style="font-size:13px;letter-spacing:1px;">BEST VIEWED IN NETSCAPE NAVIGATOR 4.0 AT 800x600</span>';
  document.body.prepend(banner);

  const spacer = document.createElement('div');
  spacer.className = 'gr-spacer gr-geo-el';
  document.body.prepend(spacer);

  // --- 5. Rainbow dividers --------------------------------------------------
  const rainbowTop = document.createElement('hr');
  rainbowTop.className = 'gr-rainbow gr-geo-el';
  document.body.prepend(rainbowTop);

  const rainbowBottom = document.createElement('hr');
  rainbowBottom.className = 'gr-rainbow gr-geo-el';
  document.body.appendChild(rainbowBottom);

  // --- 6. Visitor counter ----------------------------------------------------
  const digits = String(Math.floor(100000 + Math.random() * 899999));
  const counter = document.createElement('div');
  counter.className = 'gr-counter gr-geo-el';
  counter.textContent = 'YOU ARE VISITOR #' + digits;
  document.body.appendChild(counter);
})();
