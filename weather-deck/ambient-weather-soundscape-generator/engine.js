/* AmbienceEngine — 100% WebAudio-synthesized weather sounds.
 * No audio files, no network. Pure math: filtered noise + scheduled envelopes.
 * Shared by the offscreen document (background playback, Chromium) and the
 * popup fallback (Firefox, where offscreen documents don't exist). */
'use strict';

const AmbienceEngine = (() => {
  let ctx = null;        // AudioContext, created on first user gesture
  let master = null;     // master GainNode
  let whiteBuf = null;   // 2s white-noise buffer
  let brownBuf = null;   // 2s brown-noise buffer
  const active = {};     // key -> { setVol(v), dispose() }
  const vols = { rain: 0.6, thunder: 0.6, wind: 0.6, fire: 0.6 };

  /* ---------- helpers ---------- */
  const rand = (a, b) => a + Math.random() * (b - a);
  // perceptual-ish volume curve: 0..1 -> gain
  const toGain = (v) => Math.pow(Math.max(0, Math.min(1, v)), 1.6) * 0.9;

  function makeNoiseBuffer(kind) {
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      if (kind === 'brown') {
        // integrate + leak for brown noise, then normalize-ish
        last = (last + 0.02 * white) / 1.02;
        data[i] = last * 3.5;
      } else {
        data[i] = white;
      }
    }
    return buf;
  }

  function ensure() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.9;
      master.connect(ctx.destination);
      whiteBuf = makeNoiseBuffer('white');
      brownBuf = makeNoiseBuffer('brown');
    }
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  }

  function loopSource(buf, rate) {
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    if (rate) src.playbackRate.value = rate;
    return src;
  }

  function fadeTo(param, value, secs) {
    const t = ctx.currentTime;
    param.cancelScheduledValues(t);
    param.setValueAtTime(param.value, t);
    param.linearRampToValueAtTime(value, t + secs);
  }

  /* ---------- rain: white noise -> lowpass + faint high hiss ---------- */
  function buildRain() {
    const g = ctx.createGain(); g.gain.value = 0; g.connect(master);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1700; lp.Q.value = 0.4;
    lp.connect(g);
    const src = loopSource(whiteBuf); src.connect(lp); src.start();

    const hissG = ctx.createGain(); hissG.gain.value = 0; hissG.connect(master);
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 5200;
    hp.connect(hissG);
    const src2 = loopSource(whiteBuf, 1.7); src2.connect(hp); src2.start();

    const setVol = (v) => { fadeTo(g.gain, toGain(v), 0.4); fadeTo(hissG.gain, toGain(v) * 0.12, 0.4); };
    setVol(vols.rain);
    const dispose = () => { try { src.stop(); src2.stop(); } catch { /* already stopped */ } g.disconnect(); hissG.disconnect(); };
    return { setVol, dispose };
  }

  /* ---------- thunder: brown noise -> deep lowpass + random swells ---------- */
  function buildThunder() {
    const g = ctx.createGain(); g.gain.value = 0; g.connect(master);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 110; lp.Q.value = 0.3;
    lp.connect(g);
    const src = loopSource(brownBuf, 0.6); src.connect(lp); src.start();

    let timer = null, dead = false;
    const setVol = (v) => { fadeTo(g.gain, toGain(v) * 0.07, 0.5); }; // faint constant bed
    const swell = () => {
      if (dead) return;
      const t = ctx.currentTime;
      const peak = toGain(vols.thunder) * rand(0.5, 1.0);
      const attack = rand(0.6, 2.2), decay = rand(2.0, 6.0);
      g.gain.cancelScheduledValues(t);
      g.gain.setValueAtTime(g.gain.value, t);
      g.gain.linearRampToValueAtTime(peak, t + attack);
      g.gain.linearRampToValueAtTime(toGain(vols.thunder) * 0.07, t + attack + decay);
      timer = setTimeout(swell, rand(5000, 14000));
    };
    setVol(vols.thunder);
    swell();
    const dispose = () => { dead = true; clearTimeout(timer); try { src.stop(); } catch { /* noop */ } g.disconnect(); };
    return { setVol, dispose };
  }

  /* ---------- wind: slowed noise -> bandpass, LFO on gain + filter ---------- */
  function buildWind() {
    const wg = ctx.createGain(); wg.gain.value = 0; wg.connect(master);
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 420; bp.Q.value = 0.6;
    bp.connect(wg);
    const src = loopSource(whiteBuf, 0.4); src.connect(bp); src.start();

    // slow gusts on loudness
    const lfo1 = ctx.createOscillator(); lfo1.type = 'sine'; lfo1.frequency.value = 0.07;
    const lg1 = ctx.createGain();
    lfo1.connect(lg1); lg1.connect(wg.gain); lfo1.start();
    // slow drift on filter tone
    const lfo2 = ctx.createOscillator(); lfo2.type = 'sine'; lfo2.frequency.value = 0.045;
    const lg2 = ctx.createGain(); lg2.gain.value = 190;
    lfo2.connect(lg2); lg2.connect(bp.frequency); lfo2.start();

    const setVol = (v) => {
      const base = toGain(v) * 0.55;
      fadeTo(wg.gain, base, 0.6);
      lg1.gain.value = base * 0.7;
    };
    setVol(vols.wind);
    const dispose = () => {
      try { src.stop(); lfo1.stop(); lfo2.stop(); } catch { /* noop */ }
      wg.disconnect();
    };
    return { setVol, dispose };
  }

  /* ---------- fireplace: warm bed + random crackle pops ---------- */
  function buildFire() {
    const out = ctx.createGain(); out.gain.value = 0; out.connect(master);
    // warm low bed
    const bed = ctx.createGain(); bed.gain.value = 0; bed.connect(out);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 280;
    lp.connect(bed);
    const bsrc = loopSource(brownBuf, 0.7); bsrc.connect(lp); bsrc.start();

    // crackle scheduler: short filtered noise bursts with fast decay
    let timer = null, dead = false;
    const pop = () => {
      if (dead) return;
      const t = ctx.currentTime;
      const dur = rand(0.04, 0.16);
      const src = ctx.createBufferSource();
      src.buffer = whiteBuf;
      src.playbackRate.value = rand(0.8, 2.2);
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass';
      bp.frequency.value = rand(1200, 4600); bp.Q.value = 1.1;
      const pg = ctx.createGain();
      const peak = rand(0.15, 0.9);
      pg.gain.setValueAtTime(peak, t);
      pg.gain.exponentialRampToValueAtTime(0.001, t + dur);
      src.connect(bp); bp.connect(pg); pg.connect(out);
      src.start(t, rand(0, 1.5), dur + 0.05);
      src.stop(t + dur + 0.05);
      timer = setTimeout(pop, rand(50, 650));
    };
    pop();

    const setVol = (v) => { fadeTo(out.gain, toGain(v), 0.4); fadeTo(bed.gain, 0.08, 0.4); };
    setVol(vols.fire);
    const dispose = () => { dead = true; clearTimeout(timer); try { bsrc.stop(); } catch { /* noop */ } out.disconnect(); };
    return { setVol, dispose };
  }

  const BUILDERS = { rain: buildRain, thunder: buildThunder, wind: buildWind, fire: buildFire };

  /* ---------- public API ---------- */
  function start(key) {
    ensure();
    if (active[key] || !BUILDERS[key]) return;
    active[key] = BUILDERS[key]();
  }
  function stop(key) {
    if (!active[key]) return;
    active[key].dispose();
    delete active[key];
  }
  function setVolume(key, v) {
    vols[key] = Math.max(0, Math.min(1, v));
    if (active[key]) active[key].setVol(vols[key]);
  }
  function stopAll() {
    Object.keys(active).forEach(stop);
  }
  function isPlaying(key) { return !!active[key]; }
  function getVolumes() { return { ...vols }; }

  return { ensure, start, stop, setVolume, stopAll, isPlaying, getVolumes };
})();
