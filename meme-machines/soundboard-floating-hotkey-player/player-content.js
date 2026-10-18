/* SoundBoard floating mini player.
 * Injected into the active tab ONLY when the user clicks "Toggle floating
 * mini player" in the popup. Injecting again removes it (toggle behavior).
 * All sounds synthesized with the page's Web Audio API — no files, no network.
 * Runs in the page's isolated world; styles are namespaced with sbmp- prefix.
 */
(function () {
  'use strict';

  const PANEL_ID = 'sbmp-panel';

  // Toggle: remove if already open.
  const existing = document.getElementById(PANEL_ID);
  if (existing) { existing.remove(); return; }

  /* ---------------- audio engine (self-contained copy) ---------------- */

  let actx = null, master = null, noiseB = null;

  function ctx() {
    if (!actx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      actx = new AC();
      master = actx.createGain();
      master.gain.value = currentVolume;
      master.connect(actx.destination);
    }
    if (actx.state === 'suspended') actx.resume();
    return actx;
  }

  function noise(c) {
    if (!noiseB) {
      noiseB = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
      const d = noiseB.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    return noiseB;
  }

  function env(g, t, peak, a, d) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
  }

  function mk(t, type, freq, peak, a, d, freqEnd) {
    const c = ctx();
    const o = c.createOscillator(), g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (freqEnd) o.frequency.exponentialRampToValueAtTime(freqEnd, t + a + d);
    env(g, t, peak, a, d);
    o.connect(g).connect(master);
    o.start(t); o.stop(t + a + d + 0.1);
    return { c, o };
  }

  const SYNTHS = {
    airhorn(c, d, t) {
      const dur = 1.1;
      const lfo = c.createOscillator(), lg = c.createGain();
      lfo.frequency.value = 30; lg.gain.value = 12;
      lfo.connect(lg); lfo.start(t); lfo.stop(t + dur);
      [233.1, 466.2, 349.2].forEach((f, i) => {
        const o = c.createOscillator(), g = c.createGain();
        o.type = 'sawtooth'; o.frequency.value = f;
        lg.connect(o.frequency);
        env(g, t, 0.22 - i * 0.05, 0.02, dur);
        o.connect(g).connect(d);
        o.start(t); o.stop(t + dur + 0.1);
      });
    },
    drum(c, d, t) {
      mk(t, 'sine', 160, 0.9, 0.004, 0.28, 45);
      const n = c.createBufferSource(); n.buffer = noise(c);
      const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 3000;
      const g = c.createGain(); env(g, t, 0.25, 0.002, 0.06);
      n.connect(hp).connect(g).connect(d); n.start(t); n.stop(t + 0.1);
    },
    laser(c, d, t) { mk(t, 'sawtooth', 1800, 0.5, 0.005, 0.55, 120); },
    pop(c, d, t) { mk(t, 'sine', 700, 0.6, 0.003, 0.09, 1400); },
    applause(c, d, t) {
      for (let i = 0; i < 60; i++) {
        const s = t + Math.random() * 1.6;
        const n = c.createBufferSource(); n.buffer = noise(c);
        n.playbackRate.value = 0.8 + Math.random() * 0.6;
        const bp = c.createBiquadFilter(); bp.type = 'bandpass';
        bp.frequency.value = 1200 + Math.random() * 2800; bp.Q.value = 1.2;
        const g = c.createGain(); env(g, s, 0.16, 0.005, 0.05 + Math.random() * 0.08);
        n.connect(bp).connect(g).connect(d); n.start(s); n.stop(s + 0.2);
      }
    },
    siren(c, d, t) {
      const dur = 2.0, cc = ctx();
      const o = cc.createOscillator(); o.type = 'triangle'; o.frequency.value = 700;
      const lfo = cc.createOscillator(); lfo.type = 'square'; lfo.frequency.value = 0.9;
      const lg = cc.createGain(); lg.gain.value = 260;
      lfo.connect(lg).connect(o.frequency);
      const g = cc.createGain(); env(g, t, 0.4, 0.05, dur);
      o.connect(g).connect(d);
      o.start(t); o.stop(t + dur + 0.1); lfo.start(t); lfo.stop(t + dur + 0.1);
    },
    whistle(c, d, t) {
      const dur = 0.9, cc = ctx();
      const o = cc.createOscillator(); o.type = 'sine'; o.frequency.value = 2200;
      const vib = cc.createOscillator(); vib.frequency.value = 25;
      const vg = cc.createGain(); vg.gain.value = 180;
      vib.connect(vg).connect(o.frequency);
      const g = cc.createGain(); env(g, t, 0.35, 0.02, dur);
      o.connect(g).connect(d);
      o.start(t); o.stop(t + dur + 0.1); vib.start(t); vib.stop(t + dur + 0.1);
    },
    bell(c, d, t) {
      [[523.25, 0.5], [783.99, 0.28], [1046.5, 0.18], [1567.98, 0.08]].forEach(([f, a]) => {
        const o = c.createOscillator(), g = c.createGain();
        o.type = 'sine'; o.frequency.value = f;
        env(g, t, a, 0.005, 1.8);
        o.connect(g).connect(d); o.start(t); o.stop(t + 2.0);
      });
    },
  };

  const BUTTONS = [
    ['airhorn', 'Airhorn', '1'], ['drum', 'Drum', '2'],
    ['laser', 'Laser', '3'], ['pop', 'Pop', '4'],
    ['applause', 'Applause', '5'], ['siren', 'Siren', '6'],
    ['whistle', 'Whistle', '7'], ['bell', 'Bell', '8'],
  ];

  /* ---------------- volume (shared with popup via storage) ---------------- */

  let currentVolume = 0.8;
  try {
    chrome.storage.local.get('sbVolume', r => {
      if (r && typeof r.sbVolume === 'number') {
        currentVolume = r.sbVolume / 100;
        if (master) master.gain.value = currentVolume;
        const s = document.getElementById('sbmp-vol');
        if (s) s.value = r.sbVolume;
      }
    });
  } catch (e) { /* storage unavailable — keep default */ }

  /* ---------------- panel UI ---------------- */

  const style = document.createElement('style');
  style.textContent = `
    #${PANEL_ID} { position: fixed; right: 16px; bottom: 16px; z-index: 2147483647;
      width: 240px; padding: 10px; border-radius: 14px;
      background: rgba(20,20,26,.85); backdrop-filter: blur(12px);
      border: 1px solid rgba(255,255,255,.1);
      font-family: -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;
      color: #f4f4f5; box-shadow: 0 8px 32px rgba(0,0,0,.5); }
    #${PANEL_ID} .sbmp-head { display: flex; align-items: center; gap: 6px;
      cursor: grab; user-select: none; margin-bottom: 8px; }
    #${PANEL_ID} .sbmp-title { font-size: 12px; font-weight: 700; flex: 1;
      color: #f97316; }
    #${PANEL_ID} .sbmp-x { background: none; border: none; color: #a1a1aa;
      cursor: pointer; font-size: 16px; line-height: 1; padding: 2px 6px; }
    #${PANEL_ID} .sbmp-x:hover { color: #f4f4f5; }
    #${PANEL_ID} .sbmp-grid { display: grid; grid-template-columns: 1fr 1fr;
      gap: 6px; margin-bottom: 8px; }
    #${PANEL_ID} .sbmp-b { padding: 8px 4px; border-radius: 8px; border: 1px solid rgba(255,255,255,.08);
      background: rgba(255,255,255,.04); color: #f4f4f5; font-size: 11px;
      font-weight: 600; cursor: pointer; }
    #${PANEL_ID} .sbmp-b:hover { border-color: #f97316; background: rgba(249,115,22,.14); }
    #${PANEL_ID} .sbmp-b:active { transform: scale(.95); }
    #${PANEL_ID} .sbmp-volrow { display: flex; align-items: center; gap: 8px; }
    #${PANEL_ID} .sbmp-volrow input { flex: 1; accent-color: #f97316; cursor: pointer; }
    #${PANEL_ID} .sbmp-volrow span { font-size: 10px; color: #a1a1aa; }
  `;
  document.documentElement.appendChild(style);

  const panel = document.createElement('div');
  panel.id = PANEL_ID;

  const head = document.createElement('div');
  head.className = 'sbmp-head';
  const title = document.createElement('div');
  title.className = 'sbmp-title';
  title.textContent = 'SoundBoard';
  const x = document.createElement('button');
  x.className = 'sbmp-x';
  x.textContent = '×';
  x.title = 'Close mini player';
  x.addEventListener('click', () => panel.remove());
  head.appendChild(title); head.appendChild(x);

  // Drag support on the header.
  let drag = null;
  head.addEventListener('mousedown', e => {
    if (e.target === x) return;
    const r = panel.getBoundingClientRect();
    drag = { dx: e.clientX - r.left, dy: e.clientY - r.top };
    head.style.cursor = 'grabbing';
    e.preventDefault();
  });
  document.addEventListener('mousemove', e => {
    if (!drag) return;
    panel.style.left = (e.clientX - drag.dx) + 'px';
    panel.style.top = (e.clientY - drag.dy) + 'px';
    panel.style.right = 'auto'; panel.style.bottom = 'auto';
  });
  document.addEventListener('mouseup', () => { drag = null; head.style.cursor = 'grab'; });

  const grid = document.createElement('div');
  grid.className = 'sbmp-grid';
  BUTTONS.forEach(([id, name, key]) => {
    const b = document.createElement('button');
    b.className = 'sbmp-b';
    b.textContent = `${key} · ${name}`;
    b.title = `Play ${name} (hotkey ${key})`;
    b.addEventListener('click', () => {
      const c = ctx();
      SYNTHS[id](c, master, c.currentTime);
      b.style.transform = 'scale(.95)';
      setTimeout(() => b.style.transform = '', 150);
    });
    grid.appendChild(b);
  });

  const volrow = document.createElement('div');
  volrow.className = 'sbmp-volrow';
  const vol = document.createElement('input');
  vol.type = 'range'; vol.min = '0'; vol.max = '100'; vol.value = '80'; vol.id = 'sbmp-vol';
  vol.addEventListener('input', () => {
    currentVolume = vol.value / 100;
    if (master) master.gain.value = currentVolume;
    try { chrome.storage.local.set({ sbVolume: Number(vol.value) }); } catch (e) {}
  });
  const vlab = document.createElement('span');
  vlab.textContent = 'Vol';
  volrow.appendChild(vlab); volrow.appendChild(vol);

  panel.appendChild(head); panel.appendChild(grid); panel.appendChild(volrow);
  document.documentElement.appendChild(panel);
})();
