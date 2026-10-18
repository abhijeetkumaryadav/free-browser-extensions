// tiedye.js — self-contained content script (no eval/new Function, MV3-CSP safe).
// Injected on demand by the popup via chrome.scripting.executeScript (func + args).
(() => {
  const ROOT_ID = 'tiedye-root';
  const STYLE_ID = 'tiedye-style';
  const NOTE_ID = 'tiedye-note';

  const PALETTES = {
    rainbow:   ['#ff004c', '#ff8a00', '#ffee00', '#00e676', '#00b0ff', '#7c4dff', '#ff00e5'],
    pastel:    ['#ffd1dc', '#ffe5b4', '#fff3b0', '#c1f0c8', '#bde0fe', '#d7bde2', '#ffc6ff'],
    neon:      ['#ff073a', '#ff5f1f', '#ffee00', '#39ff14', '#00f5d4', '#4361ee', '#9b5de5'],
    inferno:   ['#ff3d00', '#ff9100', '#ffd600', '#ffea00', '#c51162', '#aa00ff', '#304ffe'],
    ocean:     ['#00e5ff', '#00b0ff', '#2979ff', '#3d5afe', '#00e676', '#76ff03', '#18ffff'],
    grayscale: ['#111111', '#333333', '#555555', '#777777', '#999999', '#bbbbbb', '#dddddd']
  };

  function stop() {
    const root = document.getElementById(ROOT_ID);
    if (root) root.remove();
    const style = document.getElementById(STYLE_ID);
    if (style) style.remove();
    const note = document.getElementById(NOTE_ID);
    if (note) note.remove();
  }

  function start(paletteName, speedMs, blendMode) {
    stop();
    const palette = PALETTES[paletteName] || PALETTES.rainbow;

    // Styles for the overlay + the prank note toast.
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = [
      `#${ROOT_ID} { position: fixed; inset: 0; z-index: 2147483646; pointer-events: none; opacity: 0.55; mix-blend-mode: ${blendMode}; }`,
      `#${ROOT_ID} .tiedye-layer { position: absolute; inset: -60%; }`,
      `#${NOTE_ID} { position: fixed; bottom: 18px; right: 18px; z-index: 2147483647;`,
      `  background: rgba(20,20,26,.85); color: #fff; border: 1px solid rgba(255,255,255,.18);`,
      `  border-radius: 12px; padding: 10px 14px; font: 500 13px/1.4 system-ui, sans-serif;`,
      `  box-shadow: 0 8px 24px rgba(0,0,0,.45); pointer-events: none; }`,
      `#${NOTE_ID} b { color: #ff4ecd; }`
    ].join('\n');
    document.documentElement.appendChild(style);

    // One absolutely-positioned layer per palette color: they rotate through
    // the hue wheel at different rates for the tie-dye / lava-lamp effect.
    const root = document.createElement('div');
    root.id = ROOT_ID;
    root.setAttribute('aria-hidden', 'true');
    palette.forEach((color, i) => {
      const layer = document.createElement('div');
      layer.className = 'tiedye-layer';
      const size = 40 + i * 14;
      const offset = (i / palette.length) * 360;
      layer.style.background =
        `radial-gradient(circle at ${20 + i * 11}% ${30 + i * 9}%, ${color} 0%, transparent ${size}%)`;
      layer.style.filter = `hue-rotate(${offset}deg)`;
      layer.style.animation = `tiedye-spin ${speedMs}ms linear infinite ${i % 2 ? 'reverse' : ''}`;
      root.appendChild(layer);
    });
    document.documentElement.appendChild(root);

    // Keyframes injected into the same style tag.
    style.textContent += `\n@keyframes tiedye-spin { to { transform: rotate(360deg); } }`;

    // Cute little label so people know it's a prank and how to stop it.
    const note = document.createElement('div');
    note.id = NOTE_ID;
    const strong = document.createElement('b');
    strong.textContent = '🌈 TieDye';
    note.appendChild(strong);
    note.appendChild(document.createTextNode(' — page is dyeing! Open the popup to stop.'));
    document.documentElement.appendChild(note);
  }

  // Exposed entry point: the popup passes { mode, palette, speed, blend }.
  globalThis.__tiedye = globalThis.__tiedye || {};
  globalThis.__tiedye.run = (opts) => {
    if (opts && opts.mode === 'stop') return stop();
    start(opts.palette, opts.speed, opts.blend);
  };
})();
